import Entity from "./entity.js";

export default class EntityList {

    #entities = null;

    constructor({cellSize = 500, pushCoefficient = 50} = {}) {
        this.#entities = new Map();
        this.cellSize = cellSize;
        this.pushCoefficient = pushCoefficient;
    }

    set(key, value) {
        if (!key instanceof Entity) {
            console.log('Tried to add a non-entity to an EntityList');
            return;
        }
        this.#entities.set(key, value);
    }

    get(key) {
        return this.#entities.get(key);
    }

    has(key) {
        return this.#entities.has(key);
    }

    delete(key) {
        this.#entities.delete(key);
    }

    getSize() {
        return this.#entities.size;
    }

    getEntityValues() {
        return this.#entities.values();
    }

    toArray() {
        return Array.from(this.#entities.entries());
    }

    fromArray(arr) {
        //The array does not conserve the entity class, so the entities must be reconstructed from their respective object
        for (let i = 0; i < arr.length; i++) {
            //First column [0] is id, and second column [1] is entity data
            const id = arr[i][0];
            const entityData = arr[i][1]

            if (!this.#entities.has(id)) {
                this.#entities.set(id, new Entity(entityData));
            } else {
                const entity = this.#entities.get(id);
                entity.serverUpdate(entityData);
            }
        }
    }

    updateEntities(dT) {
        for (const entity of this.getEntityValues()) {
            entity.update(dT);
        }

        const detectCollisionStart = performance.now();
        const collisionList = this.#detectCollisions(this.cellSize);
        const detectCollisionEnd = performance.now();
        //console.log("Collision detection time: \t" + (detectCollisionEnd - detectCollisionStart) + "\t milliseconds");

        collisionList.forEach(([entity1, entity2]) => {
            this.#handleCollision(entity1, entity2, dT);
        });
    }

    drawEntities(ctx, camera) {
        for (const entity of this.getEntityValues()) {
            entity.draw(ctx, camera);
        }
    }

    #handleCollision(entity1, entity2, deltaTime) {

        const distanceX = entity2.position.x - entity1.position.x;
        const distanceY = entity2.position.y - entity1.position.y;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        
        const radiusFirst = entity1.radius;
        const radiusSecond = entity2.radius;
        const radiusSum = radiusFirst + radiusSecond;
    
        const displacementMag = radiusSum - distance;
        const displacementX = displacementMag * distanceX / distance;
        const displacementY = displacementMag * distanceY / distance;
        
        //This fixes the collision immediately, but is not what we want. A slow, gradual push is smoother
        //entity2.position.x += displacementX / 2;
        //entity2.position.y += displacementY / 2;
        //entity1.position.x -= displacementX / 2;
        //entity1.position.y -= displacementY / 2;
        
        entity2.velocity.x += displacementX * this.pushCoefficient * entity1.pushForce / entity2.mass * deltaTime;
        entity2.velocity.y += displacementY * this.pushCoefficient * entity1.pushForce / entity2.mass * deltaTime;
        entity1.velocity.x -= displacementX * this.pushCoefficient * entity2.pushForce / entity1.mass * deltaTime;
        entity1.velocity.y -= displacementY * this.pushCoefficient * entity2.pushForce / entity1.mass * deltaTime;
    }

    #detectCollisions(cellSize) {
        //{Key: cell coordinates, Value: entities within that cell}
        const grid = new Map();

        //Helper function to generate a key for the grid
        function getKey(x, y) {
            return `${x},${y}`;
        }

        //Function to add entities to the grid based on their position
        function addToGrid(entity) {
            //Calculate the grid bounds for the entity (can span multiple cells)
            const minX = Math.floor((entity.position.x - entity.radius) / cellSize);
            const maxX = Math.floor((entity.position.x + entity.radius) / cellSize);
            const minY = Math.floor((entity.position.y - entity.radius) / cellSize);
            const maxY = Math.floor((entity.position.y + entity.radius) / cellSize);

            //Assign the entity to all relevant grid cells
            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    const key = getKey(x, y);
                    
                    //If the cell doesn't exist yet, initialize it with an empty array
                    if (!grid.has(key)) {
                        grid.set(key, []);
                    }

                    grid.get(key).push(entity);
                }
            }
        }

        //Add each entity to the grid
        for (const entity of this.getEntityValues()) {
            addToGrid(entity);
        }

        const collisions = [];

        //Check for collisions within each cell
        function checkCollisionsInCell(cellEntities) {
            if (cellEntities.length <= 1) return;  //Skip cells with only 0 or 1 entity

            for (let i = 0; i < cellEntities.length; i++) {
                for (let j = i + 1; j < cellEntities.length; j++) {
                    const entity1 = cellEntities[i];
                    const entity2 = cellEntities[j];

                    //Check axis-aligned bounding box collision, this improves performance
                    if (!aabbCollision(entity1, entity2)) continue;

                    //Calculate the distance between two circles
                    const dx = entity1.position.x - entity2.position.x;
                    const dy = entity1.position.y - entity2.position.y;

                    const distanceSquared = dx * dx + dy * dy;
                    const radiiSum = entity1.radius + entity2.radius;

                    if (distanceSquared <= radiiSum * radiiSum) {
                        collisions.push([entity1, entity2]);  //Store the collision pair
                    }
                    
                }
            }
        }

        //aabb means axis-aligned bounding box, this is a performant pre-check to see if entities could be colliding
        function aabbCollision(entity1, entity2) {
            return (Math.abs(entity1.position.x - entity2.position.x) <= (entity1.radius + entity2.radius)) &&
                   (Math.abs(entity1.position.y - entity2.position.y) <= (entity1.radius + entity2.radius));
        }
        
        //Loop through each grid cell and check for collisions
        grid.forEach(cellEntities => {
            checkCollisionsInCell(cellEntities);  // Check within the same cell
        });

        return collisions;  // Return a list of collision pairs
    }
}