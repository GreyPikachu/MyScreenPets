const { app, BrowserWindow, ipcMain, screen, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

let petWindow;
let isGhostMode = false;

function toInt(val, fallback = 0) {
  const n = Math.round(Number(val));
  return (Number.isFinite(n) && n >= -2147483648 && n <= 2147483647) ? n : fallback;
}

function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  logger.info('main', 'Creating pet window', { screenWidth: width, screenHeight: height });

  petWindow = new BrowserWindow({
    width: 150,
    height: 150,
    x: width / 2 - 75,
    y: height - 150, // Start at the bottom
    enableLargerThanScreen: true,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simplicity in prototyping
    }
  });

  petWindow.loadFile('index.html');
  
  // Make the transparent area click-through
  petWindow.setIgnoreMouseEvents(true, { forward: true });
  
  petWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // Log renderer errors
  petWindow.webContents.on('console-message', (e, level, msg, line, sourceId) => {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    logger.info('renderer:console', `[${levels[level] || level}] ${msg}`, { line, sourceId });
  });
  petWindow.webContents.on('crashed', (e) => {
    logger.error('main', 'Renderer process crashed!');
  });
  
  logger.info('main', 'Pet window created');
  // petWindow.webContents.openDevTools({ mode: 'detach' });
}

// Catch unhandled errors
process.on('uncaughtException', (err) => {
  logger.error('main', 'Uncaught exception', { message: err.message, stack: err.stack });
});
process.on('unhandledRejection', (reason) => {
  logger.error('main', 'Unhandled promise rejection', { reason: String(reason) });
});

