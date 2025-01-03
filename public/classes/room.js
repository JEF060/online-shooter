import Entity from "./entity.js";
import Camera from "./camera.js";

export default class Room {

    //Porportion of score that is gained when one player kills another player
    static PLAYER_SCORE_TRANSFER_FACTOR = 0.25;

    #entities = null;
    #playerEntities = null;
    #playerViewports = null;
    #viewportEntities = null;

    #scoreNeededForLevel = [];

    constructor({onServer = false, size = 2048, id} = {}) {
        this.id = id;
        this.onServer = onServer;
        this.size = size;
        this.cellSize = 512;
        this.pushCoefficient = 80;

        //Map {Key: cell coordinates {x, y}, Value: Map {Key: entity id, Value: entity}}
        this.grid = new Map();

        //Used for debug
        this.drawTime = 0;
        this.updateTime = 0;
        this.collisionTime = 0;

        this.#entities = new Map(); //Map {Key: entity id, Value: entity}
        this.#playerEntities = new Map(); //Map {Key: player id, Value: player entity}

        //These maps are used only by the server to determine which entities to send to which players
        this.#playerViewports = null;
        this.#viewportEntities = null;

        if (onServer) {
            this.#playerViewports = new Map(); //Map {Key: player id, Value: viewport dimensions {x, y, width, height}
            this.#viewportEntities = new Map(); //Map {Key: viewport dimensions {x, y, width, height}, Value: Map {Key: entity id, Value: entity}}
        }
        
        this.MAX_LEVEL = 60;
        this.#calculatedScoresNeeded({maxLevel: this.MAX_LEVEL, A: 0.197740112994, B: 4.80225988701});

        //Used for scaling a player's stats as they level up

        this.playerInitialRadius = 16;
        this.playerFinalRadius = 48;

        this.initialMovementSpeed = 2600;
        this.finalMovementSpeed = 2300;

        this.initialMaxHealth = 2.5;
        this.finalMaxHealth = 5;

        this.initialDmgFactor = 1;
        this.finalDmgFactor = 1.25;

        this.initialPlayerMass = 1;
        this.finalPlayerMass = 3;

        this.initialPlayerPushFactor = 1;
        this.finalPlayerPushFactor = 3;
    }

    //This function should only be used on the server for sending data to client
    //TODO: Only send necessary data to clients, which is that found in serverUpdate function. Only send entire entity data when player first joins or new entity is created
    static toArray(entitiesMap, playerID) {
        const arr = [];

        for (const [entityID, entity] of entitiesMap) {
            let updatePackage = null;

            //Decide whether to send all data or minimal data based on whether client has already receieved data for this entity
            if (entity.fullBroadcastPlayerIDs.includes(playerID))
                updatePackage = entity.getPartialUpdatePackage();
            else {
                updatePackage = entity.getFullUpdatePackage();
                entity.fullBroadcastPlayerIDs.push(playerID);
            }

            arr.push([entityID, updatePackage]);
        }

        return arr;//Array.from(entitiesMap.entries());
    }

