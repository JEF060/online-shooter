import Entity from "./entity.js";
import Camera from "./camera.js";

export default class Room {

    //Porportion of score that is gained when one player kills another player
    static PLAYER_SCORE_TRANSFER_FACTOR = 0.25;

    #entities = null;
    #playerEntities = null;
    #playerViewports = null;
    #viewportEntities = null;

    constructor({onServer = false, size = 1024} = {}) {
        this.onServer = onServer;
        this.size = size;
        this.cellSize = 512;
        this.pushCoefficient = 50;

        //Map {Key: cell coordinates {x, y}, Value: Map {Key: entity id, Value: entity}}
        this.grid = new Map();

        //Used for debug
        this.drawTime = 0;
        this.updateTime = 0;
        this.collisionTime = 0;

        this.#entities = new Map(); //Map {Key: entity id, Value: entity}
        this.#playerEntities = new Map(); //Map {Key: player id, Value: player entity}

        //These two maps are used only by the server to determine which entities to send to which players
        this.#playerViewports = null;
        this.#viewportEntities = null;

        if (onServer) this.#playerViewports = new Map(); //Map {Key: player id, Value: viewport dimensions {x, y, width, height}
        if (onServer) this.#viewportEntities = new Map(); //Map {Key: viewport dimensions {x, y, width, height}, Value: Map {Key: entity id, Value: entity}}
    }

    //This function should only be used on the server for sending data to client
    //TODO: Only send necessary data to clients, which is that found in serverUpdate function. Only send entire entity data when player first joins or new entity is created
    static toArray(entitiesMap) {
        return Array.from(entitiesMap.entries());
    }

    addEntity(entity) {
        this.#entities.set(entity.id, entity);

        if (entity.type == Entity.types.PLAYER)
            this.#playerEntities.set(entity.id, entity);
    }

    getEntity(key) {
        return this.#entities.get(key);
    }

    hasEntity(key) {
        return this.#entities.has(key);
    }

    deleteEntity(key) {
        this.#entities.delete(key);

        if (this.#playerEntities.has(key))
            this.#playerEntities.delete(key);
    }

    getNumberOfEntities() {
        return this.#entities.size;
    }

    getNumberOfPlayers() {
        return this.#playerEntities.size;
    }

    killPlayer(playerID) {
        if (this.#playerEntities.has(playerID)) {
            this.#playerEntities.delete(playerID);
            if (this.#entities.has(playerID))
                this.#entities.get(playerID).deadFlag = true;
        }
    }

    getEntityValues() {
        return this.#entities.values();
    }

    getEntitiesInViewportOfPlayer(playerID) {
        let viewport = null;
        let entities = new Map();

        if (this.#playerViewports.has(playerID))
            viewport = this.#playerViewports.get(playerID);

        if (viewport)
            entities = this.#viewportEntities.get(viewport);

        return entities;
    }

    cellOfEntity(entity) {
        return {x: Math.floor(entity.position.x / this.cellSize), y: Math.floor(entity.position.y / this.cellSize)};
    }

    entitiesInCell({x, y}) {
        const gridKey = Room.#getGridKey(x, y);
        let result = new Map();

        if (this.grid.has(gridKey))
            result = this.grid.get(gridKey);

        return result;
    }

    //This function should only be used on the client for receiving data from server
    fromArray(arr) {

        const start = performance.now();

        //The array does not conserve the entity class, so the entities must be reconstructed from their respective object
        for (let i = 0; i < arr.length; i++) {
            //First column [0] is id, and second column [1] is entity data
            const entityID = arr[i][0];
            const entityData = arr[i][1]

            if (!this.hasEntity(entityID))
                this.addEntity(new Entity(entityData));
            else {
                const entity = this.getEntity(entityID);
                entity.serverUpdate(entityData);
            }
        }

        const end = performance.now();
        this.entityReceptionTime = end - start;
    }

    updateEntities(deltaTime, users = null) {
        const updateStart = performance.now();

        for (const entity of this.getEntityValues()) {
            entity.update(deltaTime, this.size);

            if (entity.removeFlag)
                this.#entities.delete(entity.id);
        }

        const updateEnd = performance.now();
        this.updateTime = updateEnd - updateStart;
        const collisionStart = updateEnd;

        const collisionList = this.#detectCollisions();

        collisionList.forEach(([entity1, entity2]) => {
            this.#handleCollision(entity1, entity2, deltaTime);
        });

        const collisionEnd = performance.now();
        this.collisionTime = collisionEnd - collisionStart;

        if (this.onServer) this.#updateViewports(users);
    }

    drawEntities(ctx, camera, canvas) {
        const drawStart = performance.now();

        for (const entity of this.getEntityValues()) {

            if (!camera.entityWithinCamera(entity, canvas, entity.radius))
                continue;

            entity.draw(ctx, camera);
        }

        const drawEnd = performance.now();
        this.drawTime = drawEnd - drawStart;
    }

    //Helper function to generate a key for the grid
    static #getGridKey(x, y) {
        return `${x},${y}`;
    }

    #updateViewports(users) {
        this.#playerViewports = new Map();

        for (const [playerID, playerEntity] of this.#playerEntities) {
            let viewportSize = {x: 0, y: 0};

            if (users.has(playerID) && users.get(playerID).canvasSize)
                viewportSize = Camera.getViewportSize(playerEntity.targetRadius, users.get(playerID).canvasSize);

            const viewport = {
                x: playerEntity.position.x,
                y: playerEntity.position.y,
                width: viewportSize.x,
                height: viewportSize.y
            };

            this.#playerViewports.set(playerID, viewport);
            this.#viewportEntities.set(viewport, new Map());
        }

        for (const [entityID, entity] of this.#entities) {
            for (const [playerID, viewport] of this.#playerViewports) {
                if (entity.position.x + entity.radius > viewport.x - viewport.width / 2 &&
                    entity.position.x - entity.radius < viewport.x + viewport.width / 2 &&
                    entity.position.y + entity.radius > viewport.y - viewport.height / 2 &&
                    entity.position.y - entity.radius < viewport.y + viewport.height / 2
                ) {
                    this.#viewportEntities.get(viewport).set(entityID, entity);
                }
            }
        }
    }

    #entityDamageOtherEntity(attackerEntity, targetEntity, deltaTime) {
        if (attackerEntity.deadFlag || targetEntity.deadFlag)
            return;

        targetEntity.damage(attackerEntity.contactDamage * deltaTime)

        //If target was killed by a player, player is granted score depending on the targets's type
        if (targetEntity.deadFlag && attackerEntity.type == Entity.types.PLAYER) {
            if (targetEntity.type == Entity.types.SHAPE)
                attackerEntity.score += targetEntity.score;
            else if (targetEntity.type == Entity.types.PLAYER)
                attackerEntity.score += targetEntity.score * Room.PLAYER_SCORE_TRANSFER_FACTOR;
            else
                attackerEntity.score += targetEntity.score;
        }
    }

