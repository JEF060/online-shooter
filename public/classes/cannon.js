import Entity from "./entity.js";
import Polygon from "./polygon.js";

export default class Cannon {

    static TYPES = Object.freeze({
        BASIC: 0
    });

    constructor({
        onServer = false,
        points = [],
        projectile = null,
        shootSpread = 0,
        shootSpeed = 350,
        recoil = 0,
        interval = 0.5,
        timer = 0,
        position = {x: 0, y: 0},
        offset = {x: 0, y: 0},
        rotation = 0,
        length = 0,
        outlineThickness = 4,
    } = {}) {

        this.onServer = onServer;

        this.points = points;
        this.projectile = new Entity({onServer: onServer, ...projectile});
        this.shootSpread = shootSpread;
        this.shootSpeed = shootSpeed;
        this.recoil = recoil;
        this.interval = interval;
        this.timer = timer;
        this.position = position;
        this.offset = offset;
        this.rotation = rotation;
        this.length = length;
        this.outlineThickness = outlineThickness;
        
        if (!onServer)
            this.polygon = new Polygon({points: points, outlineThickness: outlineThickness});
    }

    static createPoints(type, params) {
        let points = [];

        if (type == Cannon.TYPES.BASIC) {
            points.push({x: 0,             y: params.width / 2});
            points.push({x: params.length, y: params.width / 2});
            points.push({x: params.length, y: -params.width / 2});
            points.push({x: 0,             y: -params.width / 2});
        }

        return points;
    }

    getFullUpdatePackage() {
        return {
            points: this.points,
            projectile: this.projectile.getFullUpdatePackage(),
            shootSpread: this.shootSpread,
            shootSpeed: this.shootSpeed,
            recoil: this.recoil,
            interval: this.interval,
            timer: this.timer,
            position: this.position,
            offset: this.offset,
            rotation: this.rotation,
            length: this.length,
            outlineThickness: this.outlineThickness
        }
    }

    getPartialUpdatePackage() {
        return {
            timer: this.timer
        }
    }

    serverUpdate({
        timer
    }) {
        if (timer) this.timer = timer;
    }

    update(deltaTime) {
        this.timer += deltaTime;
    }

    shoot(pos, rot, scale) {
        if (this.timer < this.interval) return null;
        this.timer = 0;
        
        const projectile = this.projectile.createClone(this.onServer);
        projectile.targetRadius *= scale;

        const direction = rot + this.rotation + this.shootSpread * Math.random() - this.shootSpread / 2;

        projectile.position = {
            x: pos.x + this.position.x + scale * (this.length - projectile.baseRadius) * Math.cos(direction) + scale * (this.offset.x * Math.cos(direction) - this.offset.y * Math.sin(direction)),
            y: pos.y + this.position.y + scale * (this.length - projectile.baseRadius) * Math.sin(direction) + scale * (this.offset.y * Math.cos(direction) + this.offset.x * Math.sin(direction))
        };
        
        projectile.velocity = {
            x: this.shootSpeed * Math.cos(direction),
            y: this.shootSpeed * Math.sin(direction)
        };

        projectile.rotation = direction;
        
        const shootData = {projectile: projectile, recoil: {x: -this.recoil * this.shootSpeed * Math.cos(direction), y: -this.recoil * this.shootSpeed * Math.sin(direction)}};
        return shootData;
    }

    draw(ctx, camera, scale, pos, rot, alpha) {
        const col = new Color('srgb', [0.7, 0.7, 0.7], alpha);
        const outlineCol = new Color('srgb', [0.5, 0.5, 0.5], alpha);
        this.polygon.draw({ctx: ctx, camera: camera, scale: scale, pos: {x: this.position.x + pos.x, y: this.position.y + pos.y}, offset: this.offset, rot: this.rotation + rot, color: col, outlineColor: outlineCol});
    }
}