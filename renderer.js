const { ipcRenderer } = require('electron');
const MovementEngine = require('./movement');

// Logging helper — sends to main process which writes to file
function rlog(level, msg, data) {
  try { ipcRenderer.send('log-from-renderer', { level, source: 'renderer', message: msg, data }); } catch {}
}

const sprite = document.getElementById('pet-sprite');
const particlesContainer = document.getElementById('particles');
const groundShadow = document.getElementById('ground-shadow');

let state = 'idle'; // idle, walk, eat, happy, angry
let direction = 1; // 1 for right, -1 for left
let movementEngine = null; // instantiated below
let xOffset = 0; // Not used directly, we move window
let screenWidth = 1920; // Default, will update
let screenHeight = 1080;
let winWidth = 150;
let winHeight = 150;
let currentX = screenWidth / 2 - 75;
let currentY = screenHeight - 150;
let foodActive = false;
let foodTargetX = 0;
let cursorScreenX = null;
let cursorScreenY = null;

// Update screen bounds
ipcRenderer.invoke('get-screen-bounds').then(bounds => {
  screenWidth = bounds.width;
  screenHeight = bounds.height;
  currentX = screenWidth / 2 - 75;
  currentY = screenHeight - 150;
  ipcRenderer.send('set-position', { x: currentX, y: currentY });
});

// Toggle window click-through dynamically
const spriteWrapper = document.getElementById('sprite-wrapper');
if (spriteWrapper) {
  spriteWrapper.addEventListener('mouseenter', () => {
    ipcRenderer.send('set-ignore-mouse-events', false);
  });
  spriteWrapper.addEventListener('mouseleave', () => {
    ipcRenderer.send('set-ignore-mouse-events', true);
  });
}

let currentCharacter = 'Pikachu.gif';
let charSettings = { scale: 1.0, walking: true, flipped: false };

const BASE_SIZE = 100; // px - the "100%" reference size

const assets = {
  get idle() { return `characters/${currentCharacter}`; },
  get walk() { return `characters/${currentCharacter}`; },
  get eat() { return `characters/${currentCharacter}`; },
  get happy() { return `characters/${currentCharacter}`; },
  get angry() { return `characters/${currentCharacter}`; },
};

function applyCharSettings(cfg) {
  charSettings = { ...charSettings, ...cfg };
  let scale = Number(charSettings.scale);
  if (!Number.isFinite(scale) || scale <= 0) scale = 1.0;
  charSettings.scale = scale;
  
  const px = Math.max(30, Math.round(BASE_SIZE * scale));
  sprite.style.width = px + 'px';
  sprite.style.height = px + 'px';
  
  rlog('INFO', 'applyCharSettings', { scale, px, walking: charSettings.walking, flipped: charSettings.flipped });
  
  // Calculate required window size
  // Remove horizontal padding so the character can touch the screen edges without being blocked by invisible window borders
  const padH = 4;
  // Vertical padding tightened to ~15-20% (20px top for bounce, 10px bottom for shadow)
  const padTop = 20; 
  const padBot = 10; 
  const newWinW = px + padH;
  const newWinH = px + padTop + padBot;
  if (newWinW !== winWidth || newWinH !== winHeight) {
    const oldW = winWidth || 150;
    const oldH = winHeight || 150;
    winWidth = newWinW;
    winHeight = newWinH;
    currentX = Math.round(Number.isFinite(currentX) ? currentX + (oldW - winWidth) / 2 : (screenWidth - winWidth) / 2);
    currentY = Math.round(Number.isFinite(currentY) ? currentY + oldH - winHeight : screenHeight - winHeight);
    rlog('INFO', 'Window resized', { winWidth, winHeight, currentX, currentY });
    ipcRenderer.send('resize-window', { width: winWidth, height: winHeight, x: currentX, y: currentY });
  }
  
  // flipped is handled in setState via --facing
  // if walking just got disabled, snap to idle
  if (!charSettings.walking && state === 'walk') setState('idle');

  const walkStyle = charSettings.walkStyle || 'bounce';
  const movementType = charSettings.movementType || 'ground';
  const movementArea = charSettings.movementArea !== undefined ? Number(charSettings.movementArea) : 100;
  const speedMultiplier = charSettings.speedMultiplier !== undefined ? Number(charSettings.speedMultiplier) : 1.0;
  const pauseDuration = charSettings.pauseDuration !== undefined ? Number(charSettings.pauseDuration) : 2;
  const activityLevel = charSettings.activityLevel !== undefined ? Number(charSettings.activityLevel) : 50;
  const cursorReaction = charSettings.cursorReaction || 'ignore';
  const trail = charSettings.trail || 'none';
  const idleBehavior = charSettings.idleBehavior || 'static';

  const opacityVal = charSettings.opacity !== undefined ? Number(charSettings.opacity) : 100;
  sprite.style.opacity = (opacityVal / 100).toFixed(2);

  const shadowVal = charSettings.shadow || 'none';
  if (groundShadow) {
    if (shadowVal === 'ground') groundShadow.classList.add('active');
    else groundShadow.classList.remove('active');
  }
  if (spriteWrapper) {
    spriteWrapper.style.filter = shadowVal === 'drop' ? 'drop-shadow(0 10px 6px rgba(0,0,0,0.45))' : '';
  }

  if (movementEngine) {
    movementEngine.updateConfig({ walkStyle, movementType, movementArea, speedMultiplier, pauseDuration, activityLevel, cursorReaction, trail, idleBehavior });
  }
  updateFacing();
}

