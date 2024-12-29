export default class EntityTemplates {
    static templates = {
        shapes: {
            triangle: {maxHealth: 1, contactDamage: 1, score: 5, sides: 3, baseRadius: 24, linearDrag: 2, pushForce: 0.5,  mass: 0.5,  colorVals: {col: [.71, 0.14, 15], a: 1},  outlineColVals: {col: [.46, 0.14, 15],  a: 1}},
            square:   {maxHealth: 2, contactDamage: 2, score: 25, sides: 4, baseRadius: 32, linearDrag: 2, pushForce: 1, mass: 0.75, colorVals: {col: [.87, 0.15, 105], a: 1}, outlineColVals: {col: [.52, 0.15, 105], a: 1}},
            pentagon: {maxHealth: 4, contactDamage: 3, score: 150, sides: 5, baseRadius: 40, linearDrag: 2, pushForce: 1.5,    mass: 1,    colorVals: {col: [.70, 0.14, 240], a: 1}, outlineColVals: {col: [.45, 0.14, 240], a: 1}},
            hexagon:  {maxHealth: 6, contactDamage: 4, score: 500, sides: 6, baseRadius: 48, linearDrag: 2, pushForce: 2, mass: 1.25, colorVals: {col: [.71, 0.14, 140], a: 1}, outlineColVals: {col: [.46, 0.14, 140], a: 1}},
            septagon: {maxHealth: 8, contactDamage: 5, score: 3000, sides: 7, baseRadius: 56, linearDrag: 2, pushForce: 2.5,  mass: 1.5,  colorVals: {col: [.71, 0.14, 330], a: 1}, outlineColVals: {col: [.46, 0.14, 330], a: 1}},
        }
    };
}