    //This function should only be used on the client for receiving data from server
    fromArray(arr) {

        //The array does not conserve the entity class, so the entities must be reconstructed from their respective object
        for (let i = 0; i < arr.length; i++) {
            //First column [0] is id, and second column [1] is entity data
            const entityID = arr[i][0];
            const entityData = arr[i][1]

            if (!this.hasEntity(entityID)) {
                this.addEntity(new Entity(entityData));
            }
            else {
                const entity = this.getEntity(entityID);
                entity.serverUpdate(entityData);
            }
        }
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

    updateEntities(deltaTime, users = null) {
        
        for (const entity of this.getEntityValues()) {
            entity.update(deltaTime, this.size);

            if (entity.type == Entity.types.PLAYER) {
                entity.level = this.#getLevelFromScore(entity.score)

                entity.skillPointsAvailable = Math.floor(entity.level * Entity.MAX_TOTAL_SKILL_POINTS / this.MAX_LEVEL) - entity.skillPointsUsed;

                const levelProportion = Math.floor(entity.level) / this.MAX_LEVEL;

                const healthPercent = entity.health / entity.maxHealth;
                const healthDispPercent = entity.healthDisplay / entity.maxHealth;

                entity.maxHealth = (this.initialMaxHealth + levelProportion * (this.finalMaxHealth - this.initialMaxHealth)) * (1 + 5 * entity.skills['maxHealth'].completion);
                entity.health = entity.maxHealth * healthPercent;
                entity.healthDisplay = entity.maxHealth * healthDispPercent;

                entity.healthRegenDelay = 20 - 15 * entity.skills['healthRegen'].completion;
                entity.healthRegenSpeed = 0.1 + 0.1 * entity.skills['healthRegen'].completion;

                entity.targetRadius = this.playerInitialRadius + levelProportion * (this.playerFinalRadius - this.playerInitialRadius);
                entity.movementSpeed = this.initialMovementSpeed + levelProportion * (this.finalMovementSpeed - this.initialMovementSpeed);
                entity.levelDmgFactor = this.initialDmgFactor + levelProportion * (this.finalDmgFactor - this.initialDmgFactor);
                entity.mass = this.initialPlayerMass + levelProportion * (this.finalPlayerMass - this.initialPlayerMass);
                entity.pushForce = this.initialPlayerPushFactor + levelProportion * (this.finalPlayerPushFactor - this.initialPlayerPushFactor);
            }

            if (this.onServer && entity.shooting || entity.shootingSecondary) {
                const projectiles = entity.shoot();

                if (projectiles) for (const projectile of projectiles)
                    this.addEntity(projectile);
            }

            if (entity.removeFlag) {
                this.#entities.delete(entity.id);
                if (this.#playerEntities.has(entity.id))
                    this.#playerEntities.delete(entity.id);
            }
        }

        const collisionList = this.#detectCollisions();

        collisionList.forEach(([entity1, entity2]) => {
            this.#handleCollision(entity1, entity2, deltaTime);
        });

        if (this.onServer) this.#updateViewports(users);
    }

    drawEntities(ctx, camera, canvas) {

        const drawEntities = [];
        const drawPlayers = [];
        const drawProjectiles = [];

        //Adds all entities to their corresponding layer in the appropriate array depending on their type
        for (const entity of this.getEntityValues()) {
            if (!camera.entityWithinCamera(entity, canvas, entity.radius)) continue;

            const layer = entity.drawLayer;

            if (entity.type == Entity.types.PLAYER) {
                if (!drawPlayers[layer]) drawPlayers[layer] = [];
                drawPlayers[layer].push(entity);
            } else if (entity.type == Entity.types.PROJECTILE) {
                if (!drawProjectiles[layer]) drawProjectiles[layer] = [];
                drawProjectiles[layer].push(entity);
            } else {
                if (!drawEntities[layer]) drawEntities[layer] = [];
                drawEntities[layer].push(entity);
            }
        }

        //Entities are drawn in order of their layer, with higher layers being drawn first and appearing in the back
        
        //Other entities (eg. shapes) are drawn first, so they appear behind other entities
        for (let i = drawEntities.length - 1; i >= 0; i--) {
            if (!drawEntities[i]) continue;
            for (const entity of drawEntities[i]) {
                entity.draw(ctx, camera);
                entity.drawHealth(ctx, camera);
            }
        }

        //Projectiles appear in between shapes and players
        for (let i = drawProjectiles.length - 1; i >= 0; i--) {
            if (!drawProjectiles[i]) continue;
            for (const entity of drawProjectiles[i]) {
                entity.draw(ctx, camera);
            }
        }
        
        //Players appear in front of all other entities
        for (let i = drawPlayers.length - 1; i >= 0; i--) {
            if (!drawPlayers[i]) continue;
            for (const entity of drawPlayers[i]) {
                entity.draw(ctx, camera);
                entity.drawHealth(ctx, camera);
                entity.drawName(ctx, camera);
            }
        }
    }

    //Helper function to generate a key for the grid
    static #getGridKey(x, y) {
        return `${x},${y}`;
    }

    #calculatedScoresNeeded({maxLevel, A, B}) {
        this.#scoreNeededForLevel = [];
        let runningTotal = 0;
        for (let i = 0; i <= maxLevel; i++) {
            const scoreNeeded = A * i * i + B * i;
            runningTotal += scoreNeeded;
            this.#scoreNeededForLevel.push(Math.round(runningTotal));
        }
    }

    #getLevelFromScore(score) {
        let level = null;
        let lastScoreMilestone = 0;
        let nextScoreMilestone = 0;
        
        for (let i = 0; i < this.#scoreNeededForLevel.length; i++) {
            if (this.#scoreNeededForLevel[i + 1] > score) {
                level = i;
                lastScoreMilestone = this.#scoreNeededForLevel[i];
                nextScoreMilestone = this.#scoreNeededForLevel[i + 1];
                break;
            }
        }

        if (level == null) {
            level = this.#scoreNeededForLevel.length - 1;
            return level;
        }

