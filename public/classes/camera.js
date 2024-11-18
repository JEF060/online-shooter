export default class Camera {

    //Used when calculating camera zoom in order to prevent the user from, for example,
    //making the window incredibly short so that they can see incredibly far horizontally
    static MIN_VIEWPORT_WIDTH = 960;
    static MIN_VIEWPORT_HEIGHT = 540;

    //Bigger number means camera is zoomed out more
    static VISIBLE_AREA = 1e6;
    static RADIUS_ZOOM_FACTOR = 0.2;

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
        const idealZoom = Math.sqrt((Math.max(canvasSize.x, Camera.MIN_VIEWPORT_WIDTH) * Math.max(canvasSize.y, Camera.MIN_VIEWPORT_HEIGHT)) / Camera.VISIBLE_AREA) / (Math.sqrt(targetEntityRadius) * Camera.RADIUS_ZOOM_FACTOR);

        const size = {
            x: canvasSize.x / idealZoom,
            y: canvasSize.y / idealZoom
        }

        return size;
    }

    worldToScreen(worldPos) {
        return {x: (worldPos.x + this.position.x) * this.zoom, y: (worldPos.y + this.position.y) * this.zoom};
    }

    screenToWorld(screenPos) {
        return {x: screenPos.x / this.zoom - this.position.x, y: screenPos.y / this.zoom - this.position.y};
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

    setCenterTarget(canvas, position) {
        this.targetPos.x = -position.x + canvas.width  / this.zoom * 0.5;;
        this.targetPos.y = -position.y + canvas.height / this.zoom * 0.5;;
    }

    setTargetZoom(canvas, targetEntityRadius) {
        this.targetZoom = Math.sqrt((Math.max(canvas.width, Camera.MIN_VIEWPORT_WIDTH) * Math.max(canvas.height, Camera.MIN_VIEWPORT_HEIGHT)) / Camera.VISIBLE_AREA) / (Math.sqrt(targetEntityRadius) * Camera.RADIUS_ZOOM_FACTOR);
    }

    update(deltaTime, canvas) {

        //Linear Motion
        //------------------------------------------------------------------------------------------------------------------------------------
        this.position.x += this.velocity.x / 2;
        this.position.y += this.velocity.y / 2;

        this.velocity.x = this.followSpeed * (this.targetPos.x - this.position.x) * deltaTime;
        this.velocity.y = this.followSpeed * (this.targetPos.y - this.position.y) * deltaTime;

        if (this.velocity.x > 0 && this.velocity.x > this.targetPos.x - this.position.x) this.velocity.x = this.targetPos.x - this.position.x;
        if (this.velocity.x < 0 && this.velocity.x < this.targetPos.x - this.position.x) this.velocity.x = this.targetPos.x - this.position.x;

        if (this.velocity.y > 0 && this.velocity.y > this.targetPos.y - this.position.y) this.velocity.y = this.targetPos.y - this.position.y;
        if (this.velocity.y < 0 && this.velocity.y < this.targetPos.y - this.position.y) this.velocity.y = this.targetPos.y - this.position.y;

        this.position.x += this.velocity.x / 2;
        this.position.y += this.velocity.y / 2;
        //------------------------------------------------------------------------------------------------------------------------------------

        //Zooming
        //-------------------------------------------------------------------------------------------------------------------
        this.#changeZoom(this.deltaZoom / 2, canvas);

        this.deltaZoom = this.zoomSpeed * (this.targetZoom - this.zoom) * deltaTime;
        if (this.deltaZoom > 0 && this.deltaZoom > this.targetZoom - this.zoom) this.deltaZoom = this.targetZoom - this.zoom;
        if (this.deltaZoom < 0 && this.deltaZoom < this.targetZoom - this.zoom) this.deltaZoom = this.targetZoom - this.zoom;

        this.#changeZoom(this.deltaZoom / 2, canvas);
        //-------------------------------------------------------------------------------------------------------------------
    }

    #changeZoom(delta, canvas) {
        const growthFactor = (this.zoom + delta) / this.zoom;
        const widthChange = canvas.width * growthFactor - canvas.width;
        const heightChange = canvas.height * growthFactor - canvas.height;

        this.position.x -= widthChange / 2;
        this.position.y -= heightChange / 2;

        this.zoom += delta;
    }
}