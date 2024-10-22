import EntityList from "./classes/entityList.js";
import Camera from "./classes/camera.js";

const socket = io();

const play_interface = document.getElementById('play-interface');
const play_button = document.getElementById('play-button');
const gamemode_select = document.getElementById('gamemode-select');
const playInterfaceDisplay = play_interface.style.display; //Used to show UI when user leaves room

let localRoom = null; //The room the client is currently in; null means no room
let localEntityList = new EntityList(); //Keeps track of all the players in the same room as the client
let localPlayer = null;

//Used for drawing to screen
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const camera = new Camera({zoom: 1, followSpeed: 5});

//Used for keeping track of mouse information
let mousePos = {x: 0, y: 0}
let mouseWorldPos = {x: 0, y: 0}
let lastMouseWorldPos = {x: 0, y: 0}
let mouseDown = false;

//Used for calculating delta time
let deltaTime;
let oldTimeStamp = 0;

// { Key: key, Value: whether it is pressed or not}
var pressedKeys = {};

//Used for sending input changes to server
const INPUT_UPDATES_PER_SEC = 40;
const INPUT_UPDATE_INTERVAL = 1 / INPUT_UPDATES_PER_SEC;
let inputUpdates = {};
let inputUpdateTimer = 0;
let lastInput = {x: 0, y: 0}

//Request to join room when play button clicked
play_button.addEventListener('click', () => {
    socket.emit('request join room', gamemode_select.value);
});

//Fired to confirm that room was joined successfully
socket.on('room joined', (args) => {

    localRoom = args.room;
    play_interface.style.display = 'none';

    console.log('Joined ' + args.room);
});

//Fired when player leaves room
socket.on('room left', () => {

    console.log('Left ' + localRoom);

    localRoom = null;
    localEntityList = new EntityList();
    play_interface.style.display = playInterfaceDisplay;
});

//Fired to sync the entire room state
socket.on('client update', (entities) => {
    localEntityList.fromArray(entities);
    localPlayer = localEntityList.has(socket.id) ? localEntityList.get(socket.id) : null;
});

function drawGrid(color, spacing) {
    ctx.lineWidth = 1;

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

function draw() {
    ctx.fillStyle = new Color('oklch', [.975, 0, 0], 1);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid(new Color('oklch', [.8, 0, 0], 1), 32);
    
    localEntityList.drawEntities(ctx, camera);
}

function gameLoop(timeStamp) {
    deltaTime = (timeStamp - oldTimeStamp) / 1000;
    deltaTime = isNaN(deltaTime) ? 0 : deltaTime;

    localEntityList.updateEntities(deltaTime);

    if (localPlayer) {

        camera.setCenterTarget(canvas, localPlayer.position);
        camera.update(deltaTime);

        mouseWorldPos = camera.screenToWorld(mousePos);

        //Calculates vector to move along based on wasd input, normalizes it, and raises update input flag if wasd vector input has changed
        const input = {x: keyPressed("d") - keyPressed("a"), y: keyPressed("s") - keyPressed("w")};
        if (input.x != 0 && input.y != 0) {
            const inputMag = Math.sqrt(input.x * input.x + input.y * input.y);
            input.x /= inputMag;
            input.y /= inputMag;
        }

        if (input.x != lastInput.x || input.y != lastInput.y) {
            inputUpdates.x = parseFloat(input.x.toFixed(3));
            inputUpdates.y = parseFloat(input.y.toFixed(3));
        }

        //If the mouse has moved then it will be sent to server
        if (mouseWorldPos.x != lastMouseWorldPos.x || mouseWorldPos.y != lastMouseWorldPos.y) {
            inputUpdates.mouseWorldPosX = Math.floor(mouseWorldPos.x);
            inputUpdates.mouseWorldPosY = Math.floor(mouseWorldPos.y);
            lastMouseWorldPos = mouseWorldPos;
        }

        localPlayer.acceleration.x = input.x * 5000;
        localPlayer.acceleration.y = input.y * 5000;
        localPlayer.lookTarget = mouseWorldPos;

        lastInput = structuredClone(input);
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