app.whenReady().then(() => {
  logger.info('main', 'App ready, starting...');
  createPetWindow();

  // ─── Global Shortcuts ──────────────────────────────────────────────────────
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (petWindow) {
      isGhostMode = !isGhostMode;
      // When ghost mode is true, forward is false (completely click-through).
      petWindow.setIgnoreMouseEvents(true, { forward: !isGhostMode });
      logger.info('main', 'Toggled ghost mode', { isGhostMode });
    }
  });

  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (petWindow) {
      if (petWindow.isVisible()) {
        petWindow.hide();
        logger.info('main', 'Hid pet window');
      } else {
        petWindow.showInactive();
        logger.info('main', 'Showed pet window');
      }
    }
  });

  let dragOffset = null;
  ipcMain.on('start-drag', (e, offset) => { 
    dragOffset = offset; 
    if (petWindow) {
      petWindow._wallRight = undefined;
      petWindow._wallLeft = undefined;
      petWindow._wallTop = undefined;
      petWindow._wallBottom = undefined;
      petWindow._lastNx = undefined;
      petWindow._lastNy = undefined;
    }
  });
  ipcMain.on('stop-drag', () => { 
    dragOffset = null; 
    if (petWindow) petWindow.webContents.send('sync-position', petWindow.getPosition()); 
  });

  setInterval(() => {
    if (petWindow && !petWindow.isDestroyed()) {
      try {
        const point = screen.getCursorScreenPoint();
        if (dragOffset) {
          const display = screen.getDisplayMatching(petWindow.getBounds());
          const bounds = petWindow.getBounds();
          let nx = Math.round(point.x - dragOffset.x);
          let ny = Math.round(point.y - dragOffset.y);

          // Get actual OS position to detect snapping
          const [currentX, currentY] = petWindow.getPosition();

          if (petWindow._lastNx !== undefined && currentX !== petWindow._lastNx) {
            // OS snapped the window!
            if (petWindow._lastNx > currentX) petWindow._wallRight = currentX;
            if (petWindow._lastNx < currentX) petWindow._wallLeft = currentX;
            if (petWindow._lastNy > currentY) petWindow._wallBottom = currentY;
            if (petWindow._lastNy < currentY) petWindow._wallTop = currentY;
          }

          // Apply discovered walls
          if (petWindow._wallRight !== undefined) nx = Math.min(nx, petWindow._wallRight);
          if (petWindow._wallLeft !== undefined) nx = Math.max(nx, petWindow._wallLeft);
          if (petWindow._wallBottom !== undefined) ny = Math.min(ny, petWindow._wallBottom);
          if (petWindow._wallTop !== undefined) ny = Math.max(ny, petWindow._wallTop);

          // Also clamp to display bounds to prevent macOS WindowServer snapping feedback loop (jitter)
          nx = Math.max(display.bounds.x, Math.min(nx, display.bounds.x + display.bounds.width - bounds.width));
          ny = Math.max(display.bounds.y, Math.min(ny, display.bounds.y + display.bounds.height - bounds.height));
          
          if (nx !== currentX || ny !== currentY) {
            petWindow.setPosition(nx, ny);
          }
          petWindow._lastNx = nx;
          petWindow._lastNy = ny;
        } else {
          petWindow.webContents.send('cursor-update', point);
        }
      } catch (err) {
        logger.error('main', 'Drag loop error', { error: err.message });
      }
    }
  }, 16);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow();
    }
  });

  app.on('browser-window-focus', () => {
    globalShortcut.register('CommandOrControl+,', () => {
      openMenuWindow();
    });
    globalShortcut.register('CommandOrControl+Q', () => {
      app.quit();
    });
  });

  app.on('browser-window-blur', () => {
    globalShortcut.unregister('CommandOrControl+,');
    globalShortcut.unregister('CommandOrControl+Q');
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

ipcMain.on('move-window', (event, { x, y }) => {
  if (petWindow) {
    const [currentX, currentY] = petWindow.getPosition();
    const safeX = toInt(x, 0);
    const safeY = toInt(y, 0);
    petWindow.setPosition(toInt(currentX + safeX, 0), toInt(currentY + safeY, 0));
  }
});

// Toggle click-through for transparent regions
ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
  if (petWindow) {
    petWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

// Get screen bounds
ipcMain.handle('get-screen-bounds', () => {
  return screen.getPrimaryDisplay().workAreaSize;
});

// IPC communication to set exact position
ipcMain.on('set-position', (event, { x, y }) => {
  if (petWindow) {
    const safeX = toInt(x, 0);
    const safeY = toInt(y, 0);
    petWindow.setPosition(safeX, safeY);
  }
});

// IPC communication to dynamically resize window around scaled character
ipcMain.on('resize-window', (event, { width, height, x, y }) => {
  if (petWindow) {
    const safeX = toInt(x, 0);
    const safeY = toInt(y, 0);
    const safeW = Math.max(50, toInt(width, 150));
    const safeH = Math.max(50, toInt(height, 150));
    logger.debug('main', 'resize-window', { x: safeX, y: safeY, w: safeW, h: safeH });
    petWindow.setBounds({ x: safeX, y: safeY, width: safeW, height: safeH });
  }
});

let foodWindow;
ipcMain.on('spawn-food', (event, { x, y }) => {
  logger.info('main', 'Spawning food', { x, y });
  if (foodWindow) {
    foodWindow.close();
  }
  foodWindow = new BrowserWindow({
    width: 50,
    height: 50,
    x: toInt(x, 0),
    y: toInt(y, 0),
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true
  });
  foodWindow.setAlwaysOnTop(true, 'screen-saver');
  foodWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<html style="margin:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;height:100%;font-size:30px;user-select:none;">🍟</html>'));
  
  event.reply('food-spawned', { x });
});

ipcMain.on('eat-food', () => {
  if (foodWindow) {
    foodWindow.close();
    foodWindow = null;
  }
});

// Quit app command
let menuWindow;

function openMenuWindow() {
  logger.info('main', 'Opening menu window');
  if (menuWindow) {
    menuWindow.focus();
    return;
  }
  menuWindow = new BrowserWindow({
    width: 380,
    height: 520,
    minWidth: 340,
    minHeight: 450,
    transparent: true,
    vibrancy: 'hud', // Forces a dark translucent appearance on macOS
    visualEffectState: 'active',
    frame: false,
    titleBarStyle: 'hiddenInset',
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  menuWindow.loadFile('menu.html');
  
  menuWindow.on('closed', () => {
    menuWindow = null;
  });
}

ipcMain.on('open-menu', openMenuWindow);

ipcMain.on('set-theme', (event, theme) => {
  if (menuWindow) {
    menuWindow.setVibrancy(theme === 'light' ? 'popover' : 'hud');
  }
});

ipcMain.on('select-character', (event, filename) => {
  logger.info('main', 'Character selected', { filename });
  if (petWindow) {
    // Read the latest settings for this character and send along
    const settingsPath = path.join(__dirname, 'characters', 'settings.json');
    let cfg = { scale: 1.0, walking: true, flipped: false, walkStyle: 'bounce', movementType: 'ground', movementArea: 100, speedMultiplier: 1.0, pauseDuration: 2, activityLevel: 50, cursorReaction: 'ignore' };
    try {
      const all = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      cfg = { ...cfg, ...(all[filename] || {}) };
    } catch {}
    logger.info('main', 'Applying character config', { filename, cfg });
    petWindow.webContents.send('change-character', { filename, cfg });
  }
});

ipcMain.on('update-char-settings', (event, changes) => {
  logger.info('main', 'Character settings updated', changes);
  // Forward live setting changes to the pet window
  if (petWindow) {
    petWindow.webContents.send('apply-char-settings', changes);
  }
});

ipcMain.on('add-character', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Character Image',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['gif', 'png', 'jpg', 'jpeg', 'webp', 'svg'] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const sourcePath = result.filePaths[0];
    const filename = path.basename(sourcePath);
    const targetPath = path.join(__dirname, 'characters', filename);
    fs.copyFileSync(sourcePath, targetPath);
    if (menuWindow) {
      menuWindow.webContents.send('refresh-menu');
    }
  }
});

ipcMain.on('quit-app', () => {
  logger.info('main', 'Quit requested via IPC');
  app.quit();
});

// Log IPC handler for renderer-side logs
ipcMain.on('log-from-renderer', (event, { level, source, message, data }) => {
  logger.info(source || 'renderer', message, data);
});
