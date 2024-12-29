export default class Camera {

    //Used when calculating camera zoom in order to prevent the user from, for example,
    //making the window incredibly short so that they can see incredibly far horizontally
    static MIN_VIEWPORT_WIDTH = 960;
    static MIN_VIEWPORT_HEIGHT = 540;

    //Bigger number means camera is zoomed out more
    static VISIBLE_AREA = 4e5;

    //Determines the proportionality of camera zoom to the radius
    //Value of 1 means the player will visibly stay the same size on the screen (zoom increases linearly with radius)
    //Value of less than 1 means the player will appear bigger on the screen as the camera zooms out (zoom proportional to some root of radius)
    //Value of greater than 1 means the player will appear smaller as the camera zooms out (zoom proportional to some power of radius)
    static RADIUS_EXP = 1;

    constructor({position = {x: 0, y: 0}, followSpeed = 1, zoom = 1, zoomSpeed = 1} = {}) {
        this.position = position;
        this.targetPos = {x: 0, y: 0};
        this.velocity = {x: 0, y: 0};
        this.followSpeed = followSpeed;
        this.zoom = zoom;
        this.targetZoom = zoom;
        this.deltaZoom = 0;
        this.zoomSpeed = zoomSpeed;
    }

    static getViewportSize(targetEntityRadius, canvasSize) {
        const idealZoom = Math.sqrt((Math.max(canvasSize.x, Camera.MIN_VIEWPORT_WIDTH) * Math.max(canvasSize.y, Camera.MIN_VIEWPORT_HEIGHT)) / Camera.VISIBLE_AREA) / Math.pow(targetEntityRadius, Camera.RADIUS_EXP);

        const size = {
            x: canvasSize.x / idealZoom,
            y: canvasSize.y / idealZoom
        }

        return size;
    }

    worldToScreen(worldPos) {
        return {
            x: (worldPos.x + this.position.x) * this.zoom,
            y: (worldPos.y + this.position.y) * this.zoom
        };
    }

    screenToWorld(screenPos) {
        return {
            x: screenPos.x / this.zoom - this.position.x,
            y: screenPos.y / this.zoom - this.position.y
        };
    }

    entityWithinCamera(entity, canvas, buffer = 0) {
        const top    = this.worldToScreen({x: entity.position.x, y: entity.position.y - entity.radius - buffer}).y;
        const bottom = this.worldToScreen({x: entity.position.x, y: entity.position.y + entity.radius + buffer}).y;
        const left   = this.worldToScreen({x: entity.position.x - entity.radius - buffer, y: entity.position.y}).x;
        const right  = this.worldToScreen({x: entity.position.x + entity.radius + buffer, y: entity.position.y}).x;
    
        return (
            bottom >= 0             &&
            top    <= canvas.height &&
            right  >= 0             &&
            left   <= canvas.width 
        );
    }

    setCenterTarget(position) {
        this.targetPos.x = position.x;
        this.targetPos.y = position.y;
    }

    setCenterPos(position, canvas) {
        this.position.x = -position.x + canvas.width / this.zoom * 0.5;
        this.position.y = -position.y + canvas.height / this.zoom * 0.5
    }

    setTargetZoom(canvas, targetEntityRadius) {
        if (targetEntityRadius == 0) return;
        this.targetZoom = Math.sqrt((Math.max(canvas.width, Camera.MIN_VIEWPORT_WIDTH) * Math.max(canvas.height, Camera.MIN_VIEWPORT_HEIGHT)) / Camera.VISIBLE_AREA) / Math.pow(targetEntityRadius, Camera.RADIUS_EXP);
    }

    update(deltaTime, canvas) {

        //Linear Motion
        //------------------------------------------------------------------------------------------------------------------------------------
        const adjustedTarget = {
            x: -this.targetPos.x + canvas.width / this.zoom * 0.5,
            y: -this.targetPos.y + canvas.height / this.zoom * 0.5
        }

        this.position.x += this.velocity.x / 2;
        this.position.y += this.velocity.y / 2;

        this.velocity.x = this.followSpeed * (adjustedTarget.x - this.position.x) * deltaTime;
        this.velocity.y = this.followSpeed * (adjustedTarget.y - this.position.y) * deltaTime;

        if (this.velocity.x > 0 && this.velocity.x > adjustedTarget.x - this.position.x) this.velocity.x = adjustedTarget.x - this.position.x;
        if (this.velocity.x < 0 && this.velocity.x < adjustedTarget.x - this.position.x) this.velocity.x = adjustedTarget.x - this.position.x;

        if (this.velocity.y > 0 && this.velocity.y > adjustedTarget.y - this.position.y) this.velocity.y = adjustedTarget.y - this.position.y;
        if (this.velocity.y < 0 && this.velocity.y < adjustedTarget.y - this.position.y) this.velocity.y = adjustedTarget.y - this.position.y;

        this.position.x += this.velocity.x / 2;
        this.position.y += this.velocity.y / 2;
        //------------------------------------------------------------------------------------------------------------------------------------

        //Zooming
        //-------------------------------------------------------------------------------------------------------------------
        const center = {
            x: -this.position.x + canvas.width / this.zoom * 0.5,
            y: -this.position.y + canvas.height / this.zoom * 0.5
        }

        this.zoom += this.deltaZoom
        this.deltaZoom = this.zoomSpeed * (this.targetZoom - this.zoom) * deltaTime;
        if (this.deltaZoom > 0 && this.deltaZoom > this.targetZoom - this.zoom) this.deltaZoom = this.targetZoom - this.zoom;
        if (this.deltaZoom < 0 && this.deltaZoom < this.targetZoom - this.zoom) this.deltaZoom = this.targetZoom - this.zoom;
        this.zoom += this.deltaZoom

        this.position = {
            x: -center.x + canvas.width / this.zoom * 0.5,
            y: -center.y + canvas.height / this.zoom * 0.5
        }
        //-------------------------------------------------------------------------------------------------------------------
    }
}