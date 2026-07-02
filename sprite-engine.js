/**
 * SpriteEngine — Canvas-based animation engine for Pikachu desktop pet.
 *
 * States using original 33 PNG frames (with effects):
 *   idle, walk, happy, angry, eat
 *
 * States using hand-drawn Canvas 2D primitives:
 *   sit_down, sitting, sit_to_sleep, sleeping, sit_read_start, reading
 *
 * Canvas: 120×120, sprites drawn at 2× from 60×60 originals.
 */

'use strict';

const path = require('path');

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_SIZE = 120;
const SPRITE_SRC  = 60;
const SCALE       = 2;
const TOTAL_FRAMES = 33;

// Colors
const COL_BODY       = '#FFD700';
const COL_BODY_DARK  = '#E6BE00';
const COL_EAR_TIP    = '#222222';
const COL_EYE        = '#1A1A1A';
const COL_CHEEK      = '#FF4444';
const COL_MOUTH      = '#AA3333';
const COL_TAIL       = '#FFD700';
const COL_TAIL_DARK  = '#DAA520';
const COL_BOOK       = '#4488DD';
const COL_BOOK_PAGES = '#F5F0E0';
const COL_GLASSES    = '#333333';
const COL_ZZZ        = '#AABBFF';

// ─── Helper: easing ──────────────────────────────────────────────────────────

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ─── SpriteEngine ────────────────────────────────────────────────────────────

class SpriteEngine {
  /**
   * @param {HTMLCanvasElement} canvas  – 120×120 canvas element
   * @param {string}           framesPath – absolute path to folder with frame_001.png … frame_033.png
   */
  constructor(canvas, framesPath) {
    this.canvas     = canvas;
    this.ctx        = canvas.getContext('2d');
    this.framesPath = framesPath;

    // State
    this._state      = 'idle';
    this._direction  = 1;           // 1 = right, -1 = left
    this._onComplete = null;        // callback for transition states

    // Animation clock
    this._elapsed    = 0;           // seconds since state entered
    this._frameIdx   = 0;           // current sub-frame index
    this._frameDur   = 0;           // accumulator for frame timing

    // Loaded images (Image[])
    this._images     = [];
    this._loaded     = false;

    // Pre-compute state configs
    this._configs    = this._buildConfigs();

    this._loadFrames();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Set the current animation state. */
  setState(name, options) {
    if (!this._configs[name]) {
      console.warn(`SpriteEngine: unknown state "${name}"`);
      return;
    }
    this._state      = name;
    this._onComplete = (options && options.onComplete) || null;
    this._elapsed    = 0;
    this._frameIdx   = 0;
    this._frameDur   = 0;
  }

  /** Set facing direction: 1 = right, -1 = left. */
  setDirection(dir) {
    this._direction = dir >= 0 ? 1 : -1;
  }

  /** Advance animation by deltaTime (seconds). */
  update(deltaTime) {
    const cfg = this._configs[this._state];
    if (!cfg) return;

    this._elapsed  += deltaTime;
    this._frameDur += deltaTime;

    const spf = 1 / cfg.fps;
    if (this._frameDur >= spf) {
      this._frameDur -= spf;
      this._frameIdx++;

      // Handle looping vs one-shot
      if (this._frameIdx >= cfg.totalFrames) {
        if (cfg.loop) {
          this._frameIdx = 0;
        } else {
          this._frameIdx = cfg.totalFrames - 1;
          if (this._onComplete) {
            const cb = this._onComplete;
            this._onComplete = null;
            cb();
          }
        }
      }
    }
  }

  /** Draw the current frame to the canvas. */
  render() {
    const ctx = this.ctx;
    const cfg = this._configs[this._state];
    if (!cfg) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.save();

    // Mirror for direction
    if (this._direction === -1) {
      ctx.translate(CANVAS_SIZE, 0);
      ctx.scale(-1, 1);
    }

    cfg.render(ctx, this._frameIdx, this._elapsed);

    ctx.restore();
  }

  /** Return current state name. */
  getState() {
    return this._state;
  }

  // ── Frame Loading ────────────────────────────────────────────────────────

  _loadFrames() {
    let count = 0;
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const idx = String(i).padStart(3, '0');
      img.src = path.join(this.framesPath, `frame_${idx}.png`);
      img.onload = () => {
        count++;
        if (count === TOTAL_FRAMES) this._loaded = true;
      };
      img.onerror = () => {
        console.warn(`SpriteEngine: failed to load frame_${idx}.png`);
      };
      this._images.push(img);
    }
  }

