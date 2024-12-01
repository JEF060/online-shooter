import EntityTemplates from '../public/entityTemplates.js';
import Entity          from '../public/classes/entity.js';
import Room            from '../public/classes/room.js';
import Polygon         from '../public/classes/polygon.js';

console.log();
console.log('-----------------------');
console.log('| Server Initializing |');
console.log('-----------------------');
console.log();

import {fileURLToPath} from 'url';
import {dirname} from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//Socket.io setup
//-----------------------------------------------------------------------
import express from 'express'
const app = express();
import http from 'http'
const server = http.createServer(app);
import { Server } from 'socket.io'
import Cannon from '../public/classes/cannon.js';
const io = new Server(server, {pingInterval: 10000, pingTimeout: 20000});
app.use(express.static(__dirname + '/../public'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + 'index.html');
});
//-----------------------------------------------------------------------

const LISTEN_PORT = 3000;
const TICKS_PER_SECOND = 60;
const TICKS_PER_CLIENT_UPDATE = 3;
const TICK_INTERVAL = 1 / TICKS_PER_SECOND;
const ENTITY_TEMPLATES = EntityTemplates.templates;
const SHAPE_TEMPLATES = ENTITY_TEMPLATES.shapes;
const VALID_ROOM_IDS = ['room1', 'room2', 'room3']; //Used for validation so clients can't join rooms that shouldn't exist
const ROOM_SIZE = 4096;
const MAX_NAME_LENGTH = 11;

const users = new Map(); //Map {Key: user id, Value: user information {roomID, canvasSize: {x, y}}}
const rooms = new Map(); //Map {Key: room id, Value: room object}

let ticksSinceClientUpdate = 0;
let lastTime = process.hrtime();

//Server listens for connections on a specified port
server.listen(LISTEN_PORT, () => {
    console.log('listening on port ' + LISTEN_PORT);
});

//Fired when a new user connects to the server
io.on('connection', (socket) => {
    const userID = socket.id; //ID of the current user
    users.set(userID, {roomID: null, canvasSize: {x: 0, y: 0}});

    console.log(userID + ' connected');

    //Used for calculating ping
    socket.on('ping', (callback) => {callback();});

    socket.on('request join room', (joinRoomID, username) => {
        if (!VALID_ROOM_IDS.includes(joinRoomID)) return;

        const verifiedUsername = username.slice(0, MAX_NAME_LENGTH);

        socket.join(joinRoomID); //Moves their socket to corresponding socket.io room
        users.get(userID).roomID = joinRoomID; //Update their room in user data

        if (!rooms.has(joinRoomID))
            createNewRoom(joinRoomID);

        //Create an entity for the player and add it to the room
        const hue = Math.random() * 360;
        const projectile = new Entity({type: Entity.types.PROJECTILE, onServer: true, baseRadius: 6, lifetime: 1.5, maxHealth: 0.25, healthRegenDelay: 99, contactDamage: 20, mass: 0.1, growIn: false, colorVals: {col: [.71, 0.14, hue], a: 1}, outlineColVals: {col: [.45, 0.14, hue], a: 1}});
        const cannon = new Cannon({onServer: true, rotation: Math.PI, points: Cannon.createPoints(Cannon.TYPES.BASIC, {width: 12, length: 16}), projectile: projectile, interval: 1, shootSpeed: 100, recoil: 4, shootSpread: 0.05, length: 16});
        const projectile2 = new Entity({shooting: true, cannon: cannon, type: Entity.types.PROJECTILE, onServer: true, rotationalVelocity: Math.PI * 0, linearDrag: 1, baseRadius: 11, lifetime: 8, maxHealth: 0.5, healthRegenDelay: 99, contactDamage: 50, mass: 0.2, growIn: false, colorVals: {col: [.71, 0.14, hue], a: 1}, outlineColVals: {col: [.45, 0.14, hue], a: 1}});
        const cannon2 = new Cannon({onServer: true, points: Cannon.createPoints(Cannon.TYPES.BASIC, {width: 22, length: 42}), projectile: projectile2, interval: 0.65, shootSpeed: 300, recoil: 1, shootSpread: 0.05, length: 42});
        const playerEntity = new Entity({type: Entity.types.PLAYER, onServer: true, id: userID, name: verifiedUsername, cannon: cannon2, baseRadius: 24, maxHealth: 11, healthRegenSpeed: 5, healthRegenDelay: 3, contactDamage: 1, linearDrag: 10, rotationalDrag: 60, lookForce: 1200, colorVals: {col: [.71, 0.14, hue], a: 1}, outlineColVals: {col: [.45, 0.14, hue], a: 1}, outlineThickness: 4});
        rooms.get(joinRoomID).addEntity(playerEntity);

        socket.emit('room joined', joinRoomID, username); //Used to send verification back to the specific client that requested to join
        console.log(userID + ' joined ' + joinRoomID);
    });

    socket.on('disconnect', () => {

        //If the user was in a room, then they are removed from that room
        if (users.get(userID).roomID) {
            const roomID = users.get(userID).roomID;
            const room = rooms.get(roomID);

            socket.emit('room left');
            socket.leave(roomID); //Removes their socket from the socket.io room

            if (room) room.killPlayer(userID)

            if (room.getNumberOfPlayers() <= 0) {
                rooms.delete(roomID);
                console.log('Deleted room \'' + roomID + '\'');
            }
        }
        
        users.delete(userID);
        console.log(userID + ' disconnected');
    });

    socket.on('update input', (inputUpdates) => {

        if (!users.has(userID)) return;
        const roomID = users.get(userID).roomID;

        if (!rooms.has(roomID)) return;
        const room = rooms.get(roomID);

        if (!room.hasEntity(userID)) return;
        const playerEntity = room.getEntity(userID);

        //Mouse click input
        if (inputUpdates.mouseDown != null)
            playerEntity.shooting = inputUpdates.mouseDown;

        //Wasd input
        if (inputUpdates.x != null && inputUpdates.y != null) {

            //Normalizes input to prevent cheating
            const inputMag = Math.sqrt(inputUpdates.x * inputUpdates.x + inputUpdates.y * inputUpdates.y);
            if (inputMag != 0) {
                inputUpdates.x /= inputMag;
                inputUpdates.y /= inputMag;
            }

            playerEntity.acceleration.x = inputUpdates.x * Entity.PLAYER_BASE_SPEED;
            playerEntity.acceleration.y = inputUpdates.y * Entity.PLAYER_BASE_SPEED;
        }

        //Mouse position input (influences rotation)
        if (inputUpdates.mouseWorldPosX != null && inputUpdates.mouseWorldPosY != null) {
            playerEntity.lookTarget = {x: inputUpdates.mouseWorldPosX, y: inputUpdates.mouseWorldPosY};
        }
    });

    socket.on('resize canvas', (canvasSize) => {
        users.get(userID).canvasSize = canvasSize;
    });
});

