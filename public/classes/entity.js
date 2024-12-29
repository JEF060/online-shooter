import Cannon from "./cannon.js";
import Polygon from "./polygon.js";

export default class Entity {

    static UPDATE_TIMEOUT = 1; //If the entity hasn't been updated in this time, then it is assumed to be dead
    static POSITION_CORRECTION_SPEED = 3;
    static BOUNDARY_PUSH_POWER = 600;
    static BOUNDARY_PUSH_DST_FACTOR = 0.25;
    static HEALTH_FADE_IN_SPEED = 30;
    static HEALTH_FADE_OUT_SPEED = 15;
    static DEAD_PLAYER_ZOOM_FACTOR = 6;

    static MAX_TOTAL_SKILL_POINTS = 35;
    static MAX_POINTS_PER_SKILL = 7;

    static SKILL_INFO = [
        {name: 'healthRegen', color: 'health-regen-color'},
        {name: 'maxHealth', color: 'max-health-color'},
        {name: 'bodyDmg', color: 'body-damage-color'},
        {name: 'bulletSpeed', color: 'bullet-speed-color'},
        {name: 'bulletHealth', color: 'bullet-health-color'},
        {name: 'bulletDmg', color: 'bullet-damage-color'},
        {name: 'reload', color: 'reload-color'},
        {name: 'movementSpeed', color: 'movement-speed-color'}
    ];

    static types = Object.freeze({
        NONSPECIFIED: 0,
        PLAYER: 1,
        SHAPE: 2,
        PROJECTILE: 3
    });

    constructor({
        score = 0,
        level = 0,
        lifetime = null,
        shooting = false,
        shootingSecondary = false,
        position = {x: 0, y: 0},
        positionError = {x: 0, y: 0},
        velocity = {x: 0, y: 0},
        deltaV = {x: 0, y: 0},
        acceleration = {x: 0, y: 0},
        linearDrag = 0,
        rotation = 0,
        rotationalVelocity = 0,
        rotationalAcceleration = 0,
        rotationalDrag = 0,
        lookTarget = {x: 0, y: 0},
        lookForce = 0,
        canCollide = true,
        baseRadius = 0,
        targetRadius = 0,
        growIn = true,
        pushForce = 1,
        mass = 1,
        contactDamage = 1,
        maxHealth = 1,
        health = null,
        healthRegenSpeed = 1,
        healthRegenDelay = 10,
        showHealth = true,
        deadFlag = false,
        id,
        owner = null,
        name = null,
        type = 0,
        onServer = false,
        points = [],
        cannons = [],
        drawLayer = 1,
        colorVals = {col: [0, 0, 0], a: 1},
        outlineColVals = {col: [0, 0, 0], a: 1},
        outlineThickness = 4
    } = {}) {
        this.score = score;
        this.level = level;
        this.lifetime = lifetime;
        this.lifeTimer = lifetime;

        this.position = position;
        this.positionError = positionError;
        this.velocity = velocity;
        this.deltaV = deltaV;
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
        this.targetRadius = targetRadius ? targetRadius : baseRadius;
        this.deltaRadius = 0;
        this.radiusChangeFactor = 8;
        this.radius = 0;
        this.growIn = growIn;

        //This marks the entity for removal, at which point it will fade out and then be removed
        this.deadFlag = deadFlag;
        this.removeFlag = false;
        this.fadeTimer = 0;
        this.fadeLength = 0.12;
        this.fadeGrowFactor = 0.25;

        this.drawLayer = drawLayer;
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
            this.healthBGCol =  new Color('srgb', [0.15, 0.15, 0.15], 0);
            this.healthCol =    new Color('srgb', [0.1, 1, 0.1], 0);

            //If there are no points then simply use a basic circle and don't construct a polygon
            if (this.points.length > 0) this.polygon = new Polygon({points: this.points, outlineThickness: this.outlineThickness});
        }

        if (onServer) {
            this.shooting = shooting; //Only server is responsible for shooting cannons
            this.shootingSecondary = shootingSecondary;
            this.fullBroadcastPlayerIDs = []; //Stores a list of player ids that have received the full update package. They are removed from the list if the entity leaves the player's viewport
        }

