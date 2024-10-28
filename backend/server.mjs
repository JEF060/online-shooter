import Entity from '../public/classes/entity.js';
import EntityList from '../public/classes/entityList.js';
import Polygon from '../public/classes/polygon.js';

console.log();
console.log('-----------------------');
console.log('| Server Initializing |');
console.log('-----------------------');
console.log();

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//Socket.io setup
import express from 'express'
const app = express();
import http from 'http'
const server = http.createServer(app);
import { Server } from 'socket.io'
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 });
app.use(express.static(__dirname + '/../public'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + 'index.html');
});

//Used for validation so clients can't join rooms that shouldn't exist
const validRooms = ['room1', 'room2', 'room3'];

//Stores all users and their current room for easy lookup
//This is used instead of socket.rooms because socket.rooms can have multiple rooms, which is unwanted
//Key: user id, Value: user information { room }
const users = new Map();

//This is used to keep track of the entities in each room
//Key: room name, Value: room contents { Key: user id, Value: entity}
const rooms = new Map();


//Fired when a new user connects to the server
io.on('connection', (socket) => {
    const id = socket.id; //ID of the current user
    users.set(id, {room: null}); //When users join they aren't in any room yet

    console.log(id + ' connected');

    //Fired when an existing user presses play to join the game
    socket.on('request join room', (roomToJoin) => {
        if (!validRooms.includes(roomToJoin)) return; //Validates room join request

        socket.join(roomToJoin); //Moves their socket to corresponding socket.io room
        users.set(id, {room: roomToJoin}); //Update their room

        //If the room the user wishes to join doesn't exist yet, then it is created
        if (!rooms.has(roomToJoin)) rooms.set(roomToJoin, new EntityList());

        //Create an entity for the player and add it to the room
        const radius = 32;
        const points = Polygon.createRegularPolygon({sides: 5, radius: radius});
        const playerEntity = new Entity({id: id, radius: radius, points: points, linearDrag: 10, rotationalDrag: 40, lookForce: 700, color: {col: [.71, 0.14, 240], a: 1}, outlineColor: {col: [.45, 0.14, 240], a: 1}, outlineThickness: 4});
        rooms.get(roomToJoin).set(id, playerEntity);

        socket.emit('room joined', { room: roomToJoin }); //Used to update the specific client that requested to join
        socket.emit('client update', rooms.get(roomToJoin).toArray()); //Syncs entire room state

        console.log(id + ' joined ' + roomToJoin);
    });

    //Fired when a user disconnects from the server
    socket.on('disconnect', () => {

        //If the user was in a room, then they are removed from that room
        if (users.get(id).room) {
            const room = users.get(id).room;

            socket.emit('room left');

            socket.leave(room); //Removes their socket from the socket.io room
            rooms.get(room).delete(id);

            //If after being removed the room is empty, the room is deleted
            if (rooms.get(room).getSize() == 0) rooms.delete(room);
        }
        
        users.delete(id);

        console.log(id + ' disconnected');
    });

    socket.on('update input', (inputUpdates) => {

        //If the user isn't in a room then we don't want to consider their input
        if (!users.get(id).room) return;

        const playerEntity = rooms.get(users.get(id).room).get(id);

        //Wasd input
        if (inputUpdates.x != null && inputUpdates.y != null) {

            //Normalizes input to prevent cheating
            if (inputUpdates.x != 0 && inputUpdates.y != 0) {
                const inputMag = Math.sqrt(inputUpdates.x * inputUpdates.x + inputUpdates.y * inputUpdates.y);
                inputUpdates.x /= inputMag;
                inputUpdates.y /= inputMag;
            }

            playerEntity.acceleration.x = inputUpdates.x * 5000;
            playerEntity.acceleration.y = inputUpdates.y * 5000;
        }

        //Mouse position input (influences rotation)
        if (inputUpdates.mouseWorldPosX != null && inputUpdates.mouseWorldPosY != null) {
            playerEntity.lookTarget = {x: inputUpdates.mouseWorldPosX, y: inputUpdates.mouseWorldPosY};
        }
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});

function update(dT) {
    for (const entityList of rooms.values()) {
        entityList.updateEntities(dT);
    }
}

function updateClients() {
    for (const [room, entityList] of rooms.entries()) {
        //Socket.io emits use JSON.stringify to compress data, but javascript maps can't be turned into json, so we turn it into an array
        io.to(room).emit('client update', entityList.toArray());
    }
}

const TICK_INTERVAL = 0.015;
const CLIENT_UDPATES_PER_SEC = 20;
let clientUpdateAccumulator = 0;

let lastTime = process.hrtime();

function tick() {
    const currentTime = process.hrtime();
    let deltaTime = (currentTime[0] - lastTime[0]) + (currentTime[1] - lastTime[1]) / 1e9;
  
    if (deltaTime >= TICK_INTERVAL) {
    
        update(deltaTime);
    
        clientUpdateAccumulator += deltaTime;
    
        if (clientUpdateAccumulator >= 1 / CLIENT_UDPATES_PER_SEC) {
            updateClients();
            clientUpdateAccumulator = 0;
        }
      
        lastTime = currentTime;
    }

    setImmediate(tick);
}
  
tick();