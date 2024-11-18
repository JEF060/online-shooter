import Polygon from "./polygon.js";

export default class Entity {

    static PLAYER_BASE_SPEED = 3000;
    static UPDATE_TIMEOUT = 1; //If the entity hasn't been updated in this time, then it is assumed to be dead
    static POSITION_CORRECTION_SPEED = 3;
    static BOUNDARY_PUSH_POWER = 600;
    static BOUNDARY_PUSH_DST_FACTOR = 0.25;
    static HEALTH_FADE_IN_SPEED = 30;
    static HEALTH_FADE_OUT_SPEED = 15;

    static types = Object.freeze({
        NONSPECIFIED: 0,
        PLAYER: 1,
        SHAPE: 2
    });

    constructor({
        score = 0,
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
        canCollide = true,
        baseRadius = 0,
        pushForce = 1,
        mass = 1,
        contactDamage = 1,
        maxHealth = 1,
        health = null,
        healthRegenSpeed = 1,
        healthRegenDelay = 3,
        showHealth = true,
        deadFlag = false,
        id,
        type = 0,
        onServer = false,
        points = [],
        colorVals = {col: [0, 0, 0], a: 1},
        outlineColVals = {col: [0, 0, 0], a: 1},
        outlineThickness = 0
    } = {}) {
        this.score = score;

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
    
        this.canCollide = canCollide;
        this.pushForce = pushForce;
        this.mass = mass;

        this.contactDamage = contactDamage;
        this.maxHealth = maxHealth;
        this.health = health || maxHealth;
        this.healthRegenSpeed = healthRegenSpeed;
        this.healthRegenDelay = healthRegenDelay;
        this.healthRegenTimer = 0;
        this.showHealth = showHealth;

        //Used for smoothly interpolating between health values
        this.healthDisplay = this.health
        this.deltaHealthDisp = 0;
        this.deltaHealthFactor = 8;

        this.baseRadius = baseRadius;
        this.targetRadius = baseRadius;
        this.deltaRadius = 0;
        this.radiusChangeFactor = 8;
        this.radius = 0;

        //This marks the entity for removal, at which point it will fade out and then be removed
        this.deadFlag = deadFlag;
        this.removeFlag = deadFlag;
        this.fadeTimer = 0;
        this.fadeLength = 0.2;
        this.fadeGrowFactor = 0.25;
        if (onServer) this.fadeLength = 2; //On the server objects wait longer to be destroyed so that deadFlag has a bigger window in which it can be sent to clients

        this.colorVals        = colorVals;
        this.outlineColVals   = outlineColVals;
        this.outlineThickness = outlineThickness;

        //Points trace out the polygon that will be drawn when draw function is called
        this.points = points;
        this.polygon = null;

        //This only runs on the client, since the server has no need for stuff related to rendering
        if (!onServer) {

            //If this exceeds a certain value then this entity will be considered dead, as the deadFlag update from the server was likely missed
            this.timeSinceServerUpdate = 0;

            //These are actual color objects, which can't be sent between client and server, so they must be constructed on the client
            this.color        = new Color('oklch', colorVals.col, colorVals.a);
            this.outlineColor = new Color('oklch', outlineColVals.col, outlineColVals.a);
            this.healthBGCol =  new Color('srgb', [0, 0, 0], 1);
            this.healthCol =    new Color('srgb', [0, 1, 0], 1);

            //If there are no points then simply use a basic circle and don't construct a polygon
            if (this.points.length > 0) this.polygon = new Polygon({points: this.points, outlineThickness: this.outlineThickness});
        }

        this.type = type;
        this.isOnServer = onServer; //This must be given a different name than onServer so that it doesn't get overwritten by emit updates from server
        this.id = id ? String(id) : Entity.#makeid(5);
    }
    
    serverUpdate({
        position,
        velocity,
        acceleration,
        lookTarget,
        deadFlag,
        health,
        score
    } = {}) {

        //This update should be sent by server to client, not other way around
        if (this.isOnServer) return;

        this.timeSinceServerUpdate = 0;

        if (position !== null) {
            this.positionError.x = position.x - this.position.x;
            this.positionError.y = position.y - this.position.y;
        }

        if (score !== null) this.score = score;
        if (velocity !== null) this.velocity = velocity;
        if (acceleration !== null) this.acceleration = acceleration;
        if (lookTarget !== null) this.lookTarget = lookTarget;
        if (deadFlag !== null) this.deadFlag = deadFlag;
        if (health !== null) this.health = health;
    }

    //This should be used instead of externally modifying health variable
    damage(amount) {
        this.health -= amount;
        this.healthRegenTimer = 0;
        if (this.health <= 0) {
            this.deadFlag = true;
            this.health = 0;
        }
    }