function updateFacing() {
  let facing;
  if (direction === -1) { // Moving Left
    facing = charSettings.flipped ? -1 : 1;
  } else { // Moving Right
    facing = charSettings.flipped ? 1 : -1;
  }
  document.documentElement.style.setProperty('--facing', facing);
}

sprite.src = assets.idle;
sprite.className = 'state-idle walk-style-bounce';

function setState(newState) {
  state = newState;
  const newSrc = assets[newState] || assets.idle;
  
  // Only update src if it changed to prevent the GIF from restarting/stuttering
  // sprite.src is an absolute URL in the browser, so we check if it ends with the newSrc
  if (!sprite.src.endsWith(newSrc)) {
    sprite.src = newSrc;
  }
  
  // Set animation class preserving walk style
  const walkStyle = charSettings.walkStyle || 'bounce';
  sprite.className = `state-${newState} walk-style-${walkStyle}`;
  
  updateFacing();
}

function showParticle(emoji) {
  const p = document.createElement('div');
  p.className = 'particle';
  p.textContent = emoji;
  const currentWidth = parseInt(sprite.style.width) || 100;
  p.style.left = Math.random() * (currentWidth / 2) + (currentWidth / 4) + 'px';
  p.style.top = '20px';
  particlesContainer.appendChild(p);
  setTimeout(() => p.remove(), 1500);
}

function spawnTrailParticle(emoji) {
  if (!particlesContainer) return;
  const p = document.createElement('div');
  p.className = 'trail-particle';
  p.textContent = emoji;
  const currentWidth = parseInt(sprite.style.width) || 100;
  p.style.left = (currentWidth / 2 - 10 + (Math.random() * 20 - 10)) + 'px';
  p.style.bottom = '5px';
  particlesContainer.appendChild(p);
  setTimeout(() => p.remove(), 1000);
}

function spawnSleepParticle() {
  if (!particlesContainer) return;
  const p = document.createElement('div');
  p.className = 'sleep-particle';
  p.textContent = Math.random() > 0.5 ? '💤' : 'Zzz...';
  const currentWidth = parseInt(sprite.style.width) || 100;
  p.style.left = (currentWidth / 2 + (Math.random() * 20 - 10)) + 'px';
  p.style.top = '10px';
  particlesContainer.appendChild(p);
  setTimeout(() => p.remove(), 2500);
}

let isDragging = false;
let hasDragged = false;
let startMouseScreenX = 0;
let startMouseScreenY = 0;
let startWindowX = 0;
let startWindowY = 0;

sprite.addEventListener('pointerdown', (e) => {
  isDragging = true;
  hasDragged = false;
  sprite.setPointerCapture(e.pointerId);
  if (state === 'walk') setState('idle');
  ipcRenderer.send('start-drag', { x: e.clientX, y: e.clientY });
});

