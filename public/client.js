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

const hud = document.getElementById('hud');
const hudDisplay = hud.style.display;
const username_text = document.getElementById('username-text');
const score_text = document.getElementById('score-text');
const progress_fill = document.getElementById('progress-fill');
const level_text = document.getElementById('level-text');
hud.style.display = 'none';

const respawn_interface = document.getElementById('respawn-interface');
const respawnInterfaceDisplay = respawn_interface.style.display;
const respawn_button = document.getElementById('respawn-button');
const back_button = document.getElementById('back-button');
respawn_interface.style.display = 'none';


const MAX_POINTS_PER_SKILL = Entity.MAX_POINTS_PER_SKILL;

const skill_menu = document.getElementById('skill-menu');
const skill_menu_hover_area = document.getElementById('skill-menu-hover-area');
const skill_bars = skill_menu.getElementsByClassName('skill-bar');

const points_available_text = document.getElementById('points-available-text');
const points_used_text = document.getElementById('points-used-text');

let pointsAvailable = 0;
let lastPointsAvailable = 0;

for (let i = 0; i < skill_bars.length; i++) {

    const skill_bar = skill_bars[i];
    const upgrade_btn = skill_bar.querySelector(".upgrade-button");
    const skill_area = skill_bar.querySelector(".skill-left").querySelector(".skill-area");

    const color = Entity.SKILL_INFO[i].color;
    
    upgrade_btn.addEventListener('click', function(event) {

        if (!localPlayerEntity)
            return;

        if (!localPlayerEntity.skillPointsAvailable > 0)
            return;

        if (skill_area.childElementCount >= MAX_POINTS_PER_SKILL)
            return;

        socket.emit('upgrade skill', {skillName: Entity.SKILL_INFO[i].name});

        localPlayerEntity.skillPointsAvailable--;
        localPlayerEntity.skillPointsUsed++;
        localPlayerEntity.skills[Entity.SKILL_INFO[i].name].level++;

        const newSegment = document.createElement("div");
        const skillAreaStyle = window.getComputedStyle(skill_area);

        newSegment.style.width = 'calc(' + (100 / Entity.MAX_POINTS_PER_SKILL) + '% - ' + skillAreaStyle.gap + ')';
        newSegment.classList.add("skill-segment");
        newSegment.classList.add(color);
        if (skill_area.childElementCount == 0)
            newSegment.classList.add("left-rounded"); 

        skill_area.append(newSegment);

        updateSkillPointsText();

        if (skill_area.childElementCount >= MAX_POINTS_PER_SKILL) 
            upgradeButtonMakeUnselectable();
    });
    
    upgrade_btn.addEventListener("mouseover", function(event) {
        if (skill_area.childElementCount >= MAX_POINTS_PER_SKILL)
            return;

        if (!localPlayerEntity || localPlayerEntity && (localPlayerEntity.skillPointsAvailable <= 0)) {
            upgradeButtonMakeUnselectable();
            return;
        }

        //Creates a temporary element in order to access the original color of the upgrade button
        const tempElement = document.createElement('div');
        tempElement.classList.add(color);
        document.body.appendChild(tempElement);
        const tempStyle = window.getComputedStyle(tempElement);
        document.body.removeChild(tempElement);

        upgrade_btn.style.filter = "brightness(120%)";
        upgrade_btn.style.cursor = "pointer";
        upgrade_btn.style.backgroundColor = tempStyle.color;
    });
    
    upgrade_btn.addEventListener("mouseout", upgradeButtonUnhover);

    function upgradeButtonUnhover() {
        upgrade_btn.style.filter = "brightness(100%)";
        upgrade_btn.style.cursor = "auto";
    }

    function upgradeButtonMakeUnselectable() {
        upgradeButtonUnhover();
        
        upgrade_btn.style.backgroundColor = 'rgb(148, 148, 148)';
    }
}

function updateSkillPointsText() {
    const pointsAvailable = localPlayerEntity ? localPlayerEntity.skillPointsAvailable : 0;
    points_available_text.textContent = pointsAvailable + ' point' + (pointsAvailable != 1 ? 's' : '') + ' available';

    const pointsUsed = localPlayerEntity ? localPlayerEntity.skillPointsUsed : 0;
    points_used_text.textContent = 'Points used: ' + pointsUsed + '/' + Entity.MAX_TOTAL_SKILL_POINTS;
}

let skillMenuHovered = false;

skill_menu_hover_area.addEventListener('mouseover', (e) => {
    skillMenuHovered = true;
});

