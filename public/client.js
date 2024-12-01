import Room from "./classes/room.js";
import Camera from "./classes/camera.js";
import Queue from "./classes/queue.js"
import Entity from "./classes/entity.js";

const socket = io();

const play_interface = document.getElementById('play-interface');
const playInterfaceDisplay = play_interface.style.display; //Used to show UI when user leaves room
const play_button = document.getElementById('play-button');
const gamemode_select = document.getElementById('gamemode-select');
const username_input = document.getElementById('username-input');

const respawn_interface = document.getElementById('respawn-interface');
const respawnInterfaceDisplay = respawn_interface.style.display;
const respawn_button = document.getElementById('respawn-button');
const back_button = document.getElementById('back-button');
respawn_interface.style.display = 'none';

const fpsText = document.getElementById('fps');
const pingText = document.getElementById('ping');
const playersText = document.getElementById('players');
const entitiesText = document.getElementById('entities');

let localRoomID = null; //The room the client is currently in; null means no room
let localRoom = new Room(); //Keeps track of all the players in the same room as the client
let localPlayerEntity = null;
let playerDied = false;
let hadPlayer = false;
let username = '';

//Used for drawing to screen
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const camera = new Camera({zoom: 1, followSpeed: 4, zoomSpeed: 1.5});

resizeCanvas();
camera.setCenterPos({x: 0, y: 0}, canvas);

//Used for keeping track of mouse information
let mousePos = {x: 0, y: 0}
let mouseWorldPos = {x: 0, y: 0}
let lastMouseWorldPos = {x: 0, y: 0}
let mouseDown = false;
let lastMouseDown = false;

//Used for calculating delta time
let deltaTime;
let oldTimeStamp = 0;

//Used for calculating average fps over a set period of time
const fpsQueue = new Queue();

//{Key: key, Value: bool pressed}
var pressedKeys = {};

//Used for sending input changes to server
const INPUT_UPDATES_PER_SECOND = 30;
const INPUT_UPDATE_INTERVAL = 1 / INPUT_UPDATES_PER_SECOND;
let inputUpdates = {};
let inputUpdateTimer = 0;
let lastInput = {x: 0, y: 0}

//Request to join room when play button clicked
play_button.addEventListener('click', () => {
    socket.emit('request join room', gamemode_select.value, username_input.value);
});

respawn_button.addEventListener('click', () => {
    socket.emit('request join room', localRoomID, username);
});

back_button.addEventListener('click', () => {
    play_interface.style.display = playInterfaceDisplay;
    respawn_interface.style.display = 'none';
});

//Fired to confirm that room was joined successfully
socket.on('room joined', (roomID, name) => {

    localRoomID = roomID;
    username = name;
    play_interface.style.display = 'none';
    respawn_interface.style.display = 'none';

    console.log('Joined ' + roomID);
});

//Fired when player leaves room
socket.on('room left', () => {

    localRoomID = null;
    localRoom = new Room();
    play_interface.style.display = playInterfaceDisplay;

    console.log('Left ' + localRoomID);
});

//Fired to sync the entire room state
socket.on('client update', (args) => {

    localRoom.fromArray(args.entities);
    localRoom.size = args.roomSize;

    localPlayerEntity = localRoom.hasEntity(socket.id) ? localRoom.getEntity(socket.id) : null;
});

//Used for finding ping
setInterval(() => {
    const start = Date.now();
  
    socket.emit("ping", () => {
      const duration = Date.now() - start;
      pingText.textContent = "ping: " + Math.round(duration) + "ms";
    });
}, 1000);

function drawGrid(color, spacing, width) {
    ctx.lineWidth = width;

    for (let i = (camera.position.x * camera.zoom) % (spacing * camera.zoom); i < canvas.width; i += spacing * camera.zoom) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
        ctx.closePath();
    }

    for (let i = (camera.position.y * camera.zoom) % (spacing * camera.zoom); i < canvas.height; i += spacing * camera.zoom) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
        ctx.closePath();
    }
}

function drawBoundaries(color, boundDst) {
    ctx.fillStyle = color;

    const left   = camera.worldToScreen({x: -boundDst, y: 0}).x;
    const right  = camera.worldToScreen({x: boundDst, y: 0}).x;
    const top    = camera.worldToScreen({x: 0, y: -boundDst}).y;
    const bottom = camera.worldToScreen({x: 0, y: boundDst}).y;

    ctx.beginPath();
    ctx.rect(0, 0, left, canvas.height);
    ctx.rect(canvas.width, 0, right - canvas.width, canvas.height);
    ctx.rect(left, 0, right - left, top);
    ctx.rect(left, canvas.height, right - left, bottom - canvas.height);

    ctx.fill();
    ctx.closePath();
}

