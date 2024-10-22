export default class Camera {
    constructor({position, zoom, followSpeed} = {}) {
        this.position = position || {x: 0, y: 0};
        this.zoom = zoom || 1;
        this.targetPos = {x: this.position.x, y: this.position.y}
        this.followSpeed = followSpeed || 100;
    }

    worldToScreen(worldPos) {
        return {x: (worldPos.x + this.position.x) * this.zoom, y: (worldPos.y + this.position.y) * this.zoom};
    }

    screenToWorld(screenPos) {
        return {x: screenPos.x / this.zoom - this.position.x, y: screenPos.y / this.zoom - this.position.y};
    }

    objectWithinCamera(entity, canvas) {
        const top    = this.worldToScreen({x: entity.position.x, y: entity.position.y - entity.radius}).y;
        const bottom = this.worldToScreen({x: entity.position.x, y: entit.positiony.y + entity.radius}).y;
        const left   = this.worldToScreen({x: entity.position.x - entity.radius, y: entity.position.y}).x;
        const right  = this.worldToScreen({x: entity.position.x + entity.radius, y: entity.position.y}).x;
    
        return (
            bottom >= 0 &&
            top <= canvas.height &&
            right >= 0 &&
            left <= canvas.width
        );
    }

    setCenterTarget(canvas, pos) {
        this.targetPos.x = -pos.x + canvas.width  / this.zoom * 0.5;;
        this.targetPos.y = -pos.y + canvas.height / this.zoom * 0.5;;
    }

    update(dT) {

        let displacementX = this.targetPos.x - this.position.x;
        let displacementY = this.targetPos.y - this.position.y;

        let adjustedDisplacementX = displacementX / (1 + this.followSpeed * dT);
        let adjustedDisplacementY = displacementY / (1 + this.followSpeed * dT);

        this.position.x += displacementX - adjustedDisplacementX;
        this.position.y += displacementY - adjustedDisplacementY;
    }
}