        level += (score - lastScoreMilestone) / (nextScoreMilestone - lastScoreMilestone);
        return level;
    }

    #updateViewports(users) {
        this.#playerViewports = new Map();

        for (const [userID, userInfo] of users) {
            if (userInfo.roomID != this.id || !users.has(userID) || !users.get(userID).canvasSize) continue;

            let viewportSize = {x: 0, y: 0};
            let viewport = {x: 0, y: 0, width: 0, height: 0};

            if (this.#playerEntities.has(userID) && !this.#playerEntities.get(userID).deadFlag) {
                const playerEntity = this.#playerEntities.get(userID);

                viewportSize = Camera.getViewportSize(playerEntity.targetRadius / playerEntity.baseRadius, users.get(userID).canvasSize);

                viewport = {
                    x: playerEntity.position.x,
                    y: playerEntity.position.y,
                    width: viewportSize.x,
                    height: viewportSize.y
                };
            } else {
                viewportSize = Camera.getViewportSize(Entity.DEAD_PLAYER_ZOOM_FACTOR, users.get(userID).canvasSize);

                viewport = {
                    x: userInfo.position.x,
                    y: userInfo.position.y,
                    width: viewportSize.x,
                    height: viewportSize.y
                };
            }

            this.#playerViewports.set(userID, viewport);
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
                } else {
                    entity.fullBroadcastPlayerIDs.splice(entity.fullBroadcastPlayerIDs.indexOf(playerID), 1);
                }
            }
        }
    }

    #awardScore(receiverEntity, senderEntity) {
        if (receiverEntity.type != Entity.types.PLAYER) return;

        let score = senderEntity.score;

        if (senderEntity.type == Entity.types.PLAYER)
           score *= Room.PLAYER_SCORE_TRANSFER_FACTOR;

        receiverEntity.score += score;
    }

    #handleCollision(entity1, entity2, deltaTime) {

        if (entity1 == null || entity2 == null) return;

        if ((entity1.owner == entity2.id) || (entity2.owner == entity1.id) || ((entity1.owner != null) && (entity2.owner != null) && (entity1.owner == entity2.owner)))
            return;

        //The entities hurt each other
        if (this.onServer && !(entity1.type == Entity.types.SHAPE && entity2.type == Entity.types.SHAPE)) {

            let entity1Dmg = entity1.contactDamage * deltaTime;
            let entity2Dmg = entity2.contactDamage * deltaTime;

            if (entity1.type == Entity.types.PLAYER && entity2.type != Entity.types.PROJECTILE)
                entity1Dmg *= 1 + 10 * entity1.skills['bodyDmg'].completion;

            if (entity2.type == Entity.types.PLAYER && entity1.type != Entity.types.PROJECTILE)
                entity2Dmg *= 1 + 10 * entity2.skills['bodyDmg'].completion;

            if (entity1Dmg >= entity2.health && entity2Dmg >= entity1.health) {
    
                const timeToKillEntity1 = entity1.health / entity2.contactDamage;
                const timeToKillEntity2 = entity2.health / entity1.contactDamage;
        
                if (timeToKillEntity1 < timeToKillEntity2) {
                    entity1.damage(entity2Dmg);
                    entity2.damage(entity1Dmg * timeToKillEntity1 / deltaTime);
                } else if (timeToKillEntity2 < timeToKillEntity1) {
                    entity2.damage(entity1Dmg);
                    entity1.damage(entity2Dmg * timeToKillEntity2 / deltaTime);
                } else {
                    entity1.damage(entity1.health);
                    entity2.damage(entity2.health);
                }
    
            } else {
                entity1.damage(entity2Dmg);
                entity2.damage(entity1Dmg);
            }

            if (entity1.deadFlag && !entity2.deadFlag) {
                let awardee = entity2;
                if (entity2.owner && this.hasEntity(entity2.owner))
                    awardee = this.getEntity(entity2.owner);
                this.#awardScore(awardee, entity1);
            } else if (entity2.deadFlag && !entity1.deadFlag) {
                let awardee = entity1;
                if (entity1.owner && this.hasEntity(entity1.owner))
                    awardee = this.getEntity(entity1.owner);
                this.#awardScore(awardee, entity2);
            } else if (entity1.deadFlag && entity2.deadFlag) {
                if (entity1.type == Entity.types.SHAPE && entity2.owner && this.hasEntity(entity2.owner))
                    this.#awardScore(this.getEntity(entity2.owner), entity1);
                if (entity2.type == Entity.types.SHAPE && entity1.owner && this.hasEntity(entity1.owner))
                    this.#awardScore(this.getEntity(entity1.owner), entity2);
            }
        }

        const distanceX = entity2.position.x - entity1.position.x;
        const distanceY = entity2.position.y - entity1.position.y;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        
        const radiusSum = entity1.radius + entity2.radius;
    
        const displacementMag = radiusSum - distance;
        const displacementX = displacementMag * distanceX / distance;
        const displacementY = displacementMag * distanceY / distance;

        const entity1Push = entity1.pushForce / ((entity1.type == Entity.types.PLAYER) ? 1 + 2 * entity1.skills['bodyDmg'].completion : 1);
        const entity2Push = entity2.pushForce / ((entity2.type == Entity.types.PLAYER) ? 1 + 2 * entity2.skills['bodyDmg'].completion : 1);
        
        entity2.velocity.x += displacementX * this.pushCoefficient * entity1Push / entity2.mass * deltaTime;
        entity2.velocity.y += displacementY * this.pushCoefficient * entity1Push / entity2.mass * deltaTime;
        entity1.velocity.x -= displacementX * this.pushCoefficient * entity2Push / entity1.mass * deltaTime;
        entity1.velocity.y -= displacementY * this.pushCoefficient * entity2Push / entity1.mass * deltaTime;
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