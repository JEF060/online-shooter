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
const ROOM_SIZE = 6144;
const MAX_NAME_LENGTH = 15;

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
        const projectile = new Entity({shooting: true, type: Entity.types.PROJECTILE, onServer: true, rotationalVelocity: Math.PI * 0, linearDrag: 0.1, baseRadius: 7.5, lifetime: 3, maxHealth: 0.1, healthRegenDelay: 99, contactDamage: 10, mass: 1, pushForce: 2, growIn: false, colorVals: {col: [.71, 0.14, hue], a: 1}, outlineColVals: {col: [.45, 0.14, hue], a: 1}});
        const cannon = new Cannon({onServer: true, points: Cannon.createPoints(Cannon.TYPES.BASIC, {width: 15, length: 28}), projectile: projectile, interval: 1, shootSpeed: 360, recoil: 1, shootSpread: 0.06, length: 28});
        const playerEntity = new Entity({type: Entity.types.PLAYER, onServer: true, id: userID, name: verifiedUsername, cannons: [cannon], baseRadius: 16, maxHealth: 3, contactDamage: 1, linearDrag: 10, rotationalDrag: 60, lookForce: 1200, colorVals: {col: [.71, 0.14, hue], a: 1}, outlineColVals: {col: [.45, 0.14, hue], a: 1}, outlineThickness: 4});
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

    socket.on('upgrade skill', (args) => {

        if (!users.has(userID)) return;
        const roomID = users.get(userID).roomID;

        if (!rooms.has(roomID)) return;
        const room = rooms.get(roomID);

        if (!room.hasEntity(userID)) return;
        const playerEntity = room.getEntity(userID);

        if (!playerEntity.skillPointsAvailable > 0)
            return;

        const skillName = args.skillName;

        playerEntity.skillPointsAvailable--;
        playerEntity.skillPointsUsed++;
        playerEntity.skills[skillName].level++;

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
        
        //Mouse right click input
        if (inputUpdates.mouseRightDown != null)
            playerEntity.shootingSecondary = inputUpdates.mouseRightDown;

        //Boost score for testing purposes
        if (inputUpdates.boostScore != null)
            playerEntity.boostScore = inputUpdates.boostScore;

        //Wasd input
        if (inputUpdates.x != null && inputUpdates.y != null) {

            //Normalizes input to prevent cheating
            const inputMag = Math.sqrt(inputUpdates.x * inputUpdates.x + inputUpdates.y * inputUpdates.y);
            if (inputMag != 0) {
                inputUpdates.x /= inputMag;
                inputUpdates.y /= inputMag;
            }

            playerEntity.acceleration.x = inputUpdates.x * playerEntity.movementSpeed * (1 + 0.75 * playerEntity.skills['movementSpeed'].completion);
            playerEntity.acceleration.y = inputUpdates.y * playerEntity.movementSpeed * (1 + 0.75 * playerEntity.skills['movementSpeed'].completion);
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

    for (let i = 0; i < 250; i++) {
        let shapeData = getRandomAttribute(SHAPE_TEMPLATES).value;
        const points = Polygon.createRegularPolygon({sides: shapeData.sides, radius: shapeData.baseRadius, rotationalVelocity: Math.random() * 2 - 1, });
        shapeData = Object.assign({}, shapeData, {type: Entity.types.SHAPE, owner: null, healthRegenSpeed: 0.25, onServer: true, position: {x: Math.random() * room.size - room.size / 2, y: Math.random() * room.size - room.size / 2}, rotation: Math.random() * 6.28, rotationalVelocity: Math.random() * 2 - 1, points: points, outlineThickness: 4});
        const shape = new Entity(shapeData);

        room.addEntity(shape);
    }

    console.log('Created room \'' + id + '\'');
    rooms.set(id, room);
}
  
tick();