skill_menu_hover_area.addEventListener('mouseout', (e) => {
    skillMenuHovered = false;
});


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
let mouseRightDown = false;
let lastMouseRightDown = false;

let lastNDown = false;

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
    hud.style.display = hudDisplay;
    username_text.textContent = username;

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

function drawMinimap({sideLength, margin, opacity}) {
    ctx.fillStyle = new Color('oklch', [0.9, 0, 0], opacity);
    ctx.strokeStyle = new Color('oklch', [0.6, 0, 0], opacity);
    ctx.lineWidth = 6;

    const startPos = {
        x: canvas.width - sideLength - margin,
        y: canvas.height - sideLength - margin
    };

    ctx.save();

    ctx.beginPath();
    ctx.rect(startPos.x, startPos.y, sideLength, sideLength);
    ctx.clip();
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
    
    ctx.fillStyle = new Color('oklch', [0.75, 0, 0], opacity);

    ctx.beginPath();
    ctx.rect(startPos.x + ((-2 * camera.position.x + localRoom.size) / (2 * localRoom.size)) * sideLength, startPos.y + ((-2 * camera.position.y + localRoom.size) / (2 * localRoom.size)) * sideLength, canvas.width / camera.zoom / (localRoom.size) * sideLength, canvas.height / camera.zoom / (localRoom.size) * sideLength);
    ctx.fill();
    ctx.closePath();

    if (localPlayerEntity) {
        ctx.fillStyle = new Color('oklch', [0, 0, 0], 1);
        ctx.beginPath();
        const radius = 2;
        ctx.arc(startPos.x + ((2 * localPlayerEntity.position.x + localRoom.size) / (2 * localRoom.size)) * sideLength, startPos.y + ((2 * localPlayerEntity.position.y + localRoom.size) / (2 * localRoom.size)) * sideLength, radius, 0, 2 * Math.PI, false);    
        ctx.fill();
        ctx.closePath();
    }

    ctx.restore();
}

function draw() {
    ctx.fillStyle = new Color('oklch', [.975, 0, 0], 1);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid(new Color('oklch', [.8, 0, 0], 1), 32, 1);
    drawBoundaries(new Color('srgb', [0, 0, 0], 0.15), localRoom.size / 2);
    
    if (localPlayerEntity) {
        localPlayerEntity.drawLayer = 0;
        localPlayerEntity.name = null;
    }
    localRoom.drawEntities(ctx, camera, canvas);

    drawMinimap({sideLength: 180, margin: 16, opacity: 0.5});
}

function increaseLevelProgress(amount) {
    let tempLevel = Math.floor(levelProgress);
    levelProgress += amount;

    if (Math.floor(levelProgress) != tempLevel && Math.floor(levelProgress) < Math.floor(targetLevelProgress))
        levelProgress += Math.floor(targetLevelProgress) - Math.floor(levelProgress);
}

