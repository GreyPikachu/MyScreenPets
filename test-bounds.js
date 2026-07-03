const { app, BrowserWindow, screen } = require('electron');
app.whenReady().then(() => {
  const display = screen.getPrimaryDisplay();
  console.log("Display bounds:", display.bounds);
  console.log("Work area:", display.workArea);
  
  const win = new BrowserWindow({width: 150, height: 150, alwaysOnTop: true, frame: false});
  win.setPosition(2000, 500);
  setTimeout(() => {
    console.log("Position after setting to 2000:", win.getPosition());
    app.quit();
  }, 1000);
});
