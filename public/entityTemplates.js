export default class EntityTemplates {
    static templates = {
        shapes: {
            triangle: {score: 10, sides: 3, baseRadius: 24, linearDrag: 2, pushForce: 0.5,  mass: 0.5,  colorVals: {col: [.71, 0.14, 15], a: 1},  outlineColVals: {col: [.46, 0.14, 15],  a: 1}},
            square:   {score: 20, sides: 4, baseRadius: 32, linearDrag: 2, pushForce: 0.75, mass: 0.75, colorVals: {col: [.87, 0.15, 105], a: 1}, outlineColVals: {col: [.52, 0.15, 105], a: 1}},
            pentagon: {score: 80, sides: 5, baseRadius: 40, linearDrag: 2, pushForce: 1,    mass: 1,    colorVals: {col: [.70, 0.14, 240], a: 1}, outlineColVals: {col: [.45, 0.14, 240], a: 1}},
            hexagon:  {score: 160, sides: 6, baseRadius: 48, linearDrag: 2, pushForce: 1.25, mass: 1.25, colorVals: {col: [.71, 0.14, 140], a: 1}, outlineColVals: {col: [.46, 0.14, 140], a: 1}},
            septagon: {score: 640, sides: 7, baseRadius: 56, linearDrag: 2, pushForce: 1.5,  mass: 1.5,  colorVals: {col: [.71, 0.14, 330], a: 1}, outlineColVals: {col: [.46, 0.14, 330], a: 1}},
        }
    };
}