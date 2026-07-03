/**
 * MovementEngine — handles character locomotion, boundaries, and autonomous transitions.
 * Phase 1: Modularized from renderer.js
 */
class MovementEngine {
  /**
   * @param {Object} ctrl - Interface to renderer state and actions
   */
  constructor(ctrl) {
    this.ctrl = ctrl;
    this.timer = null;
    this.interval = 50; // 50ms (20 fps logic loop)

    // Configurable behavior settings
    this.config = {
      speedMultiplier: 1.0,
      walkStyle: 'bounce',    // 'bounce', 'glide', 'hop', 'waddle'
      movementType: 'ground', // 'ground', 'platform', 'free-roam'
      pauseDuration: 0,
      activityLevel: 1.0,
      cursorReaction: 'ignore'
    };
  }

  start() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.update(), this.interval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  updateConfig(newConfig = {}) {
    this.config = { ...this.config, ...newConfig };
  }

  onDragEnd() {
    if (this.config.movementType === 'platform') {
      const { y } = this.ctrl.getPosition();
      this.targetLevelY = Math.round(y);
    } else if (this.config.movementType === 'free-roam') {
      this.targetRoamX = undefined;
      this.targetRoamY = undefined;
    }
  }

  update() {
    if (this.ctrl.isDragging()) return;

    const state = this.ctrl.getState();
    const settings = this.ctrl.getCharSettings();
    const { screenWidth, screenHeight, winWidth, winHeight } = this.ctrl.getBounds();
    let { x: currentX, y: currentY } = this.ctrl.getPosition();

    const areaPct = Math.min(100, Math.max(10, (this.config.movementArea !== undefined ? this.config.movementArea : 100))) / 100;
    const maxY = Math.max(0, screenHeight - winHeight);
    const minY = Math.max(0, Math.round(maxY - maxY * areaPct));

    // Check food priority across states (only if walking is enabled)
    const food = this.ctrl.getFood();
    if (settings.walking && food && food.active) {
      this.wasIdle = false;
      this.idleStartTimestamp = undefined;
      if (state === 'idle') {
        this.ctrl.setState('walk');
        return;
      }
    }

    // Check cursor reaction (only if walking is enabled)
    const cursor = this.ctrl.getCursor ? this.ctrl.getCursor() : null;
    let isReactingToCursor = false;
    if (settings.walking && cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y) && this.config.cursorReaction !== 'ignore' && (!food || !food.active)) {
      const centerX = currentX + winWidth / 2;
      const centerY = currentY + winHeight / 2;
      const dxToCursor = cursor.x - centerX;
      const dyToCursor = cursor.y - centerY;
      const distToCursor = Math.hypot(dxToCursor, dyToCursor);

      if (this.config.cursorReaction === 'curious' && distToCursor < 280 && distToCursor > 40) {
        isReactingToCursor = true;
        this.wasIdle = false;
        this.idleStartTimestamp = undefined;
        if (state === 'idle') {
          this.ctrl.setState('walk');
          return;
        }
        if (this.config.movementType === 'platform') {
          this.targetLevelY = Math.min(maxY, Math.max(minY, Math.round(cursor.y - winHeight / 2)));
        } else if (this.config.movementType === 'free-roam') {
          this.targetRoamX = Math.round(cursor.x - winWidth / 2);
          this.targetRoamY = Math.round(cursor.y - winHeight / 2);
        }
        if (dxToCursor > 10) this.ctrl.setDirection(1);
        else if (dxToCursor < -10) this.ctrl.setDirection(-1);
      } else if (this.config.cursorReaction === 'avoid' && distToCursor < 220) {
        isReactingToCursor = true;
        this.wasIdle = false;
        this.idleStartTimestamp = undefined;
        if (state === 'idle') {
          this.ctrl.setState('walk');
          return;
        }
        if (this.config.movementType === 'platform') {
          const runY = centerY < cursor.y ? minY : maxY;
          this.targetLevelY = runY;
        } else if (this.config.movementType === 'free-roam') {
          this.targetRoamX = Math.round(currentX - dxToCursor * 1.5);
          this.targetRoamY = Math.round(currentY - dyToCursor * 1.5);
        }
        if (dxToCursor > 0) this.ctrl.setDirection(-1);
        else this.ctrl.setDirection(1);
      }
    }