function update(deltaTime) {
    for (const room of rooms.values()) {
        room.updateEntities(deltaTime, users);
    }
}

function updateClients() {

    //Iterate over each user
    for (const [userId, userInfo] of users.entries()) {

        //Verify user is in a room
        if (!userInfo.roomID) continue;
        const roomID = userInfo.roomID;

        //Verify room exists
        if (!rooms.has(roomID)) continue;
        const room = rooms.get(roomID);

        //Update position of user in user info
        if (room.hasEntity(userId))
            userInfo.position = room.getEntity(userId).position;

        const arr = Room.toArray(room.getEntitiesInViewportOfPlayer(userId), userId);

        io.to(userId).emit('client update', {entities: arr, roomSize: room.size});
    }
}

function tick() {
    const currentTime = process.hrtime();
    let deltaTime = (currentTime[0] - lastTime[0]) + (currentTime[1] - lastTime[1]) / 1e9;
  
    if (deltaTime >= TICK_INTERVAL) {
    
        update(deltaTime);
    
        ticksSinceClientUpdate++;
    
        if (ticksSinceClientUpdate >= TICKS_PER_CLIENT_UPDATE) {
            updateClients();
            ticksSinceClientUpdate = 0;
        }
      
        lastTime = currentTime;
    }

    setImmediate(tick);
}

//Gets a random attribute from an object
function getRandomAttribute(obj) {
    const keys = Object.keys(obj);
    const randomIndex = Math.floor(Math.random() * keys.length);
    const randomKey = keys[randomIndex];
    return {key: randomKey, value: obj[randomKey]};
}

//Sets up a new room and populates it with shapes
function createNewRoom(id) {
    const room = new Room({id: id, onServer: true, size: ROOM_SIZE});

    for (let i = 0; i < 150; i++) {
        let shapeData = getRandomAttribute(SHAPE_TEMPLATES).value;
        const points = Polygon.createRegularPolygon({sides: shapeData.sides, radius: shapeData.baseRadius, rotationalVelocity: Math.random() * 2 - 1, });
        shapeData = Object.assign({}, shapeData, {type: Entity.types.SHAPE, owner: null, contactDamage: 10, maxHealth: Math.random(), healthRegenDelay: 0.5, onServer: true, position: {x: Math.random() * room.size - room.size / 2, y: Math.random() * room.size - room.size / 2}, rotation: Math.random() * 6.28, rotationalVelocity: Math.random() * 2 - 1, points: points, outlineThickness: 4});
        const shape = new Entity(shapeData);

        room.addEntity(shape);
    }

    console.log('Created room \'' + id + '\'');
    rooms.set(id, room);
}
  
tick();