function gameLoop(timeStamp) {
    deltaTime = (timeStamp - oldTimeStamp) / 1000;
    deltaTime = isNaN(deltaTime) ? 0 : deltaTime;

    fpsQueue.enqueue(deltaTime);
    fpsQueue.capTotal(1);
    fpsText.textContent = "fps: " + Math.round(1 / (fpsQueue.getTotal() / fpsQueue.getLength()));

    if (deltaTime > 1/20) deltaTime = 1/20;

    localRoom.updateEntities(deltaTime, camera, canvas);

    if (localPlayerEntity)
        pointsAvailable = localPlayerEntity.skillPointsAvailable;

    camera.update(deltaTime, canvas);

    playersText.textContent = "players: " + localRoom.getNumberOfPlayers();
    entitiesText.textContent = "entities: " + localRoom.getNumberOfEntities();
    updateSkillPointsText();

    if (pointsAvailable <= 0 && !skillMenuHovered) {
        skill_menu.style.transitionDelay = '0.5s';
        skill_menu.style.transitionDuration = '0.65s';
        skill_menu.style.transitionTimingFunction = 'ease-in';
        skill_menu.style.left = 'calc(-16px - ' + window.getComputedStyle(skill_menu).width + ')';
    } else {
        skill_menu.style.transitionDelay = '0s';
        skill_menu.style.transitionDuration = '0.4s';
        skill_menu.style.transitionTimingFunction = 'ease-out';
        skill_menu.style.left = '16px';
    }

    if (pointsAvailable != lastPointsAvailable) {

        if (pointsAvailable <= 0) {
            points_available_text.style.transitionDelay = '0.5s';
            points_available_text.style.transitionDuration = '0.5s';
            points_available_text.style.opacity = '0%';
        } else {
            points_available_text.style.transitionDelay = '0s';
            points_available_text.style.transitionDuration = '0s';
            points_available_text.style.opacity = '100%';
        }

        for (let i = 0; i < skill_bars.length; i++) {

            const skill_bar = skill_bars[i];
            const upgrade_btn = skill_bar.querySelector(".upgrade-button");
            const skill_area = skill_bar.querySelector(".skill-left").querySelector(".skill-area");
        
            const color = Entity.SKILL_INFO[i].color;

            if (pointsAvailable <= 0) {

                upgrade_btn.style.filter = "brightness(100%)";
                upgrade_btn.style.cursor = "auto";
                upgrade_btn.style.backgroundColor = 'rgb(148, 148, 148)';

            } else if (skill_area.childElementCount < MAX_POINTS_PER_SKILL) {

                //Creates a temporary element in order to access the original color of the upgrade button
                const tempElement = document.createElement('div');
                tempElement.classList.add(color);
                document.body.appendChild(tempElement);
                const tempStyle = window.getComputedStyle(tempElement);
                document.body.removeChild(tempElement);
                
                upgrade_btn.style.backgroundColor = tempStyle.color;
            }
        }
    }

    lastPointsAvailable = localPlayerEntity ? localPlayerEntity.skillPointsAvailable : -1;

    if (localPlayerEntity) {

        score_text.textContent = 'Score: ' + Math.floor(localPlayerEntity.score);
        progress_fill.style.width = (((localPlayerEntity.level - Math.floor(localPlayerEntity.level)) % 1) * 100) + '%';
        level_text.textContent = 'Level ' + Math.floor(localPlayerEntity.level);

        camera.setTargetZoom(canvas, !localPlayerEntity.deadFlag ? localPlayerEntity.targetRadius / localPlayerEntity.baseRadius : Entity.DEAD_PLAYER_ZOOM_FACTOR);
        camera.setCenterTarget(localPlayerEntity.position);

        mouseWorldPos = camera.screenToWorld(mousePos);

        if (mouseDown != lastMouseDown)
            inputUpdates.mouseDown = mouseDown;
        lastMouseDown = mouseDown;

        if (mouseRightDown != lastMouseRightDown)
            inputUpdates.mouseRightDown = mouseRightDown;
        lastMouseRightDown = mouseRightDown;

        const nDown = keyPressed("n");
        if (nDown != lastNDown)
            inputUpdates.boostScore = nDown;
        lastNDown = nDown;

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

        localPlayerEntity.acceleration.x = input.x * localPlayerEntity.movementSpeed * (1 + 0.75 * localPlayerEntity.skills['movementSpeed'].completion);
        localPlayerEntity.acceleration.y = input.y * localPlayerEntity.movementSpeed * (1 + 0.75 * localPlayerEntity.skills['movementSpeed'].completion);
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
        hud.style.display = 'none';
        playerDied = false;

        //Remove all of the skill segments from the upgrade area
        for (let i = 0; i < skill_bars.length; i++) {
            const skill_bar = skill_bars[i];
            const skill_area = skill_bar.querySelector(".skill-left").querySelector(".skill-area");

            skill_area.innerHTML = '';
        }
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
//----------------------------------------
addEventListener('mousedown', (event) => {
    if (event.button == 0)
        mouseDown = true;
    
    if (event.button == 2)
        mouseRightDown = true;
});

addEventListener('mouseup', (event) => {
    if (event.button == 0)
        mouseDown = false;
    
    if (event.button == 2)
        mouseRightDown = false;
});

addEventListener('mousemove', (event) => {
    mousePos = {
        x: event.clientX,
        y: event.clientY
    };
});
//----------------------------------------

//Used for keeping track of keyboard input
//-----------------------------------------------
document.addEventListener('keydown', (event) => {

    if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '-' || event.key === '=')) {
        event.preventDefault();
    }

    pressedKeys[event.key] = true;
});

document.addEventListener('keyup', (event) => {
    pressedKeys[event.key] = false;
});

function keyPressed(code) {
    if (pressedKeys[code] != null)
        return pressedKeys[code];
    else 
        return false;
}
//-----------------------------------------------

// Prevent the right-click menu on the canvas
document.addEventListener('contextmenu', event => event.preventDefault());

//Prevent zooming
document.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
        event.preventDefault();
    }
}, { passive: false });

gameLoop();