function draw() {
    ctx.fillStyle = new Color('oklch', [.975, 0, 0], 1);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid(new Color('oklch', [.8, 0, 0], 1), 32, 1);
    drawBoundaries(new Color('srgb', [0, 0, 0], 0.15), localRoom.size / 2);
    
    if (localPlayerEntity) localPlayerEntity.drawLayer = 0;
    localRoom.drawEntities(ctx, camera, canvas);
}

function gameLoop(timeStamp) {
    deltaTime = (timeStamp - oldTimeStamp) / 1000;
    deltaTime = isNaN(deltaTime) ? 0 : deltaTime;

    fpsQueue.enqueue(deltaTime);
    fpsQueue.capTotal(1);
    fpsText.textContent = "fps: " + Math.round(1 / (fpsQueue.getTotal() / fpsQueue.getLength()));

    if (deltaTime > 1/20) deltaTime = 1/20;

    localRoom.updateEntities(deltaTime, camera, canvas);

    camera.update(deltaTime, canvas);

    playersText.textContent = "players: " + localRoom.getNumberOfPlayers();
    entitiesText.textContent = "entities: " + localRoom.getNumberOfEntities();

    if (localPlayerEntity) {

        camera.setTargetZoom(canvas, (!localPlayerEntity.deadFlag ? localPlayerEntity.targetRadius : Entity.DEAD_PLAYER_RADIUS) / localPlayerEntity.baseRadius);
        camera.setCenterTarget(localPlayerEntity.position);

        mouseWorldPos = camera.screenToWorld(mousePos);

        if (mouseDown != lastMouseDown) {
            inputUpdates.mouseDown = mouseDown;
        }
        lastMouseDown = mouseDown;

        //Calculates vector to move along based on wasd input, normalizes it, and raises update input flag if wasd vector input has changed
        const input = {x: keyPressed("d") - keyPressed("a"), y: keyPressed("s") - keyPressed("w")};
        const inputMag = Math.sqrt(input.x * input.x + input.y * input.y);
        if (inputMag != 0) {
            input.x /= inputMag;
            input.y /= inputMag;
        }

        if (input.x != lastInput.x || input.y != lastInput.y) {
            inputUpdates.x = parseFloat(input.x.toFixed(3));
            inputUpdates.y = parseFloat(input.y.toFixed(3));
        }

        //Only send mouse position to server if it has moved to reduce data sent
        if (mouseWorldPos.x != lastMouseWorldPos.x || mouseWorldPos.y != lastMouseWorldPos.y) {
            inputUpdates.mouseWorldPosX = Math.round(mouseWorldPos.x);
            inputUpdates.mouseWorldPosY = Math.round(mouseWorldPos.y);
            lastMouseWorldPos = mouseWorldPos;
        }

        localPlayerEntity.acceleration.x = input.x * Entity.PLAYER_BASE_SPEED;
        localPlayerEntity.acceleration.y = input.y * Entity.PLAYER_BASE_SPEED;
        localPlayerEntity.lookTarget = mouseWorldPos;

        lastInput = structuredClone(input);
    }

    if (localPlayerEntity && !localPlayerEntity.deadFlag) {
        hadPlayer = true
        playerDied = false;
    } else if (hadPlayer) {
        playerDied = true;
        hadPlayer = false;
    }

    if (playerDied) {
        respawn_interface.style.display = respawnInterfaceDisplay;
        
        playerDied = false;
    }

    inputUpdateTimer += deltaTime;
    if (Object.keys(inputUpdates).length > 0 && inputUpdateTimer >= INPUT_UPDATE_INTERVAL) {
        socket.emit('update input', inputUpdates);
        inputUpdateTimer = 0;
        inputUpdates = {};
    }

    draw();

    oldTimeStamp = timeStamp;
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    socket.emit('resize canvas', {x: canvas.width, y: canvas.height});
}

//Updates canvas if window is refreshed or the size is changed
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

//Used to update mouse information
addEventListener('mousedown',   ()      => { mouseDown = true; });
addEventListener('mouseup',     ()      => { mouseDown = false; });
addEventListener('mousemove',   (event) => { mousePos = {x: event.clientX, y: event.clientY}; });

//Used for keeping track of keyboard input
document.addEventListener('keydown', (event) => { pressedKeys[event.key] = true; });
document.addEventListener('keyup', (event) => { pressedKeys[event.key] = false; });
function keyPressed(code) { if (pressedKeys[code] != null) { return pressedKeys[code]; } else { return false; } }

gameLoop();