sprite.addEventListener('pointermove', (e) => {
  if (isDragging) {
    hasDragged = true;
  }
});

sprite.addEventListener('pointerup', (e) => {
  isDragging = false;
  sprite.releasePointerCapture(e.pointerId);
  ipcRenderer.send('stop-drag');
  if (movementEngine && movementEngine.onDragEnd) {
    movementEngine.onDragEnd();
  }
});

ipcRenderer.on('sync-position', (event, [x, y]) => {
  currentX = x;
  currentY = y;
});

// Logic Loop handled by MovementEngine
movementEngine = new MovementEngine({
  isDragging: () => isDragging,
  getState: () => state,
  setState: (s) => setState(s),
  getDirection: () => direction,
  setDirection: (d) => { direction = d; updateFacing(); },
  getPosition: () => ({ x: currentX, y: currentY }),
  setPosition: (x, y) => { currentX = x; currentY = y; },
  sendSetPosition: (x, y) => ipcRenderer.send('set-position', { x, y }),
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', { x: dx, y: dy }),
  getBounds: () => ({ screenWidth, screenHeight, winWidth, winHeight }),
  getCharSettings: () => charSettings,
  getFood: () => ({ active: foodActive, targetX: foodTargetX }),
  getCursor: () => ({ x: cursorScreenX, y: cursorScreenY }),
  spawnTrail: (emoji) => spawnTrailParticle(emoji),
  spawnSleepZzz: () => spawnSleepParticle(),
  onEatFood: () => {
    foodActive = false;
    ipcRenderer.send('eat-food');
    setState('eat');
    setTimeout(() => {
      setState('happy');
      showParticle('❤️');
      setTimeout(() => setState('idle'), 2000);
    }, 2000);
  }
});
movementEngine.start();

// IPC Listener for food
ipcRenderer.on('food-spawned', (event, { x }) => {
  foodActive = true;
  foodTargetX = x;
  if (foodTargetX > currentX) {
    direction = 1;
  } else {
    direction = -1;
  }
  setState('walk');
});

ipcRenderer.on('cursor-update', (event, point) => {
  if (point) {
    cursorScreenX = point.x;
    cursorScreenY = point.y;
  }
});

// Interactions
sprite.addEventListener('contextmenu', (e) => {
  e.preventDefault(); // Prevent default right click menu
  if (!foodActive) {
    // Determine random food position
    const minX = 0;
    const maxX = Math.max(0, screenWidth - winWidth); 
    const x = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
    // They both sit on the ground, so food Y is currentY + winHeight - 50
    ipcRenderer.send('spawn-food', { x, y: currentY + winHeight - 50 });
  }
});

// Double click = hit (angry)
let clickTimer = null;
sprite.addEventListener('dblclick', () => {
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
  setState('angry');
  showParticle('💢');
  setTimeout(() => setState('idle'), 2000);
});

// Single click = pet (happy)
sprite.addEventListener('click', (e) => {
  if (hasDragged) return;
  
  // Delay to distinguish from double click
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
  clickTimer = setTimeout(() => {
    clickTimer = null;
    if (state === 'idle' || state === 'walk') {
      setState('happy');
      showParticle('✨');
      setTimeout(() => setState('idle'), 2000);
    }
  }, 250);
});

ipcRenderer.on('change-character', (event, { filename, cfg }) => {
  rlog('INFO', 'Character changed', { filename, cfg });
  currentCharacter = filename;
  applyCharSettings(cfg);
  setState(state); // re-apply to refresh image
});

ipcRenderer.on('apply-char-settings', (event, changes) => {
  rlog('INFO', 'Settings applied from menu', changes);
  applyCharSettings(changes);
  setState(state); // re-apply class & facing
});

// Catch renderer errors
window.addEventListener('error', (e) => {
  rlog('ERROR', 'Uncaught error', { message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno });
});
window.addEventListener('unhandledrejection', (e) => {
  rlog('ERROR', 'Unhandled promise rejection', { reason: String(e.reason) });
});

rlog('INFO', 'Renderer initialized', { character: currentCharacter });

// Debug mode toggle (Press 'D' or 'В' on Russian layout)
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'в') {
    document.body.classList.toggle('debug-mode');
  }
});