  // ── Draw original sprite (2× scale, centered) with optional transforms ──

  _drawSprite(ctx, frameIndex, { offsetX = 0, offsetY = 0, scaleX = 1, scaleY = 1, filter = '' } = {}) {
    if (!this._loaded) return;
    const idx = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
    const img = this._images[idx];
    if (!img || !img.complete) return;

    const w = SPRITE_SRC * SCALE * scaleX;
    const h = SPRITE_SRC * SCALE * scaleY;
    const x = (CANVAS_SIZE - w) / 2 + offsetX;
    const y = (CANVAS_SIZE - h) + offsetY; // feet at bottom

    ctx.save();
    if (filter) ctx.filter = filter;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }

  // ── State Configs ────────────────────────────────────────────────────────

  _buildConfigs() {
    const self = this;
    return {
      // ─ IDLE ──────────────────────────────────────────────────────────────
      idle: {
        fps: 10,
        totalFrames: TOTAL_FRAMES,
        loop: true,
        render(ctx, fi, t) {
          // Gentle hover bob
          const bob = Math.sin(t * 2.5) * 1.5;
          self._drawSprite(ctx, fi, { offsetY: bob });
        },
      },

      // ─ WALK ──────────────────────────────────────────────────────────────
      walk: {
        fps: 12,
        totalFrames: TOTAL_FRAMES,
        loop: true,
        render(ctx, fi, t) {
          // Walk bounce
          const bounce = -Math.abs(Math.sin(t * 8)) * 4;
          self._drawSprite(ctx, fi, { offsetY: bounce });
        },
      },

      // ─ HAPPY ─────────────────────────────────────────────────────────────
      happy: {
        fps: 14,
        totalFrames: TOTAL_FRAMES,
        loop: true,
        render(ctx, fi, t) {
          const bigBounce = -Math.abs(Math.sin(t * 6)) * 10;
          // Golden sparkle glow
          self._drawSprite(ctx, fi, {
            offsetY: bigBounce,
            filter: 'saturate(1.5) brightness(1.15) drop-shadow(0 0 6px #FFD700)',
          });
          // Sparkles
          _drawSparkles(ctx, t);
        },
      },

      // ─ ANGRY ─────────────────────────────────────────────────────────────
      angry: {
        fps: 12,
        totalFrames: TOTAL_FRAMES,
        loop: true,
        render(ctx, fi, t) {
          const shakeX = Math.sin(t * 35) * 3;
          const shakeY = Math.cos(t * 28) * 1.5;
          self._drawSprite(ctx, fi, {
            offsetX: shakeX,
            offsetY: shakeY,
            filter: 'hue-rotate(-25deg) saturate(1.6) brightness(0.95)',
          });
          // Anger vein symbol
          _drawAngerMark(ctx, t);
        },
      },

      // ─ EAT ───────────────────────────────────────────────────────────────
      eat: {
        fps: 10,
        totalFrames: TOTAL_FRAMES,
        loop: true,
        render(ctx, fi, t) {
          // Squish / munch
          const phase   = (Math.sin(t * 6) + 1) / 2;
          const scaleX  = lerp(1.0, 1.08, phase);
          const scaleY  = lerp(1.0, 0.92, phase);
          const offsetY = (1 - scaleY) * SPRITE_SRC * SCALE * 0.5;
          self._drawSprite(ctx, fi, { scaleX, scaleY, offsetY });
        },
      },

      // ─ SIT_DOWN (transition, ~6 frames) ──────────────────────────────────
      sit_down: {
        fps: 8,
        totalFrames: 6,
        loop: false,
        render(ctx, fi) {
          const t = fi / 5; // 0 → 1
          _drawPikachuSitting(ctx, t, { transition: 'down' });
        },
      },

      // ─ SITTING (loop, ~4 frames) ─────────────────────────────────────────
      sitting: {
        fps: 3,
        totalFrames: 4,
        loop: true,
        render(ctx, fi, t) {
          _drawPikachuSitting(ctx, 1, { breathe: Math.sin(t * 2) });
        },
      },

      // ─ SIT_TO_SLEEP (transition, ~6 frames) ─────────────────────────────
      sit_to_sleep: {
        fps: 6,
        totalFrames: 6,
        loop: false,
        render(ctx, fi) {
          const t = fi / 5;
          _drawPikachuSleeping(ctx, t, { transition: true });
        },
      },

      // ─ SLEEPING (loop, ~4 frames) ────────────────────────────────────────
      sleeping: {
        fps: 2.5,
        totalFrames: 4,
        loop: true,
        render(ctx, fi, t) {
          _drawPikachuSleeping(ctx, 1, { breathe: Math.sin(t * 1.5), zzzTime: t });
        },
      },

      // ─ SIT_READ_START (transition, ~6 frames) ───────────────────────────
      sit_read_start: {
        fps: 7,
        totalFrames: 6,
        loop: false,
        render(ctx, fi) {
          const t = fi / 5;
          _drawPikachuReading(ctx, t, { transition: true });
        },
      },

      // ─ READING (loop, ~8 frames) ─────────────────────────────────────────
      reading: {
        fps: 3,
        totalFrames: 8,
        loop: true,
        render(ctx, fi, t) {
          _drawPikachuReading(ctx, 1, { pageFlip: fi, time: t });
        },
      },
    };
  }
}