        this.type = type;
        this.isOnServer = onServer; //This must be given a different name than onServer so that it doesn't get overwritten by emit updates from server
        this.name = name;
        this.id = id ? String(id) : Entity.#makeid(5);
        this.owner = owner;

        this.cannons = cannons;
        for (let i = 0; i < this.cannons.length; i++) {
            this.cannons[i] = new Cannon({onServer: onServer, ...this.cannons[i]});

            if (this.owner == null)
                this.cannons[i].projectile.owner = this.id;
            else
                this.cannons[i].projectile.owner = this.owner;
        }

        this.skillPointsAvailable = 0;
        this.skillPointsUsed = 0;

        this.skills = {};
        for (let i = 0; i < Entity.SKILL_INFO.length; i++) {
            this.skills[Entity.SKILL_INFO[i].name] = {
                level: 0,
                completion: 0
            }
        }
    }

    //Returns an object full of all information about the entity that would need to be transmitted from server to client
    getFullUpdatePackage() {
        let cannons = [];
        for (const cannon of this.cannons)
            cannons.push(cannon.getFullUpdatePackage());

        return {
            score: this.score,
            level: this.level,
            lifetime: this.lifetime,
            position: this.position,
            positionError: this.positionError,
            velocity: this.velocity,
            deltaV: this.deltaV,
            acceleration: this.acceleration,
            linearDrag: this.linearDrag,
            rotation: this.rotation,
            rotationalVelocity: this.rotationalVelocity,
            rotationalAcceleration: this.rotationalAcceleration,
            rotationalDrag: this.rotationalDrag,
            lookTarget: this.lookTarget,
            lookForce: this.lookForce,
            canCollide: this.canCollide,
            baseRadius: this.baseRadius,
            targetRadius: this.targetRadius,
            growIn: this.growIn,
            pushForce: this.pushForce,
            mass: this.mass,
            contactDamage: this.contactDamage,
            maxHealth: this.maxHealth,
            health: this.health,
            healthRegenSpeed: this.healthRegenSpeed,
            healthRegenDelay: this.healthRegenDelay,
            showHealth: this.showHealth,
            deadFlag: this.deadFlag,
            id: this.id,
            owner: this.owner,
            name: this.name,
            type: this.type,
            points: this.points,
            cannons: cannons,
            drawLayer: this.drawLayer,
            colorVals: this.colorVals,
            outlineColVals: this.outlineColVals,
            outlineThickness: this.outlineThickness,
            skills: this.skills
        };
    }

    //Returns only information that needs to be updated
    getPartialUpdatePackage() {
        let cannonData = [];
        for (let i = 0; i < this.cannons.length; i++)
            cannonData[i] = this.cannons[i].getPartialUpdatePackage();

        return {
            score: this.score,
            level: this.level,
            position: this.position,
            velocity: this.velocity,
            acceleration: this.acceleration,
            lookTarget: this.lookTarget,
            health: this.health,
            maxHealth: this.maxHealth,
            deadFlag: this.deadFlag,
            cannonData: cannonData,
            id: this.id,
            skills: this.skills
        };
    }

    createClone(onServer) {
        let data = this.getFullUpdatePackage();
        data.id = null;
        data.onServer = onServer;
        data.lifetime = this.lifetime;
        data.shooting = this.shooting;
        data.shootingSecondary = this.shootingSecondary;
        data.deltaV = {x: 0, y: 0};

        return new Entity(data);
    }
    
    serverUpdate({
        position,
        velocity,
        acceleration,
        lookTarget,
        deadFlag,
        cannonData,
        health,
        maxHealth,
        score,
        level,
        skills
    } = {}) {

        //This update should be sent by server to client, not other way around
        if (this.isOnServer) return;

        this.timeSinceServerUpdate = 0;

        if (position !== null) {
            this.positionError.x = position.x - this.position.x;
            this.positionError.y = position.y - this.position.y;
        }

        if (cannonData) for (let i = 0; i < cannonData.length; i++)
            this.cannons[i].serverUpdate(cannonData[i]);

        if (score !== null) this.score = score;
        if (level !== null) this.level = level;
        if (velocity !== null) this.velocity = velocity;
        if (acceleration !== null) this.acceleration = acceleration;
        if (lookTarget !== null) this.lookTarget = lookTarget;
        if (deadFlag !== null) this.deadFlag = deadFlag;
        if (health !== null) this.health = health;
        if (maxHealth !== null) this.maxHealth = maxHealth;
        if (skills !== null) this.skills = skills;
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

        if (this.isOnServer && (this.lifetime != null)) {
            this.lifeTimer -= deltaTime;
            if (this.lifeTimer <= 0)
                this.deadFlag = true;
        }

        //Used for testing
        if (this.boostScore)
            this.score += 10000 * deltaTime;

        for (const cannon of this.cannons)
            cannon.update(deltaTime);

        //Used for delivering recoil over time instead of instantaneous
        //-----------------------------------------------------------------------------------------
        const deltaVFractionFactor = 200; //Bigger number means it takes longer for deltaV to be applied
        const deltaVFraction = 1 / (1 + deltaVFractionFactor * deltaTime);

        this.velocity.x += this.deltaV.x * deltaVFraction;
        this.deltaV.x -= this.deltaV.x * deltaVFraction;
        this.velocity.y += this.deltaV.y * deltaVFraction;
        this.deltaV.y -= this.deltaV.y * deltaVFraction;
        //-----------------------------------------------------------------------------------------

        //Smoothly change radius
        //This must happen before destroy animation so it does not interfere with radius lerp during destruction
        if (this.growIn) {
            this.radius += this.deltaRadius / 2;
            this.deltaRadius = this.radiusChangeFactor * (this.targetRadius - this.radius) * deltaTime;
            if (this.deltaRadius > 0 && this.deltaRadius > this.targetRadius - this.radius) this.deltaRadius = this.targetRadius - this.radius;
            if (this.deltaRadius < 0 && this.deltaRadius < this.targetRadius - this.radius) this.deltaRadius = this.targetRadius - this.radius;
            this.radius += this.deltaRadius / 2;
        } else
            this.radius = this.targetRadius;

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
            this.health += this.healthRegenSpeed * this.maxHealth * deltaTime;
            if (this.health > this.maxHealth)
                this.health = this.maxHealth;
        }

        for (const [skillName, skillData] of Object.entries(this.skills)) {
            skillData.completion = skillData.level / Entity.MAX_POINTS_PER_SKILL;
        }

        if (!this.isOnServer) {
            
            //Smoothly change health display
            this.healthDisplay += this.deltaHealthDisp / 2;
            this.deltaHealthDisp = this.deltaHealthFactor * (this.health - this.healthDisplay) * deltaTime;
            if (this.deltaHealthDisp > 0 && this.deltaHealthDisp > this.health - this.healthDisplay) this.deltaHealthDisp = this.health - this.healthDisplay;
            if (this.deltaHealthDisp < 0 && this.deltaHealthDisp < this.health - this.healthDisplay) this.deltaHealthDisp = this.health - this.healthDisplay;
            this.healthDisplay += this.deltaHealthDisp / 2;

            const showHealth = this.healthDisplay < this.maxHealth * 0.99;

            if (showHealth) {
                this.healthBGCol.alpha = 1 - ((1 - this.healthBGCol.alpha) / (1 + Entity.HEALTH_FADE_IN_SPEED * deltaTime));
                this.healthCol.alpha   = 1 - ((1 - this.healthCol.alpha)   / (1 + Entity.HEALTH_FADE_IN_SPEED * deltaTime));
            } else {
                this.healthBGCol.alpha *= 1 / (1 + Entity.HEALTH_FADE_OUT_SPEED * deltaTime);
                this.healthCol.alpha   *= 1 / (1 + Entity.HEALTH_FADE_OUT_SPEED * deltaTime);
            }

            if (this.deadFlag && showHealth) {
                this.healthBGCol.alpha = this.color.alpha;
                this.healthCol.alpha = this.color.alpha;
            }
        }
    }

    draw(ctx, camera) {

        const scale = this.radius / this.baseRadius;

        for (let i = 0; i < this.cannons.length; i++)
            this.cannons[i].draw(ctx, camera, scale, this.position, this.rotation, this.color.alpha);

        if (this.polygon)
            this.polygon.draw({ctx: ctx, camera: camera, scale: scale, pos: this.position, rot: this.rotation, color: this.color, outlineColor: this.outlineColor});
        else {

            let adjustedPosition = camera.worldToScreen(this.position);
            let adjustedRadius = (this.radius - this.outlineThickness / 2) * camera.zoom;
            if (adjustedRadius < 0) adjustedRadius = 0;

            ctx.fillStyle = this.color;
            ctx.strokeStyle = this.outlineColor;
            ctx.lineWidth = this.outlineThickness * camera.zoom;
    
            ctx.beginPath();
            ctx.arc(adjustedPosition.x, adjustedPosition.y, adjustedRadius, 0, Math.PI * 2, false);
            ctx.fill();
            ctx.stroke();
            ctx.closePath();
        }
    }

    drawHealth(ctx, camera) {

        if (!this.showHealth) return;

        let adjustedPosition = camera.worldToScreen(this.position);
        let adjustedRadius = (this.radius - this.outlineThickness / 2) * camera.zoom;
        if (adjustedRadius < 0) adjustedRadius = 0;

        ctx.lineCap = "round";
        ctx.strokeStyle = this.healthBGCol;
        ctx.lineWidth = Math.max(8 * Math.sqrt(camera.zoom), 4)

        const healthYPos = adjustedPosition.y + adjustedRadius + ctx.lineWidth;
        const healthXOffset = adjustedRadius * 0.8;
        const healthLeft = adjustedPosition.x - healthXOffset;
        const healthRight = adjustedPosition.x + healthXOffset;
        const healthWidth = healthRight - healthLeft;

        ctx.beginPath();
        ctx.moveTo(healthLeft, healthYPos);
        ctx.lineTo(healthRight, healthYPos);
        ctx.stroke();
        ctx.closePath();

        ctx.strokeStyle = this.healthCol;
        ctx.lineWidth *= 0.5

        ctx.beginPath();
        ctx.moveTo(healthLeft, healthYPos);
        ctx.lineTo(healthLeft + healthWidth * (this.healthDisplay / this.maxHealth), healthYPos);
        ctx.stroke();
        ctx.closePath();
    }

    drawName(ctx, camera) {
        if (!this.name) return;

        let adjustedPosition = camera.worldToScreen(this.position);
        let adjustedRadius = (this.radius - this.outlineThickness / 2) * camera.zoom;
        if (adjustedRadius < 0) adjustedRadius = 0;

        const fontSize = Math.max(3.5 * Math.sqrt(adjustedRadius) + 2, 12);

        ctx.fillStyle = new Color('oklch', [1, 0, 0], this.color.alpha);
        ctx.strokeStyle = new Color('oklch', [0.35, 0, 0], this.color.alpha);
        ctx.lineWidth = fontSize * 0.2;
        ctx.font = `500 ${fontSize}px Poppins`;
        ctx.letterSpacing = "0.5px";
        ctx.textAlign = 'center';
        
        const namePos = {x: adjustedPosition.x, y: adjustedPosition.y - adjustedRadius - fontSize};

        ctx.beginPath();
        ctx.strokeText(this.name, namePos.x, namePos.y);
        ctx.fillText(this.name, namePos.x, namePos.y);
        ctx.closePath();
    }

    shoot() {
        if (this.deadFlag) return null;

        let projectiles = [];

        for (const cannon of this.cannons) {
            if (cannon.secondary) {
                if (!this.shootingSecondary) continue;
            } else {
                if (!this.shooting) continue;
            }

            const shootData = cannon.shoot(this.position, this.rotation, this.radius / this.baseRadius, 1 - 0.5 * this.skills['reload'].completion, 1 + 1.5 * this.skills['bulletSpeed'].completion);
            
            if (shootData) {

                shootData.projectile.contactDamage *= this.levelDmgFactor * (1 + 2 * this.skills['bulletDmg'].completion);
                shootData.projectile.maxHealth *= 1 + 2 * this.skills['bulletHealth'].completion;
                shootData.projectile.health = shootData.projectile.maxHealth;

                projectiles.push(shootData.projectile);

                this.deltaV.x += shootData.recoil.x;
                this.deltaV.y += shootData.recoil.y;
    
                shootData.projectile.drawLayer = this.drawLayer + 1;
            }
        }
        
        return projectiles;
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