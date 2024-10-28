import Camera from "./camera.js";

export default class Polygon {
    constructor({
        points = [],
        outlineThickness = 4
    } = {}) {
        this.points = points;
        this.outlineThickness = outlineThickness;
    }

    //Helps with construction of new polygons so that points don't have to be entered manually
    static createRegularPolygon({sides, radius} = {}) {
        let points = [];

        for (let i = 0, rot = 0; i < sides; i++, rot += Math.PI * 2 / sides) {
            points.push({x: radius * Math.cos(rot), y: radius * Math.sin(rot)});
        }

        return points;
    }

    //Helper function used to do math involving rotations during drawing
    static #multiplyComplex(p, r) {
        return {x: p.x * r.x - p.y * r.y, y: p.y * r.x + p.x * r.y};
    }

    static drawPolygon({ctx, camera, pos, rot, points, color, outlineColor, outlineThickness} = {}) {

        ctx.fillStyle = color;
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = outlineThickness;

        ctx.lineCap = "round";
        ctx.lineJoin = 'round';
        
        const r = {x: Math.cos(rot), y: Math.sin(rot)};
        let point = this.#multiplyComplex({x: points[0].x, y: points[0].y}, r);
        let screenPos = camera.worldToScreen({x: pos.x + point.x, y: pos.y + point.y});

        //Trace out the path of the polygon
        //---------------------------------------------------------------------
        ctx.beginPath();
        ctx.moveTo(screenPos.x, screenPos.y);

        for (let i = 1; i < points.length; i++) {
            point = this.#multiplyComplex({x: points[i].x, y: points[i].y}, r);
            screenPos = camera.worldToScreen({x: pos.x + point.x, y: pos.y + point.y});
            ctx.lineTo(screenPos.x, screenPos.y)
        }

        point = this.#multiplyComplex({x: points[0].x, y: points[0].y}, r);
        screenPos = camera.worldToScreen({x: pos.x + point.x, y: pos.y + point.y});
        ctx.lineTo(screenPos.x, screenPos.y);
        //---------------------------------------------------------------------


        ctx.fill();
        ctx.stroke();
        ctx.closePath()
    }

    draw({ctx, camera, pos, rot, color, outlineColor} = {}) {
        Polygon.drawPolygon({ctx: ctx, camera: camera, pos: pos, rot: rot, points: this.points, color: color, outlineColor: outlineColor, outlineThickness: this.outlineThickness});
    }
}