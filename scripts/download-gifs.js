const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const baseUrl = 'https://play.pokemonshowdown.com/sprites/ani/';
const outputDir = path.join(__dirname, 'pokemon-gifs');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function start() {
  try {
    const res = await fetch(baseUrl + '?view=icons');
    const data = await res.text();
    
    const regex = /href="\.\/([^"]+\.gif)"/g;
    const files = [];
    let match;
    while ((match = regex.exec(data)) !== null) {
      files.push(match[1]);
    }
    
    console.log(`Found ${files.length} gif files. Starting download...`);
    
    let active = 0;
    const maxActive = 15;
    let index = 0;
    let completed = 0;
    
    function downloadNext() {
      if (index >= files.length) {
        if (active === 0) console.log('All downloads completed!');
        return;
      }
      
      const file = files[index++];
      active++;
      
      const fileUrl = baseUrl + file;
      const filePath = path.join(outputDir, file);
      
      // Use curl to download the file directly, it's robust and fast
      const curl = spawn('curl', ['-s', '-L', '-o', filePath, fileUrl]);
      
      curl.on('close', (code) => {
        if (code === 0) {
          completed++;
          if (completed % 50 === 0) console.log(`Downloaded ${completed}/${files.length}`);
        } else {
          console.error(`Failed to download ${file}`);
        }
        active--;
        downloadNext();
      });
    }
    
    for (let i = 0; i < maxActive; i++) {
      downloadNext();
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

start();