    //Framerate independent physics update
    update(deltaTime, roomSize) {

        //Makes sure values are valid numbers
        deltaTime         = Entity.#fixNumbers(deltaTime);
        this.position     = Entity.#fixNumbers(this.position);
        this.velocity     = Entity.#fixNumbers(this.velocity);
        this.acceleration = Entity.#fixNumbers(this.acceleration);
        this.rotation     = Entity.#fixNumbers(this.rotation);

        if (!this.isOnServer) {
            this.timeSinceServerUpdate += deltaTime;
            if (this.timeSinceServerUpdate > Entity.UPDATE_TIMEOUT) this.deadFlag = true;
        }

        //Update target radius based on score if entity is a player
        if (this.type == Entity.types.PLAYER)
            this.targetRadius = this.baseRadius * (1 + 0.12 * Math.log(this.score * 0.15 + 1));

        //Smoothly change radius
        //This must happen before destroy animation so it does not interfere with radius lerp during destruction
        this.radius += this.deltaRadius / 2;
        this.deltaRadius = this.radiusChangeFactor * (this.targetRadius - this.radius) * deltaTime;
        if (this.deltaRadius > 0 && this.deltaRadius > this.targetRadius - this.radius) this.deltaRadius = this.targetRadius - this.radius;
        if (this.deltaRadius < 0 && this.deltaRadius < this.targetRadius - this.radius) this.deltaRadius = this.targetRadius - this.radius;
        this.radius += this.deltaRadius / 2;

        //Destroy animation
        if (this.deadFlag) {
            this.canCollide = false;
            this.acceleration = {x: 0, y: 0};
            this.fadeTimer += deltaTime;

            if (!this.isOnServer) {
                this.color.alpha        = 1 - this.fadeTimer / this.fadeLength;
                this.outlineColor.alpha = 1 - this.fadeTimer / this.fadeLength;
                this.radius = this.targetRadius * (1 + this.fadeGrowFactor * this.fadeTimer / this.fadeLength);
            }

            if (this.fadeTimer > this.fadeLength) this.removeFlag = true;
        } else {
            this.canCollide = true;

            if (!this.isOnServer) {
                this.color.alpha = 1;
                this.outlineColor.alpha = 1;
            }
        }

        //Linear Motion
        //--------------------------------------------------------------
        this.position.x += this.velocity.x * deltaTime * 0.5;
        this.position.y += this.velocity.y * deltaTime * 0.5;

        this.velocity.x += this.acceleration.x * deltaTime;
        this.velocity.y += this.acceleration.y * deltaTime;

        this.velocity.x *= 1 / (1 + this.linearDrag * deltaTime);
        this.velocity.y *= 1 / (1 + this.linearDrag * deltaTime);

        this.position.x += this.velocity.x * deltaTime * 0.5;
        this.position.y += this.velocity.y * deltaTime * 0.5;   
        
        //Position Correction
        const correctionFactor = Math.min(Entity.POSITION_CORRECTION_SPEED * deltaTime, 1);
        this.position.x += this.positionError.x * correctionFactor;
        this.position.y += this.positionError.y * correctionFactor;
        this.positionError.x -= this.positionError.x * correctionFactor;
        this.positionError.y -= this.positionError.y * correctionFactor;
        //--------------------------------------------------------------


        //Rotational Motion
        //-------------------------------------------------------------------
        this.rotation += this.rotationalVelocity * deltaTime * 0.5;

        this.rotationalVelocity += this.rotationalAcceleration * deltaTime;
        this.rotationalVelocity *= 1 / (1 + this.rotationalDrag * deltaTime);

        this.rotation += this.rotationalVelocity * deltaTime * 0.5;

        if (this.rotation > Math.PI)
            this.rotation -= Math.PI * 2;

        if (this.rotation < -Math.PI)
            this.rotation += Math.PI * 2;
        //-------------------------------------------------------------------

        //Look at target
        //-------------------------------------------------------------------
        let targetRot = Math.atan2(this.lookTarget.y - this.position.y, this.lookTarget.x - this.position.x);

        if (Math.abs(targetRot + Math.PI * 2 - this.rotation) < Math.abs(targetRot - this.rotation))
            targetRot += Math.PI * 2;

        if (Math.abs(targetRot - Math.PI * 2 - this.rotation) < Math.abs(targetRot - this.rotation))
            targetRot -= Math.PI * 2;

        const rotDisplacement = targetRot - this.rotation;
        this.rotationalAcceleration = rotDisplacement * this.lookForce;
        //-------------------------------------------------------------------

        //Room boundaries push the entity back in
        const boundaryDst = roomSize / 2;
        if (this.position.x - this.radius < -boundaryDst) this.velocity.x += Entity.BOUNDARY_PUSH_POWER * Math.sqrt(Entity.BOUNDARY_PUSH_DST_FACTOR * (-boundaryDst - (this.position.x - this.radius))) * deltaTime;
        if (this.position.y - this.radius < -boundaryDst) this.velocity.y += Entity.BOUNDARY_PUSH_POWER * Math.sqrt(Entity.BOUNDARY_PUSH_DST_FACTOR * (-boundaryDst - (this.position.y - this.radius))) * deltaTime;
        if (this.position.x + this.radius > boundaryDst) this.velocity.x -=  Entity.BOUNDARY_PUSH_POWER * Math.sqrt(Entity.BOUNDARY_PUSH_DST_FACTOR * (this.position.x + this.radius - boundaryDst)) * deltaTime;
        if (this.position.y + this.radius > boundaryDst) this.velocity.y -=  Entity.BOUNDARY_PUSH_POWER * Math.sqrt(Entity.BOUNDARY_PUSH_DST_FACTOR * (this.position.y + this.radius - boundaryDst)) * deltaTime;


        //Health Regeneration
        if (this.healthRegenTimer < this.healthRegenDelay)
            this.healthRegenTimer += deltaTime;
        else {
            this.health += this.healthRegenSpeed * deltaTime;
            if (this.health > this.maxHealth)
                this.health = this.maxHealth;
        }

        if (!this.isOnServer) {
            
            //Smoothly change health display
            this.healthDisplay += this.deltaHealthDisp / 2;
            this.deltaHealthDisp = this.deltaHealthFactor * (this.health - this.healthDisplay) * deltaTime;
            if (this.deltaHealthDisp > 0 && this.deltaHealthDisp > this.health - this.healthDisplay) this.deltaHealthDisp = this.health - this.healthDisplay;
            if (this.deltaHealthDisp < 0 && this.deltaHealthDisp < this.health - this.healthDisplay) this.deltaHealthDisp = this.health - this.healthDisplay;
            this.healthDisplay += this.deltaHealthDisp / 2;

            const showHealth = this.healthDisplay + 0.01 < this.maxHealth;

            if (showHealth) {
                this.healthBGCol.alpha = 1 - ((1 - this.healthBGCol.alpha) / (1 + Entity.HEALTH_FADE_IN_SPEED * deltaTime));
                this.healthCol.alpha   = 1 - ((1 - this.healthCol.alpha)   / (1 + Entity.HEALTH_FADE_IN_SPEED * deltaTime));
            } else {
                this.healthBGCol.alpha *= 1 / (1 + Entity.HEALTH_FADE_OUT_SPEED * deltaTime);
                this.healthCol.alpha   *= 1 / (1 + Entity.HEALTH_FADE_OUT_SPEED * deltaTime);
            }

            if (this.deadFlag) {
                this.healthBGCol.alpha = this.color.alpha;
                this.healthCol.alpha = this.color.alpha;
            }
        }
    }

