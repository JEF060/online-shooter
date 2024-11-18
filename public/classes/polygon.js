export default class Polygon {
    constructor({
        points = [],
        outlineThickness = 4
    } = {}) {
        this.points = points;
        this.shrunkPoints = Polygon.#shrinkPoints(points, outlineThickness / 2);
        this.outlineThickness = outlineThickness;
    }

    draw({ctx, camera, scale, pos, rot, color, outlineColor} = {}) {
        Polygon.drawPolygon({ctx: ctx, camera: camera, scale: scale, pos: pos, rot: rot, points: this.shrunkPoints, color: color, outlineColor: outlineColor, outlineThickness: this.outlineThickness});
    }

    static drawPolygon({ctx, camera, scale, pos, rot, points, color, outlineColor, outlineThickness} = {}) {

        ctx.fillStyle = color;
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = outlineThickness * camera.zoom;

        ctx.lineCap = "round";
        ctx.lineJoin = 'round';
        
        const r = {x: Math.cos(rot), y: Math.sin(rot)};
        let point = this.#multiplyComplex({x: points[0].x, y: points[0].y}, r);
        let screenPos = camera.worldToScreen({x: pos.x + point.x * scale, y: pos.y + point.y * scale});

        //Trace out the path of the polygon
        //---------------------------------------------------------------------------------------------
        ctx.beginPath();
        ctx.moveTo(screenPos.x, screenPos.y);

        for (let i = 1; i < points.length; i++) {
            point = this.#multiplyComplex({x: points[i].x, y: points[i].y}, r);
            screenPos = camera.worldToScreen({x: pos.x + point.x * scale, y: pos.y + point.y * scale});
            ctx.lineTo(screenPos.x, screenPos.y)
        }

        point = this.#multiplyComplex({x: points[0].x, y: points[0].y}, r);
        screenPos = camera.worldToScreen({x: pos.x + point.x * scale, y: pos.y + point.y * scale});
        ctx.lineTo(screenPos.x, screenPos.y);
        //---------------------------------------------------------------------------------------------

        ctx.fill();
        ctx.stroke();
        ctx.closePath();
    }

    //Helps with construction of new polygons so that points don't have to be entered manually
    static createRegularPolygon({sides, radius} = {}) {
        let points = [];

        for (let i = 0, rot = 0; i < Math.ceil(sides); i++, rot += Math.PI * 2 / sides) {
            points.push({x: radius * Math.cos(rot), y: radius * Math.sin(rot)});
        }

        return points;
    }

    //Helper function used to do math involving rotations during drawing
    static #multiplyComplex(p, r) {
        return {x: p.x * r.x - p.y * r.y, y: p.y * r.x + p.x * r.y};
    }

    //Helper function that finds magnitude of vector
    static #findMag(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }

    //Moves points of polygon inwards towards center so that outline thickness does to increase perceived size
    static #shrinkPoints(points, r) {
        let newPoints = new Array(points.length);

        for (let i = 0; i < points.length; i++) {
            const currentPoint = points[i];
            const previousPoint = points[(i + points.length - 1) % points.length];
            const nextPoint = points[(i + 1) % points.length];

            //Find unit vector that points towards next point in polgon
            let previousVector = {x: previousPoint.x - currentPoint.x, y: previousPoint.y - currentPoint.y};
            const previousVectorMag = Polygon.#findMag(previousVector);
            previousVector = {x: previousVector.x / previousVectorMag, y: previousVector.y / previousVectorMag};

            //Find unit vector that points towards previous point in polygon
            let nextVector = {x: nextPoint.x - currentPoint.x, y: nextPoint.y - currentPoint.y}
            const nextVectorMag = Polygon.#findMag(nextVector);
            nextVector = {x: nextVector.x / nextVectorMag, y: nextVector.y / nextVectorMag};

            let pushVector = {x: previousVector.x + nextVector.x, y: previousVector.y + nextVector.y};
            const pushVectorMag = Polygon.#findMag(pushVector);
            pushVector = {x: r * pushVector.x / pushVectorMag, y: r * pushVector.y / pushVectorMag};

            newPoints[i] = {x: currentPoint.x + pushVector.x, y: currentPoint.y + pushVector.y};
        }

        return newPoints;
    }
}