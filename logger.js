const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const MAX_LOG_SIZE = 2 * 1024 * 1024; // 2 MB — rotate after this

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogPath() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `app-${today}.log`);
}

function rotateIfNeeded(logPath) {
  try {
    const stats = fs.statSync(logPath);
    if (stats.size > MAX_LOG_SIZE) {
      const rotated = logPath.replace('.log', `-${Date.now()}.old.log`);
      fs.renameSync(logPath, rotated);
    }
  } catch {}
}

function formatTimestamp() {
  return new Date().toISOString();
}

/**
 * Write a log entry.
 * @param {'INFO'|'WARN'|'ERROR'|'DEBUG'} level
 * @param {string} source - e.g. 'main', 'renderer', 'menu'
 * @param {string} message
 * @param {object} [data] - optional extra data
 */
function log(level, source, message, data) {
  const logPath = getLogPath();
  rotateIfNeeded(logPath);

  let line = `[${formatTimestamp()}] [${level}] [${source}] ${message}`;
  if (data !== undefined) {
    try {
      line += ' | ' + JSON.stringify(data);
    } catch {
      line += ' | [unserializable data]';
    }
  }
  line += '\n';

  try {
    fs.appendFileSync(logPath, line, 'utf8');
  } catch (err) {
    // Last resort — at least print to console
    console.error('Logger write failed:', err.message);
  }
}

// Convenience shortcuts
const logger = {
  info:  (source, msg, data) => log('INFO',  source, msg, data),
  warn:  (source, msg, data) => log('WARN',  source, msg, data),
  error: (source, msg, data) => log('ERROR', source, msg, data),
  debug: (source, msg, data) => log('DEBUG', source, msg, data),
  LOG_DIR,
  getLogPath,
};

module.exports = logger;