    #handleCollision(entity1, entity2, deltaTime) {

        //The entities hurt each other
        this.#entityDamageOtherEntity(entity1, entity2, deltaTime);
        this.#entityDamageOtherEntity(entity2, entity1, deltaTime);

        const distanceX = entity2.position.x - entity1.position.x;
        const distanceY = entity2.position.y - entity1.position.y;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        
        const radiusSum = entity1.radius + entity2.radius;
    
        const displacementMag = radiusSum - distance;
        const displacementX = displacementMag * distanceX / distance;
        const displacementY = displacementMag * distanceY / distance;
        
        entity2.velocity.x += displacementX * this.pushCoefficient * entity1.pushForce / entity2.mass * deltaTime;
        entity2.velocity.y += displacementY * this.pushCoefficient * entity1.pushForce / entity2.mass * deltaTime;
        entity1.velocity.x -= displacementX * this.pushCoefficient * entity2.pushForce / entity1.mass * deltaTime;
        entity1.velocity.y -= displacementY * this.pushCoefficient * entity2.pushForce / entity1.mass * deltaTime;
    }

    #detectCollisions() {
        this.grid = new Map();
        const collisions = [];

        //Add each entity to the grid
        for (const entity of this.getEntityValues())
            this.#addEntityToGrid(entity);
        
        //Loop through each grid cell and check for collisions
        this.grid.forEach(cellEntities => {
            this.#checkCollisionsInCell(Array.from(cellEntities.values()), collisions);
        });

        return collisions;  //Return a list of collision pairs
    }

    #checkCollisionsInCell(cellEntities, collisions) {
        if (cellEntities.length <= 1) return;  //There can't be collisions in a cell with 0 or 1 entities

        for (let i = 0; i < cellEntities.length; i++) {
            for (let j = i + 1; j < cellEntities.length; j++) {
                const entity1 = cellEntities[i];
                const entity2 = cellEntities[j];

                if (!entity1.canCollide || !entity2.canCollide) continue;

                //Axis-aligned bounding box precheck
                if (!this.#aabbCollision(entity1, entity2)) continue;

                //Calculate the distance between two circles
                const dx = entity1.position.x - entity2.position.x;
                const dy = entity1.position.y - entity2.position.y;

                const distanceSquared = dx * dx + dy * dy;
                const radiiSum = entity1.radius + entity2.radius;

                if (distanceSquared <= radiiSum * radiiSum)
                    collisions.push([entity1, entity2]);  //Store the collision pair
            }
        }
    }

    #aabbCollision(entity1, entity2) {
        return (Math.abs(entity1.position.x - entity2.position.x) <= (entity1.radius + entity2.radius)) &&
               (Math.abs(entity1.position.y - entity2.position.y) <= (entity1.radius + entity2.radius));
    }

    #addEntityToGrid(entity) {

        //Calculate the grid bounds for the entity (can span multiple cells)
        const minX = Math.floor((entity.position.x - entity.radius) / this.cellSize);
        const maxX = Math.floor((entity.position.x + entity.radius) / this.cellSize);
        const minY = Math.floor((entity.position.y - entity.radius) / this.cellSize);
        const maxY = Math.floor((entity.position.y + entity.radius) / this.cellSize);

        //Assign the entity to all relevant grid cells
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = Room.#getGridKey(x, y);
                
                //If the cell doesn't exist yet, initialize it with an empty array
                if (!this.grid.has(key)) {
                    this.grid.set(key, new Map());
                }

                this.grid.get(key).set(entity.id, entity);
            }
        }
    }
}