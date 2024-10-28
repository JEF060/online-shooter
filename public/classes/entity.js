import Polygon from "./polygon.js";

export default class Entity {
    constructor({
        position = { x: 0, y: 0 },
        positionError = {x: 0, y: 0},
        velocity = { x: 0, y: 0 },
        acceleration = { x: 0, y: 0 },
        linearDrag = 0,
        rotation = 0,
        rotationalVelocity = 0,
        rotationalAcceleration = 0,
        rotationalDrag = 0,
        lookTarget = {x: 0, y: 0},
        lookForce = 0,
        radius = 0,
        pushForce = 1,
        mass = 1,
        id,
        points = [],
        constructPolygon = false,
        colorSpace = 'oklch',
        color = {col: [0, 0, 0], a: 1},
        outlineColor = {col: [0, 0, 0], a: 1},
        outlineThickness = 4
    } = {}) {
        this.position = position;
        this.positionError = positionError;
        this.velocity = velocity;
        this.acceleration = acceleration;
        this.linearDrag = linearDrag;
    
        this.rotation = rotation;
        this.rotationalVelocity = rotationalVelocity;
        this.rotationalAcceleration = rotationalAcceleration;
        this.rotationalDrag = rotationalDrag;
        this.lookTarget = lookTarget;
        this.lookForce = lookForce;
    
        this.radius = radius;
        this.pushForce = pushForce;
        this.mass = mass;

        //Points trace out the polygon that will be drawn when draw function is called
        this.points = points;
        this.polygon = null;

        //If there are no points then simply use a basic circle and don't construct a polygon
        //constructPolygon flag is used because the server doesn't need to create a polygon object because the server never renders anything
        if (this.points.length > 0 && constructPolygon) this.polygon = new Polygon({points: this.points, colorSpace: this.colorSpace, color: this.color, outlineColor: this.outlineColor, outlineThickness: this.outlineThickness});

        this.colorSpace = colorSpace;
        this.color = color;
        this.outlineColor = outlineColor;
        this.outlineThickness = outlineThickness;
    
        this.id = id ? String(id) : Entity.#makeid(10);
    }
    
    serverUpdate({
        position = { x: 0, y: 0 },
        velocity = { x: 0, y: 0 },
        acceleration = { x: 0, y: 0 },
        lookTarget = {x: 0, y: 0}
    } = {}) {
        this.positionError.x = position.x - this.position.x;
        this.positionError.y = position.y - this.position.y;

        this.velocity = velocity;
        this.acceleration = acceleration;
        this.lookTarget = lookTarget;
    }

    //Generates a random alphanumeric id
    static #makeid(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < length) {
          result += characters.charAt(Math.floor(Math.random() * charactersLength));
          counter += 1;
        }
        return result;
    }

    //Loops through all values in an object and makes sure they are all numbers
    static #fixNumbers(input) {

        //If input is a number, fix it and return the result
        if (typeof input === 'number') {
            return isNaN(input) ? 0 : input;
        }
    
        //If input is an object, fix all its properties
        for (let key in input) {
            if (typeof input[key] !== 'number' || isNaN(input[key])) {
                input[key] = 0;
            }
        }
    
        return input;
    }

    //Framerate independent physics update
    update(deltaTime) {

        //Makes sure values are valid numbers
        deltaTime           = Entity.#fixNumbers(deltaTime);
        this.position       = Entity.#fixNumbers(this.position);
        this.velocity       = Entity.#fixNumbers(this.velocity);
        this.acceleration   = Entity.#fixNumbers(this.acceleration);
        this.rotation       = Entity.#fixNumbers(this.rotation);


        //Linear Motion
        //-------------------------------------------------------
        this.position.x += this.velocity.x * deltaTime * 0.5;
        this.position.y += this.velocity.y * deltaTime * 0.5;

        this.velocity.x += this.acceleration.x * deltaTime;
        this.velocity.y += this.acceleration.y * deltaTime;

        this.velocity.x *= 1 / (1 + this.linearDrag * deltaTime);
        this.velocity.y *= 1 / (1 + this.linearDrag * deltaTime);

        this.position.x += this.velocity.x * deltaTime * 0.5;
        this.position.y += this.velocity.y * deltaTime * 0.5;   
        //-------------------------------------------------------

        //Position Correction
        const correctionFactor = Math.min(3 * deltaTime, 1);
        this.position.x += this.positionError.x * correctionFactor;
        this.position.y += this.positionError.y * correctionFactor;
        this.positionError.x -= this.positionError.x * correctionFactor;
        this.positionError.y -= this.positionError.y * correctionFactor;


        //Rotational Motion
        //-------------------------------------------------------------------
        this.rotation += this.rotationalVelocity * deltaTime * 0.5;

        this.rotationalVelocity += this.rotationalAcceleration * deltaTime;
        this.rotationalVelocity *= 1 / (1 + this.rotationalDrag * deltaTime);

        this.rotation += this.rotationalVelocity * deltaTime * 0.5;

        if (this.rotation > Math.PI) { this.rotation -= Math.PI * 2; }
        if (this.rotation < -Math.PI) { this.rotation += Math.PI * 2; }
        //-------------------------------------------------------------------

        //Look at target
        //-------------------------------------------------------------------
        let targetRot = Math.atan2(this.lookTarget.y - this.position.y, this.lookTarget.x - this.position.x);

        if (Math.abs(targetRot + Math.PI * 2 - this.rotation) < Math.abs(targetRot - this.rotation)) { targetRot += Math.PI * 2; }
        if (Math.abs(targetRot - Math.PI * 2 - this.rotation) < Math.abs(targetRot - this.rotation)) { targetRot -= Math.PI * 2; }

        const rotDisplacement = targetRot - this.rotation;
        this.rotationalAcceleration = rotDisplacement * this.lookForce;
        //-------------------------------------------------------------------
    }

    draw(ctx, camera) {

        const color = new Color(this.colorSpace, this.color.col, this.color.a);
        const outlineColor = new Color(this.colorSpace, this.outlineColor.col, this.outlineColor.a);

        if (this.polygon) {

            this.polygon.draw({ctx: ctx, camera: camera, pos: this.position, rot: this.rotation, color: color, outlineColor: outlineColor});

        } else {

            ctx.fillStyle = color;
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = this.outlineThickness * camera.zoom;
    
            const adjustedPosition = camera.worldToScreen(this.position);
            const adjustedRadius = this.radius * camera.zoom;
    
            ctx.beginPath();
            ctx.arc(adjustedPosition.x, adjustedPosition.y, adjustedRadius, 0, Math.PI * 2, false);
            ctx.fill();
            ctx.stroke();
            ctx.closePath();
    
            ctx.beginPath();
            ctx.moveTo(adjustedPosition.x, adjustedPosition.y);
            ctx.lineTo(adjustedPosition.x + adjustedRadius * Math.cos(this.rotation), adjustedPosition.y + adjustedRadius * Math.sin(this.rotation));
            ctx.stroke();
            ctx.closePath();

        }
    }
}