    draw(ctx, camera) {

        let adjustedPosition = camera.worldToScreen(this.position);
        let adjustedRadius = (this.radius - this.outlineThickness / 2) * camera.zoom;
        if (adjustedRadius < 0) adjustedRadius = 0;

        if (this.polygon)
            this.polygon.draw({ctx: ctx, camera: camera, scale: this.radius / this.baseRadius, pos: this.position, rot: this.rotation, color: this.color, outlineColor: this.outlineColor});
        else {

            ctx.fillStyle = this.color;
            ctx.strokeStyle = this.outlineColor;
            ctx.lineWidth = this.outlineThickness * camera.zoom;
    
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

        //Draw Health Bar
        //---------------------------------------------------------------------------------------
        ctx.lineCap = "round";
        ctx.strokeStyle = this.healthBGCol;
        ctx.lineWidth = 8 * camera.zoom

        const healthYPos = adjustedPosition.y + adjustedRadius + ctx.lineWidth;
        const healthXOffset = adjustedRadius * 0.9;
        const healthLeft = adjustedPosition.x - healthXOffset;
        const healthRight = adjustedPosition.x + healthXOffset;
        const healthWidth = healthRight - healthLeft;

        ctx.beginPath();
        ctx.moveTo(healthLeft, healthYPos);
        ctx.lineTo(healthRight, healthYPos);
        ctx.stroke();
        ctx.closePath();

        ctx.strokeStyle = this.healthCol;
        ctx.lineWidth = 4 * camera.zoom

        ctx.beginPath();
        ctx.moveTo(healthLeft, healthYPos);
        ctx.lineTo(healthLeft + healthWidth * (this.healthDisplay / this.maxHealth), healthYPos);
        ctx.stroke();
        ctx.closePath();
        //---------------------------------------------------------------------------------------
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
}