    if (state === 'idle') {
      if (!this.wasIdle) {
        this.idleStartTimestamp = Date.now();
        this.wasIdle = true;
      }
      const idleElapsed = Date.now() - (this.idleStartTimestamp || 0);

      if (this.config.idleBehavior === 'lookAtCursor' && cursor && Number.isFinite(cursor.x)) {
        const centerX = currentX + winWidth / 2;
        if (cursor.x > centerX + 10) this.ctrl.setDirection(1);
        else if (cursor.x < centerX - 10) this.ctrl.setDirection(-1);
      } else if (this.config.idleBehavior === 'fidget' && Math.random() < 0.03) {
        this.ctrl.setDirection(this.ctrl.getDirection() * -1);
      } else if (this.config.idleBehavior === 'sleep' && idleElapsed > 8000) {
        this.sleepTick = ((this.sleepTick || 0) + 1) % 30;
        if (this.sleepTick === 0 && this.ctrl.spawnSleepZzz) {
          this.ctrl.spawnSleepZzz();
        }
      }

      const pauseSec = (this.config.pauseDuration !== undefined ? Number(this.config.pauseDuration) : 2);
      if (idleElapsed < pauseSec * 1000) {
        return; // resting during pause
      }

      const act = (this.config.activityLevel !== undefined ? Number(this.config.activityLevel) : 50) / 100;
      const startChance = 0.05 + 0.25 * act; // 0.075 to 0.30 per tick
      if (settings.walking && Math.random() < startChance) {
        this.wasIdle = false;
        this.idleStartTimestamp = undefined;
        const newDir = Math.random() > 0.5 ? 1 : -1;
        this.ctrl.setDirection(newDir);
        this.ctrl.setState('walk');

        if (this.config.movementType === 'platform') {
          if (Math.random() < 0.4 || !Number.isFinite(this.targetLevelY) || this.targetLevelY < minY || this.targetLevelY > maxY) {
            this.targetLevelY = Math.round(minY + Math.random() * (maxY - minY));
          }
        } else if (this.config.movementType === 'free-roam') {
          this.targetRoamX = Math.round(Math.random() * screenWidth);
          this.targetRoamY = Math.round(minY + Math.random() * (maxY - minY));
        }
      }
    } else if (state === 'walk') {
      this.wasIdle = false;
      this.idleStartTimestamp = undefined;
      let direction = this.ctrl.getDirection();
      ({ x: currentX, y: currentY } = this.ctrl.getPosition());

      const baseSpeed = 2;
      let speedMult = (this.config.speedMultiplier !== undefined ? Number(this.config.speedMultiplier) : 1.0);
      if (this.config.cursorReaction === 'avoid' && isReactingToCursor) {
        speedMult *= 1.5; // run away faster!
      }
      let isMovingTick = true;

      if (this.config.walkStyle === 'hop') {
        this.hopTick = ((this.hopTick || 0) + 1) % 8;
        if (this.hopTick >= 5) {
          isMovingTick = false; // resting on the ground during hop cycle
        } else {
          speedMult *= 1.6; // jump faster while in the air
        }
      }

      // If food is active, guide towards food
      if (food && food.active) {
        if (this.config.movementType === 'platform') {
          this.targetLevelY = maxY;
        } else if (this.config.movementType === 'free-roam') {
          this.targetRoamX = food.targetX;
          this.targetRoamY = maxY;
        }
      }

      if (isMovingTick) {
        const stepSpeed = baseSpeed * speedMult;
        let speedX = 0;
        let speedY = 0;

        if (this.config.movementType === 'platform') {
          if (!Number.isFinite(this.targetLevelY) || this.targetLevelY < minY || this.targetLevelY > maxY) {
            this.targetLevelY = Math.round(minY + Math.random() * (maxY - minY));
          }
          if (Math.abs(currentY - this.targetLevelY) > stepSpeed) {
            speedY = (this.targetLevelY > currentY ? 1 : -1) * stepSpeed;
            speedX = 0;
          } else {
            currentY = this.targetLevelY;
            speedY = 0;
            speedX = stepSpeed * direction;
          }
        } else if (this.config.movementType === 'free-roam') {
          if (!Number.isFinite(this.targetRoamX) || !Number.isFinite(this.targetRoamY)) {
            this.targetRoamX = Math.round(Math.random() * screenWidth);
            this.targetRoamY = Math.round(minY + Math.random() * (maxY - minY));
          }
          const dxToTarget = this.targetRoamX - currentX;
          const dyToTarget = this.targetRoamY - currentY;
          const dist = Math.hypot(dxToTarget, dyToTarget);

          if (dist <= stepSpeed) {
            currentX = this.targetRoamX;
            currentY = this.targetRoamY;
            this.targetRoamX = undefined;
            this.targetRoamY = undefined;
            this.ctrl.setPosition(currentX, currentY);
            this.ctrl.sendSetPosition(Math.round(currentX), Math.round(currentY));
            this.ctrl.setState('idle');
            return;
          } else {
            speedX = (dxToTarget / dist) * stepSpeed;
            speedY = (dyToTarget / dist) * stepSpeed;
            if (speedX > 0.3) direction = 1;
            else if (speedX < -0.3) direction = -1;
            this.ctrl.setDirection(direction);
          }
        } else {
          speedX = stepSpeed * direction;
          speedY = 0;
        }

        const oldRoundX = Math.round(currentX);
        const oldRoundY = Math.round(currentY);

        currentX += speedX;
        currentY += speedY;

        let hitBoundary = false;
        if (currentX < 0) {
          currentX = 0;
          direction = 1;
          hitBoundary = true;
          if (this.config.movementType === 'free-roam') { this.targetRoamX = undefined; this.targetRoamY = undefined; }
        } else if (currentX > screenWidth - winWidth) {
          currentX = Math.max(0, screenWidth - winWidth);
          direction = -1;
          hitBoundary = true;
          if (this.config.movementType === 'free-roam') { this.targetRoamX = undefined; this.targetRoamY = undefined; }
        }

        if (currentY < minY) {
          currentY = minY;
          hitBoundary = true;
          if (this.config.movementType === 'platform') { this.targetLevelY = Math.round(minY + Math.random() * (maxY - minY)); }
          else if (this.config.movementType === 'free-roam') { this.targetRoamX = undefined; this.targetRoamY = undefined; }
        } else if (currentY > maxY) {
          currentY = maxY;
          hitBoundary = true;
          if (this.config.movementType === 'platform') { this.targetLevelY = Math.round(minY + Math.random() * (maxY - minY)); }
          else if (this.config.movementType === 'free-roam') { this.targetRoamX = undefined; this.targetRoamY = undefined; }
        }

        const newRoundX = Math.round(currentX);
        const newRoundY = Math.round(currentY);
        const dx = newRoundX - oldRoundX;
        const dy = newRoundY - oldRoundY;

        if (hitBoundary) {
          this.ctrl.setDirection(direction);
          this.ctrl.setPosition(currentX, currentY);
          this.ctrl.sendSetPosition(Math.round(currentX), Math.round(currentY));
          if (this.config.movementType === 'free-roam') {
            this.ctrl.setState('idle');
          } else {
            this.ctrl.setState('walk');
          }
        } else {
          this.ctrl.setPosition(currentX, currentY);
          if (dx !== 0 || dy !== 0) {
            this.ctrl.moveWindow(dx, dy);
            if (this.config.trail && this.config.trail !== 'none' && this.ctrl.spawnTrail) {
              this.trailTick = ((this.trailTick || 0) + 1) % 5;
              if (this.trailTick === 0) {
                const trailEmojis = { paw: '🐾', sparkle: '✨', heart: '❤️', note: '🎵', star: '⭐' };
                const emoji = trailEmojis[this.config.trail];
                if (emoji) this.ctrl.spawnTrail(emoji);
              }
            }
          }
        }
      }

      if (food && food.active) {
        const isXAligned = food.targetX >= currentX - 10 && food.targetX <= currentX + winWidth + 10;
        if (isXAligned && Math.abs(currentY - maxY) < 15) {
          this.ctrl.onEatFood();
        }
      } else if (!isReactingToCursor) {
        const act = (this.config.activityLevel !== undefined ? Number(this.config.activityLevel) : 50) / 100;
        const stopChance = Math.max(0.01, 0.08 - 0.06 * act);
        if (Math.random() < stopChance) {
          this.ctrl.setState('idle');
        }
      }
    }
  }
}

module.exports = MovementEngine;