// ─── Hand-drawn Canvas 2D Helpers ────────────────────────────────────────────

/**
 * Draw sparkles around the character (for happy state).
 */
function _drawSparkles(ctx, t) {
  ctx.save();
  const count = 5;
  for (let i = 0; i < count; i++) {
    const angle  = (i / count) * Math.PI * 2 + t * 2;
    const radius = 42 + Math.sin(t * 4 + i) * 8;
    const x = 60 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    const size = 2 + Math.sin(t * 5 + i * 1.3) * 1.5;
    const alpha = 0.5 + Math.sin(t * 6 + i) * 0.4;

    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle   = '#FFEE44';
    // 4-point star
    ctx.beginPath();
    for (let p = 0; p < 4; p++) {
      const a = (p / 4) * Math.PI * 2 - Math.PI / 2;
      const r = p % 2 === 0 ? size * 2.2 : size * 0.5;
      if (p === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw a manga-style anger mark (for angry state).
 */
function _drawAngerMark(ctx, t) {
  ctx.save();
  const pulse = 1 + Math.sin(t * 10) * 0.15;
  ctx.translate(88, 18);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#FF3333';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';

  // Cross/vein shape
  const s = 7;
  ctx.beginPath();
  ctx.moveTo(-s, -s); ctx.lineTo(0, 0);
  ctx.moveTo(s, -s);  ctx.lineTo(0, 0);
  ctx.moveTo(s, s);   ctx.lineTo(0, 0);
  ctx.moveTo(-s, s);  ctx.lineTo(0, 0);
  ctx.stroke();

  ctx.restore();
}

// ─── Hand-Drawn Pikachu Parts ────────────────────────────────────────────────

/**
 * Draw Pikachu's body (rounded yellow blob).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx      – center X
 * @param {number} cy      – center Y
 * @param {number} w       – width
 * @param {number} h       – height
 * @param {number} [squish] – vertical squish factor (1 = normal)
 */
function _drawBody(ctx, cx, cy, w, h, squish = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, squish);

  // Main body
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = COL_BODY;
  ctx.fill();

  // Subtle belly highlight
  ctx.beginPath();
  ctx.ellipse(0, h * 0.05, w * 0.35, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 240, 180, 0.45)';
  ctx.fill();

  ctx.restore();
}

/**
 * Draw an ear.
 * @param {number} side – -1 = left, 1 = right
 */
function _drawEar(ctx, cx, cy, side, earLength = 22, angle = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(side * 0.35 + angle);

  // Ear body
  ctx.beginPath();
  ctx.moveTo(-5 * side, 0);
  ctx.quadraticCurveTo(0, -earLength * 0.6, 2 * side, -earLength);
  ctx.quadraticCurveTo(5 * side, -earLength * 0.6, 5 * side, 0);
  ctx.closePath();
  ctx.fillStyle = COL_BODY;
  ctx.fill();

  // Black tip
  ctx.beginPath();
  ctx.moveTo(-1 * side, -earLength * 0.5);
  ctx.quadraticCurveTo(0, -earLength * 0.65, 2 * side, -earLength);
  ctx.quadraticCurveTo(4 * side, -earLength * 0.65, 4 * side, -earLength * 0.5);
  ctx.closePath();
  ctx.fillStyle = COL_EAR_TIP;
  ctx.fill();

  ctx.restore();
}

/**
 * Draw eyes (open or closed).
 */
function _drawEyes(ctx, cx, cy, { closed = false, happy = false, size = 3.5 } = {}) {
  const eyeSpacing = 9;

  for (const side of [-1, 1]) {
    const ex = cx + side * eyeSpacing;
    const ey = cy;

    if (closed) {
      // Sleeping: curved line
      ctx.beginPath();
      ctx.arc(ex, ey, size, 0, Math.PI, false);
      ctx.strokeStyle = COL_EYE;
      ctx.lineWidth   = 1.8;
      ctx.stroke();
    } else if (happy) {
      // Happy: ^^ eyes
      ctx.beginPath();
      ctx.arc(ex, ey, size, Math.PI, 0, false);
      ctx.strokeStyle = COL_EYE;
      ctx.lineWidth   = 2;
      ctx.stroke();
    } else {
      // Normal: shiny dots
      ctx.beginPath();
      ctx.arc(ex, ey, size, 0, Math.PI * 2);
      ctx.fillStyle = COL_EYE;
      ctx.fill();

      // Shine
      ctx.beginPath();
      ctx.arc(ex - size * 0.3, ey - size * 0.3, size * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
  }
}

/**
 * Draw cheeks.
 */
function _drawCheeks(ctx, cx, cy, radius = 5.5) {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * 15, cy + 4, radius, 0, Math.PI * 2);
    ctx.fillStyle = COL_CHEEK;
    ctx.globalAlpha = 0.65;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/**
 * Draw a cute little mouth.
 */
function _drawMouth(ctx, cx, cy, { open = false } = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = COL_MOUTH;
  ctx.lineWidth   = 1.4;
  ctx.lineCap     = 'round';

  if (open) {
    // Open mouth (eating / happy)
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI, false);
    ctx.fillStyle = '#CC3333';
    ctx.fill();
    ctx.stroke();
  } else {
    // Closed W-mouth
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(-2, 2.5, 0, 0);
    ctx.quadraticCurveTo(2, 2.5, 4, 0);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw lightning-bolt tail.
 */
function _drawTail(ctx, x, y, { angle = 0, scale = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(8, -6);
  ctx.lineTo(3, -6);
  ctx.lineTo(12, -18);
  ctx.lineTo(6, -10);
  ctx.lineTo(11, -10);
  ctx.lineTo(0, 0);
  ctx.closePath();

  ctx.fillStyle   = COL_TAIL;
  ctx.fill();
  ctx.strokeStyle = COL_TAIL_DARK;
  ctx.lineWidth   = 1;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw small paw feet.
 */
function _drawFeet(ctx, cx, cy, spread = 12) {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * spread, cy, 7, 4, side * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = COL_BODY_DARK;
    ctx.fill();
  }
}

/**
 * Draw little arms / paws.
 */
function _drawArms(ctx, cx, cy, { holding = false, raiseAngle = 0 } = {}) {
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 18, cy);
    ctx.rotate(side * (0.5 + raiseAngle));

    ctx.beginPath();
    ctx.ellipse(0, 6, 4, 8, side * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = COL_BODY;
    ctx.fill();

    // Paw tip
    ctx.beginPath();
    ctx.ellipse(0, 13, 3.5, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = COL_BODY_DARK;
    ctx.fill();

    ctx.restore();
  }
}

// ─── Composite Characters ───────────────────────────────────────────────────

/**
 * Draw Pikachu sitting (transition or idle sitting).
 * @param {number} progress – 0 = standing, 1 = fully sitting
 */
function _drawPikachuSitting(ctx, progress, { transition, breathe = 0 } = {}) {
  const t = easeInOutSine(Math.min(1, Math.max(0, progress)));

  // Vertical position: standing → sitting (lower)
  const baseY    = lerp(60, 78, t);
  const bodyH    = lerp(28, 22, t);   // body gets shorter when sitting
  const bodyW    = lerp(24, 28, t);   // wider when sitting
  const breatheY = breathe * 1.2;

  const cx = 60;
  const cy = baseY + breatheY;

  // Tail (behind body)
  _drawTail(ctx, cx + 22, cy + 2, { angle: lerp(-0.3, -0.6, t), scale: 1.1 });

  // Feet (visible when sitting)
  if (t > 0.3) {
    const feetAlpha = (t - 0.3) / 0.7;
    ctx.globalAlpha = feetAlpha;
    _drawFeet(ctx, cx, cy + bodyH * 0.8, 14);
    ctx.globalAlpha = 1;
  }

  // Body
  const squish = lerp(1, 0.85, t) + breathe * 0.03;
  _drawBody(ctx, cx, cy, bodyW * 2, bodyH * 2, squish);

  // Ears
  const earY = cy - bodyH * squish + 2;
  _drawEar(ctx, cx - 10, earY, -1, 20 + breathe * 0.5);
  _drawEar(ctx, cx + 10, earY, 1, 20 + breathe * 0.5);

  // Arms
  _drawArms(ctx, cx, cy - 2, { raiseAngle: lerp(0, -0.3, t) });

  // Face
  const faceY = cy - bodyH * 0.2;
  _drawEyes(ctx, cx, faceY - 2, { size: 3.5 + breathe * 0.15 });
  _drawCheeks(ctx, cx, faceY);
  _drawMouth(ctx, cx, faceY + 6);
}

/**
 * Draw Pikachu sleeping (curled-up ball shape).
 * @param {number} progress – 0 = sitting, 1 = fully sleeping
 */
function _drawPikachuSleeping(ctx, progress, { transition, breathe = 0, zzzTime = 0 } = {}) {
  const t = easeInOutSine(Math.min(1, Math.max(0, progress)));

  const cx = 60;
  // Curl down as sleeping progresses
  const baseY = lerp(78, 86, t);
  const cy    = baseY + breathe * 1.5;

  // Body becomes more ball-like
  const bodyW = lerp(28, 32, t);
  const bodyH = lerp(22, 16, t);

  // Tail wraps around
  ctx.save();
  const tailX = cx + lerp(22, -18, t);
  const tailY = cy + lerp(2, 8, t);
  _drawTail(ctx, tailX, tailY, {
    angle: lerp(-0.6, -2.5, t),
    scale: lerp(1.1, 1.3, t),
  });
  ctx.restore();

  // Curled-up body
  const squish = lerp(0.85, 0.7, t) + breathe * 0.04;
  _drawBody(ctx, cx, cy, bodyW * 2, bodyH * 2, squish);

  // Ears flatten when sleeping
  const earY    = cy - bodyH * squish + 2;
  const earLen  = lerp(20, 14, t);
  const earTilt = lerp(0, -0.4, t);
  _drawEar(ctx, cx - 10, earY, -1, earLen, earTilt);
  _drawEar(ctx, cx + 10, earY, 1, earLen, -earTilt);

  // Face
  const faceY = cy - bodyH * 0.15;
  // Eyes always closed when progress > 0.5
  const eyesClosed = t > 0.4;
  _drawEyes(ctx, cx, faceY - 2, { closed: eyesClosed, size: 3 });
  _drawCheeks(ctx, cx, faceY, 5);
  // Mouth becomes sleepy line
  if (t < 0.5) {
    _drawMouth(ctx, cx, faceY + 6);
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 3, faceY + 6);
    ctx.lineTo(cx + 3, faceY + 6);
    ctx.strokeStyle = COL_MOUTH;
    ctx.lineWidth   = 1.2;
    ctx.lineCap     = 'round';
    ctx.stroke();
  }

  // Zzz floating text
  if (t > 0.6 && zzzTime > 0) {
    _drawZzz(ctx, cx + 18, cy - 24, zzzTime);
  }
}

/**
 * Draw floating Zzz.
 */
function _drawZzz(ctx, x, y, t) {
  ctx.save();
  ctx.font         = 'bold 11px sans-serif';
  ctx.fillStyle    = COL_ZZZ;
  ctx.textAlign    = 'center';

  const zzz = ['z', 'Z', 'z'];
  for (let i = 0; i < zzz.length; i++) {
    const phase  = t * 1.2 + i * 0.8;
    const floatY = -(phase % 3) * 8;
    const alpha  = 1 - ((phase % 3) / 3);
    const sz     = 8 + i * 3;
    ctx.globalAlpha = Math.max(0, alpha) * 0.8;
    ctx.font        = `bold ${sz}px sans-serif`;
    ctx.fillText(zzz[i], x + i * 6, y + floatY - i * 8);
  }

  ctx.restore();
}

/**
 * Draw Pikachu reading (with book and glasses).
 * @param {number} progress – 0 = sitting, 1 = fully reading
 */
function _drawPikachuReading(ctx, progress, { transition, pageFlip = 0, time = 0 } = {}) {
  const t = easeInOutSine(Math.min(1, Math.max(0, progress)));

  const cx = 60;
  const cy = 80;
  const breathe = Math.sin(time * 1.8) * 0.8;

  // Body (sitting pose)
  const squish = 0.85 + breathe * 0.02;
  _drawBody(ctx, cx, cy, 56, 42, squish);

  // Tail
  _drawTail(ctx, cx + 22, cy + 4, { angle: -0.5, scale: 1.1 });

  // Feet
  _drawFeet(ctx, cx, cy + 16, 14);

  // Ears
  const earY = cy - 21 * squish + 2;
  _drawEar(ctx, cx - 10, earY, -1, 20);
  _drawEar(ctx, cx + 10, earY, 1, 20);

  // Arms holding book (transition: arms come forward)
  const armAngle = lerp(0.5, -0.8, t);
  ctx.save();
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 18, cy - 2);
    ctx.rotate(side * armAngle);

    ctx.beginPath();
    ctx.ellipse(0, 6, 4, 8, side * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = COL_BODY;
    ctx.fill();

    ctx.restore();
  }
  ctx.restore();

  // Book (appears with transition)
  if (t > 0.3) {
    const bookAlpha = (t - 0.3) / 0.7;
    ctx.save();
    ctx.globalAlpha = bookAlpha;

    const bookX = cx - 14;
    const bookY = cy + 2;
    const bookW = 28;
    const bookH = 18;

    // Book cover
    ctx.fillStyle = COL_BOOK;
    _roundRect(ctx, bookX, bookY, bookW, bookH, 2);
    ctx.fill();

    // Pages
    ctx.fillStyle = COL_BOOK_PAGES;
    _roundRect(ctx, bookX + 2, bookY + 1, bookW - 4, bookH - 2, 1);
    ctx.fill();

    // Spine line
    ctx.beginPath();
    ctx.moveTo(cx, bookY);
    ctx.lineTo(cx, bookY + bookH);
    ctx.strokeStyle = COL_BOOK;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Page flip animation – tiny lines as "text"
    const pageSide = (pageFlip % 2 === 0) ? -1 : 1;
    ctx.strokeStyle = '#BBAA88';
    ctx.lineWidth   = 0.6;
    for (let l = 0; l < 4; l++) {
      const lx = cx + pageSide * 3;
      const ly = bookY + 4 + l * 3;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + pageSide * 9, ly);
      ctx.stroke();
    }

    // Page turn indicator
    if (pageFlip % 4 < 2) {
      ctx.beginPath();
      const cornerX = cx + pageSide * 12;
      const cornerY = bookY + bookH - 2;
      ctx.moveTo(cornerX, cornerY);
      ctx.lineTo(cornerX - pageSide * 4, cornerY);
      ctx.lineTo(cornerX, cornerY - 4);
      ctx.closePath();
      ctx.fillStyle = '#E8E0D0';
      ctx.fill();
    }

    ctx.restore();
  }

  // Face
  const faceY = cy - 6;
  _drawEyes(ctx, cx, faceY - 2, { size: 3.5 });
  _drawCheeks(ctx, cx, faceY, 5);
  _drawMouth(ctx, cx, faceY + 6);

  // Glasses (appear with transition)
  if (t > 0.5) {
    const glassAlpha = (t - 0.5) / 0.5;
    ctx.save();
    ctx.globalAlpha  = glassAlpha;
    ctx.strokeStyle  = COL_GLASSES;
    ctx.lineWidth    = 1.5;

    const gy = faceY - 2;
    // Left lens
    ctx.beginPath();
    ctx.arc(cx - 9, gy, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    // Right lens
    ctx.beginPath();
    ctx.arc(cx + 9, gy, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    // Bridge
    ctx.beginPath();
    ctx.moveTo(cx - 3.5, gy);
    ctx.quadraticCurveTo(cx, gy - 2, cx + 3.5, gy);
    ctx.stroke();
    // Temple arms
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 14.5, gy);
      ctx.lineTo(cx + side * 19, gy + 1);
      ctx.stroke();
    }

    // Slight reflection on lenses
    ctx.globalAlpha = glassAlpha * 0.25;
    ctx.fillStyle   = '#FFFFFF';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * 9 - 1.5, gy - 1.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

/**
 * Utility: draw a filled rounded rectangle.
 */
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Export ──────────────────────────────────────────────────────────────────

module.exports = SpriteEngine;
