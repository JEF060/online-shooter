import Entity from "./entity.js";

export default class EntityList {

    #entities = null;

    constructor() {
        this.#entities = new Map();
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
    }

    drawEntities(ctx, camera) {
        for (const entity of this.getEntityValues()) {
            entity.draw(ctx, camera);
        }
    }
}