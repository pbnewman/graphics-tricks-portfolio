
  // ============================================================
  //   SHARED INFRASTRUCTURE
  // ============================================================

  const ACCENT = '#ff7e3d';
  const ACCENT_DIM = '#b85a2a';
  const FG = '#f4f1ea';
  const BG = '#0a0a0c';

  // One deterministic stream per experiment; links restore its starting seed.
  export function makeRandom(seed = 1) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  class Effect {
    constructor(canvas, { seed = 1, settings = {} } = {}) {
      this.canvas = canvas;
      this.settings = settings;
      this.random = makeRandom(seed);
      this.ctx = canvas.getContext('2d', { alpha: false });
      if (!this.ctx) throw new Error('Canvas rendering is unavailable.');
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.tick = 0;
      this.mx = this.my = this.pmx = this.pmy = null;
      this._setSize();
      this.init();
      this.onResize?.();
      this.ro = new ResizeObserver(() => {
        if (this._setSize()) {
          this.onResize?.();
          this.firstFrame = true;
          this.render();
        }
      });
      this.ro.observe(canvas);
    }
    _setSize() {
      const r = this.canvas.getBoundingClientRect();
      if (!r.width || !r.height || (this.w === r.width && this.h === r.height)) return false;
      this.w = r.width; this.h = r.height;
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      return true;
    }
    frame() { this.update(); this.render(); this.tick++; }
    destroy() { this.ro.disconnect(); }
    init() {} update() {} render() {}
  }

  // ============================================================
  //   001 · DOOM FIRE
  // ============================================================
  class FireEffect extends Effect {
    init() {
      this.W = 120; this.H = 90;
      this.buffer = new Uint8Array(this.W * this.H);
      for (let x = 0; x < this.W; x++) this.buffer[(this.H-1)*this.W + x] = 36;

      const fire = [[7,7,7],[31,7,7],[47,15,7],[71,15,7],[87,23,7],[103,31,7],[119,31,7],[143,39,7],[159,47,7],[175,63,7],[191,71,7],[199,71,7],[223,79,7],[223,87,7],[223,87,7],[215,95,7],[215,95,7],[215,103,15],[207,111,15],[207,119,15],[207,127,15],[207,135,23],[199,135,23],[199,143,23],[199,151,31],[191,159,31],[191,159,31],[191,167,39],[191,167,39],[191,175,47],[183,175,47],[183,183,47],[183,183,55],[207,207,111],[223,223,159],[239,239,199],[255,255,255]];
      const plasma = fire.map(c => [c[2], c[1], c[0]]);
      const toxic = fire.map(c => [c[2], c[0], c[1]]);
      const ember = fire.map(c => [c[0], Math.floor(c[1]*0.4), Math.floor(c[2]*0.7)]);
      this.palettes = [fire, plasma, toxic, ember];
      this.paletteIdx = this.settings.preset ?? 0;

      // Offscreen pixel buffer
      this.off = document.createElement('canvas');
      this.off.width = this.W; this.off.height = this.H;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.W, this.H);
    }
    onClick() {
      // Cycle the palette AND blank the buffer so the fire visibly crackles
      // back up from the bottom in the new color, the same way it does on
      // first page load.
      this.paletteIdx = (this.paletteIdx + 1) % this.palettes.length;
      this.buffer.fill(0);
      for (let x = 0; x < this.W; x++) this.buffer[(this.H-1)*this.W + x] = 36;
    }
    update() {
      const W = this.W, H = this.H, buf = this.buffer;
      for (let y = 1; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const src = y * W + x;
          const pixel = buf[src];
          if (pixel === 0) {
            buf[src - W] = 0;
          } else {
            const rand = (this.random() * 4) | 0;
            const dstX = x - rand + 1 + (this.settings.wind ?? 0);
            if (dstX >= 0 && dstX < W) {
              buf[(y-1) * W + dstX] = Math.max(0, pixel - (rand & 1));
            }
          }
        }
      }
    }
    render() {
      const palette = this.palettes[this.paletteIdx];
      const data = this.imgData.data;
      const max = palette.length - 1;
      for (let i = 0; i < this.W * this.H; i++) {
        const c = palette[Math.min(this.buffer[i], max)];
        const j = i * 4;
        data[j] = c[0]; data[j+1] = c[1]; data[j+2] = c[2]; data[j+3] = 255;
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   002 · BOIDS
  // ============================================================
  class BoidsEffect extends Effect {
    init() {
      this.boids = [];
      this.N = this.settings.count ?? 140;
      // Note: this.w/this.h are set by _setSize() before init()
      const W = this.w || 540, H = this.h || 405;
      for (let i = 0; i < this.N; i++) {
        this.boids.push({
          x: this.random() * W,
          y: this.random() * H,
          vx: (this.random() - 0.5) * 2,
          vy: (this.random() - 0.5) * 2,
        });
      }
    }
    onResize() {
      // Keep boids inside the (possibly resized) canvas
      if (!this.boids) return;
      for (const b of this.boids) {
        if (b.x > this.w) b.x = b.x % this.w;
        if (b.y > this.h) b.y = b.y % this.h;
      }
    }
    update() {
      const NEAR = 50, CLOSE = this.settings.separation ?? 16;
      const W = this.w, H = this.h;
      for (const b of this.boids) {
        let avx=0, avy=0, cx=0, cy=0, sx=0, sy=0, n=0;
        for (const o of this.boids) {
          if (o === b) continue;
          const dx = o.x - b.x, dy = o.y - b.y;
          const d2 = dx*dx + dy*dy;
          if (d2 < NEAR*NEAR) {
            avx += o.vx; avy += o.vy;
            cx += o.x; cy += o.y;
            n++;
            if (d2 < CLOSE*CLOSE && d2 > 0) {
              const d = Math.sqrt(d2);
              sx -= dx / d; sy -= dy / d;
            }
          }
        }
        if (n > 0) {
          avx /= n; avy /= n;
          b.vx += (avx - b.vx) * 0.04;
          b.vy += (avy - b.vy) * 0.04;
          cx /= n; cy /= n;
          b.vx += (cx - b.x) * 0.0008;
          b.vy += (cy - b.y) * 0.0008;
        }
        b.vx += sx * 0.06; b.vy += sy * 0.06;

        // Mouse repels
        if (this.mx !== null) {
          const dx = b.x - this.mx, dy = b.y - this.my;
          const d2 = dx*dx + dy*dy;
          if (d2 < 80*80 && d2 > 0) {
            const d = Math.sqrt(d2);
            const f = (80 - d) / 80;
            b.vx += dx/d * f * 1.2;
            b.vy += dy/d * f * 1.2;
          }
        }

        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 2.4) { b.vx = b.vx/sp*2.4; b.vy = b.vy/sp*2.4; }
        if (sp < 0.8 && sp > 0) { b.vx = b.vx/sp*0.8; b.vy = b.vy/sp*0.8; }

        b.x += b.vx; b.y += b.vy;
        if (b.x < 0) b.x += W; if (b.x > W) b.x -= W;
        if (b.y < 0) b.y += H; if (b.y > H) b.y -= H;
      }
    }
    render() {
      const ctx = this.ctx;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = ACCENT;
      for (const b of this.boids) {
        const a = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-3, 2.5);
        ctx.lineTo(-3, -2.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ============================================================
  //   003 · VERLET ROPE
  // ============================================================
  class RopeEffect extends Effect {
    init() {
      this.N = 22;
      this.nodes = [];
      this.linkLen = 9;
      this.gravity = 0.4;
      const W = this.w || 540;
      for (let i = 0; i < this.N; i++) {
        const x = W * 0.5;
        const y = 20 + i * this.linkLen;
        this.nodes.push({ x, y, px: x, py: y });
      }
    }
    onResize() {
      // Rebuild rope if width changed dramatically
      if (!this.nodes || this.nodes.length === 0) {
        const W = this.w;
        for (let i = 0; i < this.N; i++) {
          const x = W * 0.5;
          const y = 20 + i * this.linkLen;
          this.nodes.push({ x, y, px: x, py: y });
        }
      }
    }
    update() {
      const g = this.gravity;
      // Verlet step. Damping 0.99 lets each swing decay before the next
      // pin movement arrives, which keeps the chain reading as a graceful
      // arc rather than thrashing under residual energy from prior frames.
      for (const n of this.nodes) {
        const vx = (n.x - n.px) * 0.99;
        const vy = (n.y - n.py) * 0.99;
        n.px = n.x; n.py = n.y;
        n.x += vx; n.y += vy + g;
      }
      // Pin: follow mouse if hovering, else gentle Lissajous so rope keeps
      // swinging. Frequency 0.007 and amplitude 0.22w give a slow, narrow
      // sweep — enough to keep the chain alive, not enough to whip it.
      let pinX, pinY;
      if (this.mx !== null) {
        pinX = Math.max(20, Math.min(this.w - 20, this.mx));
        pinY = Math.max(20, Math.min(this.h - 80, this.my));
      } else {
        const t = this.tick * 0.007;
        pinX = this.w * 0.5 + Math.sin(t) * this.w * 0.22;
        pinY = 32 + Math.sin(t * 1.7) * 10;
      }
      this.nodes[0].x = pinX; this.nodes[0].y = pinY;

      // Constraint relaxation
      for (let iter = 0; iter < 8; iter++) {
        for (let i = 1; i < this.N; i++) {
          const a = this.nodes[i-1], b = this.nodes[i];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const diff = (d - this.linkLen) / d;
          if (i === 1) {
            b.x -= dx * diff;
            b.y -= dy * diff;
          } else {
            const half = diff * 0.5;
            a.x += dx * half; a.y += dy * half;
            b.x -= dx * half; b.y -= dy * half;
          }
        }
        this.nodes[0].x = pinX; this.nodes[0].y = pinY;
      }
    }
    render() {
      const ctx = this.ctx;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, this.w, this.h);

      // Rope — thicker, accent-tinted
      ctx.strokeStyle = '#d68a5a';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this.nodes[0].x, this.nodes[0].y);
      for (let i = 1; i < this.N; i++) {
        ctx.lineTo(this.nodes[i].x, this.nodes[i].y);
      }
      ctx.stroke();

      // Subtle node dots so the chain reads as articulated
      ctx.fillStyle = 'rgba(244, 241, 234, 0.35)';
      for (let i = 1; i < this.N - 1; i++) {
        ctx.beginPath();
        ctx.arc(this.nodes[i].x, this.nodes[i].y, 1.2, 0, Math.PI*2);
        ctx.fill();
      }

      // Pin (where it's attached)
      const pin = this.nodes[0];
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 5, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 126, 61, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 10, 0, Math.PI*2);
      ctx.stroke();

      // Bob — halo + solid
      const last = this.nodes[this.N-1];
      ctx.fillStyle = 'rgba(255, 126, 61, 0.18)';
      ctx.beginPath();
      ctx.arc(last.x, last.y, 16, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(last.x, last.y, 9, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // ============================================================
  //   PERLIN NOISE (shared)
  // ============================================================
  function makePerlin(seed = 1) {
    const p = [];
    for (let i = 0; i < 256; i++) p.push(i);
    let s = seed;
    const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const fade = t => t*t*t*(t*(t*6 - 15) + 10);
    const lerp = (a, b, t) => a + t*(b - a);
    const grad = (h, x, y) => {
      const v = (h & 3);
      const u = v < 2 ? x : y;
      const w = v < 2 ? y : x;
      return ((v & 1) ? -u : u) + ((v & 2) ? -w : w);
    };
    return (x, y) => {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const A = perm[X] + Y, B = perm[X+1] + Y;
      return lerp(
        lerp(grad(perm[A], x, y), grad(perm[B], x-1, y), u),
        lerp(grad(perm[A+1], x, y-1), grad(perm[B+1], x-1, y-1), u),
        v
      );
    };
  }

  // ============================================================
  //   004 · PERLIN FLOW FIELD
  // ============================================================
  class FlowEffect extends Effect {
    init() {
      this.reseed();
      this.particles = [];
      this.N = 600;
      for (let i = 0; i < this.N; i++) this.particles.push(this._spawn());
      this.firstFrame = true;
    }
    onClick() { this.reseed(); }
    reseed() {
      this.noise = makePerlin(Math.floor(this.random() * 1e6));
      this.firstFrame = true;
    }
    _spawn() {
      return {
        x: this.random() * this.w,
        y: this.random() * this.h,
        age: this.random() * 200,
        maxAge: 100 + this.random() * 200,
      };
    }
    update() {
      const SCALE = this.settings.scale ?? 0.0035;
      const SPEED = 0.9;
      for (const p of this.particles) {
        const a = this.noise(p.x * SCALE, p.y * SCALE + this.tick * 0.0015) * Math.PI * 2;
        p.x += Math.cos(a) * SPEED;
        p.y += Math.sin(a) * SPEED;
        p.age++;
        if (p.x < 0 || p.x > this.w || p.y < 0 || p.y > this.h || p.age > p.maxAge) {
          Object.assign(p, this._spawn());
          p.age = 0;
        }
      }
    }
    render() {
      const ctx = this.ctx;
      if (this.firstFrame) {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, this.w, this.h);
        this.firstFrame = false;
      } else {
        ctx.fillStyle = 'rgba(10, 10, 12, 0.04)';
        ctx.fillRect(0, 0, this.w, this.h);
      }
      ctx.fillStyle = ACCENT;
      for (const p of this.particles) {
        const alpha = Math.min(1, (p.maxAge - p.age) / 60) * 0.7;
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x, p.y, 1.2, 1.2);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ============================================================
  //   005 · DIAMOND-SQUARE TERRAIN
  // ============================================================
  class TerrainEffect extends Effect {
    init() {
      this.SIZE = 129;
      this.heights = new Float32Array(this.SIZE * this.SIZE);
      this.off = document.createElement('canvas');
      this.off.width = this.SIZE; this.off.height = this.SIZE;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.SIZE, this.SIZE);
      this.regenerate();
      this.cycleAt = 360; // ~6s at 60fps
    }
    onClick() { this.regenerate(); }
    regenerate() {
      const SIZE = this.SIZE;
      const h = this.heights;
      h.fill(0);
      h[0] = this.random() * 2 - 1;
      h[SIZE-1] = this.random() * 2 - 1;
      h[(SIZE-1)*SIZE] = this.random() * 2 - 1;
      h[SIZE*SIZE - 1] = this.random() * 2 - 1;
      let step = SIZE - 1;
      let scale = 1;
      while (step > 1) {
        const half = step >> 1;
        // Diamond
        for (let y = half; y < SIZE; y += step) {
          for (let x = half; x < SIZE; x += step) {
            const a = h[(y-half)*SIZE + (x-half)];
            const b = h[(y-half)*SIZE + (x+half)];
            const c = h[(y+half)*SIZE + (x-half)];
            const d = h[(y+half)*SIZE + (x+half)];
            h[y*SIZE + x] = (a+b+c+d) * 0.25 + (this.random() - 0.5) * scale;
          }
        }
        // Square
        for (let y = 0; y < SIZE; y += half) {
          const startX = ((y / half) & 1) === 0 ? half : 0;
          for (let x = startX; x < SIZE; x += step) {
            let sum = 0, count = 0;
            if (x >= half) { sum += h[y*SIZE + (x-half)]; count++; }
            if (x + half < SIZE) { sum += h[y*SIZE + (x+half)]; count++; }
            if (y >= half) { sum += h[(y-half)*SIZE + x]; count++; }
            if (y + half < SIZE) { sum += h[(y+half)*SIZE + x]; count++; }
            h[y*SIZE + x] = sum / count + (this.random() - 0.5) * scale;
          }
        }
        step = half;
        scale *= 0.55;
      }
      // Render once into imgData
      this.renderHeights();
      this.cycleAt = this.tick + 360;
    }
    renderHeights() {
      const SIZE = this.SIZE;
      const h = this.heights;
      // Find min/max for normalization
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < SIZE*SIZE; i++) { mn = Math.min(mn, h[i]); mx = Math.max(mx, h[i]); }
      const range = mx - mn || 1;

      // Lighting: dot product with light direction (in heightfield space)
      const data = this.imgData.data;
      const lx = -0.5, ly = -0.7, lz = 0.5;
      const lLen = Math.hypot(lx, ly, lz);
      const lnx = lx/lLen, lny = ly/lLen, lnz = lz/lLen;

      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const i = y*SIZE + x;
          const hv = (h[i] - mn) / range; // 0..1

          // Compute slope-based normal
          const xL = x > 0 ? h[i-1] : h[i];
          const xR = x < SIZE-1 ? h[i+1] : h[i];
          const yU = y > 0 ? h[i-SIZE] : h[i];
          const yD = y < SIZE-1 ? h[i+SIZE] : h[i];
          const dx = (xR - xL);
          const dy = (yD - yU);
          // Normal is (-dx, -dy, scale_factor); normalize
          const nz = 0.05;
          const nLen = Math.hypot(dx, dy, nz);
          const nx = -dx/nLen, ny_ = -dy/nLen, nzn = nz/nLen;
          const dot = Math.max(0, nx*lnx + ny_*lny + nzn*lnz);

          // Color ramp: water -> beach -> grass -> rock -> snow
          let r, g, b;
          if (hv < 0.32) {
            const t = hv / 0.32;
            r = 18 + t*22; g = 28 + t*42; b = 52 + t*60;
          } else if (hv < 0.38) {
            const t = (hv - 0.32) / 0.06;
            r = 40 + t*120; g = 70 + t*100; b = 112 - t*48;
          } else if (hv < 0.6) {
            const t = (hv - 0.38) / 0.22;
            r = 160 - t*90; g = 170 - t*70; b = 64 - t*20;
          } else if (hv < 0.78) {
            const t = (hv - 0.6) / 0.18;
            r = 70 + t*60; g = 100 + t*50; b = 44 + t*60;
          } else {
            const t = Math.min(1, (hv - 0.78) / 0.22);
            r = 130 + t*125; g = 150 + t*105; b = 104 + t*150;
          }

          // Apply shading
          const shade = 0.4 + 0.6 * dot;
          r = Math.min(255, r * shade);
          g = Math.min(255, g * shade);
          b = Math.min(255, b * shade);

          const j = i * 4;
          data[j] = r; data[j+1] = g; data[j+2] = b; data[j+3] = 255;
        }
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
    }
    update() {
      if (this.tick > this.cycleAt) this.regenerate();
    }
    render() {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   006 · MODE 7
  // ============================================================
  class Mode7Effect extends Effect {
    init() {
      this.RW = 360; this.RH = 200;
      this.off = document.createElement('canvas');
      this.off.width = this.RW; this.off.height = this.RH;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.RW, this.RH);
      this.camZ = 0;
      this.camX = 0;
    }
    update() {
      this.camZ += 0.6;
      this.camX = Math.sin(this.tick * 0.004) * 4;
    }
    render() {
      const RW = this.RW, RH = this.RH;
      const horizon = RH * 0.46;
      const data = this.imgData.data;

      // Sky (gradient)
      for (let y = 0; y < horizon; y++) {
        const t = y / horizon;
        const r = 18 + t*32;
        const g = 16 + t*40;
        const b = 24 + t*60;
        for (let x = 0; x < RW; x++) {
          const j = (y*RW + x) * 4;
          data[j] = r; data[j+1] = g; data[j+2] = b; data[j+3] = 255;
        }
      }
      // Sun
      const sunY = horizon * 0.7, sunX = RW * 0.5;
      for (let y = 0; y < horizon; y++) {
        for (let x = 0; x < RW; x++) {
          const dx = x - sunX, dy = y - sunY;
          const d = Math.hypot(dx, dy);
          if (d < 28) {
            const t = 1 - d/28;
            const j = (y*RW + x) * 4;
            data[j]   = Math.min(255, data[j]   + 220*t*t);
            data[j+1] = Math.min(255, data[j+1] + 130*t*t);
            data[j+2] = Math.min(255, data[j+2] + 60*t*t);
          }
        }
      }

      // Ground (Mode 7) — pure checker, no overlay stripe so the texture
      // stays constant frame to frame.
      const focal = RH * 0.35;
      for (let y = horizon; y < RH; y++) {
        const dy = y - horizon;
        const worldZ = focal / dy * 6;
        const scale = worldZ / focal;
        // Fog factor based on depth
        const fog = Math.min(1, dy / (RH - horizon) * 1.4);
        for (let x = 0; x < RW; x++) {
          const wx = (x - RW * 0.5) * scale + this.camX;
          const wz = worldZ + this.camZ;
          // Checkerboard 6 units
          const cx = Math.floor(wx / 6);
          const cz = Math.floor(wz / 6);
          let r, g, b;
          if (((cx + cz) & 1) === 0) {
            r = 30; g = 32; b = 40;
          } else {
            r = 70; g = 56; b = 44;
          }
          // Apply fog (fade to sky bg)
          r = r * fog + 28 * (1-fog);
          g = g * fog + 30 * (1-fog);
          b = b * fog + 44 * (1-fog);

          const j = (y*RW + x) * 4;
          data[j] = r; data[j+1] = g; data[j+2] = b; data[j+3] = 255;
        }
      }

      this.offCtx.putImageData(this.imgData, 0, 0);

      // Mountain range — procedurally generated and projected with the same
      // perspective as the ground. The camera has height 6 (implied by the
      // ground formula worldZ = focal · 6 / dy), so a peak at world height H
      // above the ground projects to screen_y = horizon - (H - 6) · focal / rel_z.
      // Mountains are placed laterally on both sides of the road; as the
      // camera advances they spread outward to the screen edges, creating
      // the "driving through a pass" illusion. Positions are hashed by
      // z-slot index so the same mountain reappears at the same spot if
      // you scrolled back (impossible since we only go forward, but the
      // procedural shape stays self-consistent rather than reshuffling
      // every frame).
      const mountainSpacing = 14;
      const minDist = 4;
      const maxDist = 180;
      const sMin = Math.ceil((this.camZ + minDist) / mountainSpacing);
      const sMax = Math.floor((this.camZ + maxDist) / mountainSpacing);

      const mountains = [];
      for (let s = sMin; s <= sMax; s++) {
        // Deterministic hash → three pseudo-random values in [0, 1).
        let h = ((s * 73856093) ^ 0x9e3779b9) >>> 0;
        h = ((h ^ (h >>> 13)) * 0x85ebca6b) >>> 0;
        h = (h ^ (h >>> 16)) >>> 0;
        let h2 = ((s * 19349663) ^ 0xdeadbeef) >>> 0;
        h2 = ((h2 ^ (h2 >>> 13)) * 0xc2b2ae35) >>> 0;
        h2 = (h2 ^ (h2 >>> 16)) >>> 0;
        const r1 = (h & 0xFFFF) / 0x10000;
        const r2 = ((h >>> 16) & 0xFFFF) / 0x10000;
        const r3 = (h2 & 0xFFFF) / 0x10000;

        if (r1 < 0.32) continue;          // ~32% of slots empty (breaks up regularity)

        const sideSign = r2 < 0.5 ? -1 : 1;
        const wx = sideSign * (22 + r3 * 28);   // 22–50 units off the road centerline
        const wz = s * mountainSpacing;
        const peakH = 14 + r3 * 16;             // world height 14–30 (camera is at 6)
        const baseW = 18 + r2 * 18;             // world base width 18–36

        const rel_z = wz - this.camZ;
        if (rel_z <= 0) continue;

        const cx_screen = (wx - this.camX) * focal / rel_z + RW * 0.5;
        const peak_y = horizon - (peakH - 6) * focal / rel_z;
        const half_w = baseW * focal / rel_z * 0.5;

        // Cull if entirely off-screen horizontally or if peak fails to clear horizon
        if (cx_screen + half_w < 0 || cx_screen - half_w > RW) continue;
        if (peak_y >= horizon) continue;

        mountains.push({ cx: cx_screen, peakY: peak_y, halfW: half_w, z: rel_z });
      }

      // Render far-to-near so closer mountains overlap distant ones.
      mountains.sort((a, b) => b.z - a.z);

      // Atmospheric perspective: far peaks tint toward the horizon's sky
      // color so they recede gracefully. Sky color at horizon (from the
      // gradient above): (50, 56, 84). Mountain core: dark cool blue.
      const mountainBase = [22, 22, 36];
      const skyAtHorizon = [50, 56, 84];

      // Clip the drawing region to above the horizon so the natural
      // triangle that we draw with its base AT the horizon line doesn't
      // bleed pixels onto the ground — the ground covers the bases of
      // close mountains the way it would in reality.
      this.offCtx.save();
      this.offCtx.beginPath();
      this.offCtx.rect(0, 0, RW, horizon);
      this.offCtx.clip();

      for (const m of mountains) {
        const fog = Math.max(0, Math.min(1, 1 - m.z / 150));
        const r = (mountainBase[0] * fog + skyAtHorizon[0] * (1 - fog)) | 0;
        const g = (mountainBase[1] * fog + skyAtHorizon[1] * (1 - fog)) | 0;
        const b = (mountainBase[2] * fog + skyAtHorizon[2] * (1 - fog)) | 0;
        this.offCtx.fillStyle = `rgb(${r},${g},${b})`;
        this.offCtx.beginPath();
        this.offCtx.moveTo(m.cx - m.halfW, horizon);
        this.offCtx.lineTo(m.cx, m.peakY);
        this.offCtx.lineTo(m.cx + m.halfW, horizon);
        this.offCtx.closePath();
        this.offCtx.fill();
      }
      this.offCtx.restore();

      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   007 · SPATIAL HASH COLLISION
  // ============================================================
  class HashEffect extends Effect {
    init() {
      this.N = 320;
      this.r = 5;
      this.cellSize = this.r * 2;
      this.balls = [];
      for (let i = 0; i < this.N; i++) {
        const a = this.random() * Math.PI * 2;
        const sp = 0.5 + this.random() * 1.6;
        this.balls.push({
          x: this.random() * 800,
          y: this.random() * 600,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          id: i,
        });
      }
      this.grid = new Map();
    }
    onClick(cx, cy) {
      // Push balls outward
      for (const b of this.balls) {
        const dx = b.x - cx, dy = b.y - cy;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 120) {
          const f = (120 - d) / 120 * 6;
          b.vx += dx/d * f;
          b.vy += dy/d * f;
        }
      }
    }
    onResize() {
      for (const b of this.balls) {
        b.x = Math.min(Math.max(b.x, this.r), this.w - this.r);
        b.y = Math.min(Math.max(b.y, this.r), this.h - this.r);
      }
    }
    update() {
      const r = this.r, W = this.w, H = this.h;
      // Move + bounce
      for (const b of this.balls) {
        b.x += b.vx; b.y += b.vy;
        if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); }
        if (b.x > W-r) { b.x = W-r; b.vx = -Math.abs(b.vx); }
        if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy); }
        if (b.y > H-r) { b.y = H-r; b.vy = -Math.abs(b.vy); }
        // gentle damping
        b.vx *= 0.999; b.vy *= 0.999;
      }
      // Build hash
      this.grid.clear();
      const cs = this.cellSize;
      for (const b of this.balls) {
        const cx = Math.floor(b.x / cs);
        const cy = Math.floor(b.y / cs);
        const k = cx * 100000 + cy;
        let cell = this.grid.get(k);
        if (!cell) { cell = []; this.grid.set(k, cell); }
        cell.push(b);
      }
      // Resolve
      const r2 = r * 2;
      for (const b of this.balls) {
        const cx = Math.floor(b.x / cs);
        const cy = Math.floor(b.y / cs);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const cell = this.grid.get((cx+dx) * 100000 + (cy+dy));
            if (!cell) continue;
            for (const o of cell) {
              if (o.id <= b.id) continue;
              const ddx = o.x - b.x, ddy = o.y - b.y;
              const d2 = ddx*ddx + ddy*ddy;
              if (d2 > 0 && d2 < r2*r2) {
                const d = Math.sqrt(d2);
                const nx = ddx/d, ny = ddy/d;
                const overlap = (r2 - d) * 0.5;
                b.x -= nx * overlap; b.y -= ny * overlap;
                o.x += nx * overlap; o.y += ny * overlap;
                const va = b.vx*nx + b.vy*ny;
                const vb = o.vx*nx + o.vy*ny;
                const dv = vb - va;
                b.vx += dv*nx; b.vy += dv*ny;
                o.vx -= dv*nx; o.vy -= dv*ny;
              }
            }
          }
        }
      }
    }
    render() {
      const ctx = this.ctx;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = ACCENT;
      for (const b of this.balls) {
        const sp = Math.hypot(b.vx, b.vy);
        const t = Math.min(1, sp / 3);
        ctx.fillStyle = `rgba(255, 126, 61, ${0.4 + t*0.6})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, this.r, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // ============================================================
  //   008 · CRITICALLY DAMPED SPRING vs LERP
  // ============================================================
  class SpringEffect extends Effect {
    init() {
      this.lerp = { x: 0, y: 0 };
      this.spring = { x: 0, y: 0, vx: 0, vy: 0 };
      this.target = { x: 0, y: 0 };
      this.targetT = 0;
      this.trails = { lerp: [], spring: [] };
      this.MAX_TRAIL = 40;
    }
    onResize() {
      this.lerp.x = this.w * 0.5;
      this.lerp.y = this.h * 0.5;
      this.spring.x = this.w * 0.5;
      this.spring.y = this.h * 0.5;
      this.target.x = this.w * 0.5;
      this.target.y = this.h * 0.5;
    }
    update() {
      // Target: cursor if available, else animated path
      if (this.mx !== null) {
        this.target.x = this.mx;
        this.target.y = this.my;
      } else {
        this.targetT += 0.012;
        this.target.x = this.w * 0.5 + Math.cos(this.targetT * 1.3) * this.w * 0.3;
        this.target.y = this.h * 0.5 + Math.sin(this.targetT * 1.7) * this.h * 0.25;
      }

      // Linear lerp
      const k = 0.08;
      this.lerp.x += (this.target.x - this.lerp.x) * k;
      this.lerp.y += (this.target.y - this.lerp.y) * k;

      // Critically damped spring (semi-implicit, omega=0.18 ish)
      const omega = 0.22;
      const ax = (this.target.x - this.spring.x) * omega * omega - 2 * omega * this.spring.vx;
      const ay = (this.target.y - this.spring.y) * omega * omega - 2 * omega * this.spring.vy;
      this.spring.vx += ax;
      this.spring.vy += ay;
      this.spring.x += this.spring.vx;
      this.spring.y += this.spring.vy;

      // Update trails
      this.trails.lerp.push({ x: this.lerp.x, y: this.lerp.y });
      this.trails.spring.push({ x: this.spring.x, y: this.spring.y });
      if (this.trails.lerp.length > this.MAX_TRAIL) this.trails.lerp.shift();
      if (this.trails.spring.length > this.MAX_TRAIL) this.trails.spring.shift();
    }
    render() {
      const ctx = this.ctx;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, this.w, this.h);

      // Labels
      ctx.font = '10px JetBrains Mono';
      ctx.fillStyle = '#5a5650';
      ctx.fillText('LERP (0.08)', 16, 22);
      ctx.fillStyle = ACCENT;
      ctx.fillText('CRITICALLY DAMPED SPRING', 16, 38);

      // Target crosshair
      ctx.strokeStyle = 'rgba(244, 241, 234, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.target.x, this.target.y, 14, 0, Math.PI*2);
      ctx.moveTo(this.target.x - 18, this.target.y);
      ctx.lineTo(this.target.x + 18, this.target.y);
      ctx.moveTo(this.target.x, this.target.y - 18);
      ctx.lineTo(this.target.x, this.target.y + 18);
      ctx.stroke();

      // Lerp trail
      this._drawTrail(this.trails.lerp, '#5a5650', 'rgba(90, 86, 80, 0.5)');
      // Spring trail
      this._drawTrail(this.trails.spring, ACCENT, 'rgba(255, 126, 61, 0.5)');

      // Lerp dot
      ctx.fillStyle = '#5a5650';
      ctx.beginPath();
      ctx.arc(this.lerp.x, this.lerp.y, 5, 0, Math.PI*2);
      ctx.fill();

      // Spring dot
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(this.spring.x, this.spring.y, 7, 0, Math.PI*2);
      ctx.fill();
    }
    _drawTrail(trail, color, faint) {
      if (trail.length < 2) return;
      const ctx = this.ctx;
      ctx.strokeStyle = faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  // ============================================================
  //   009 · SDF BLOBS
  // ============================================================
  class SDFEffect extends Effect {
    init() {
      this.RW = 200; this.RH = 150;
      this.off = document.createElement('canvas');
      this.off.width = this.RW; this.off.height = this.RH;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.RW, this.RH);
      this.blobs = [];
      for (let i = 0; i < 5; i++) {
        this.blobs.push({
          x: 0.3 + 0.4 * this.random(),
          y: 0.3 + 0.4 * this.random(),
          r: 12 + this.random() * 12,
          ang: this.random() * Math.PI * 2,
          spd: 0.4 + this.random() * 0.8,
          phase: this.random() * 100,
        });
      }
    }
    update() {
      // Animate blob positions
      const t = this.tick * 0.005;
      for (let i = 0; i < this.blobs.length; i++) {
        const b = this.blobs[i];
        b.tx = (0.5 + Math.cos(t * b.spd + b.phase) * 0.3) * this.RW;
        b.ty = (0.5 + Math.sin(t * b.spd * 1.3 + b.phase * 1.7) * 0.3) * this.RH;
      }
      // First blob follows mouse if hovering
      if (this.mx !== null) {
        const tx = (this.mx / this.w) * this.RW;
        const ty = (this.my / this.h) * this.RH;
        this.blobs[0].tx = tx;
        this.blobs[0].ty = ty;
      }
    }
    render() {
      const RW = this.RW, RH = this.RH;
      const data = this.imgData.data;
      const blobs = this.blobs;
      const SMOOTH_K = 18;

      function smin(a, b, k) {
        const h = Math.max(k - Math.abs(a - b), 0) / k;
        return Math.min(a, b) - h * h * k * 0.25;
      }

      for (let y = 0; y < RH; y++) {
        for (let x = 0; x < RW; x++) {
          let d = 1e9;
          for (let i = 0; i < blobs.length; i++) {
            const b = blobs[i];
            const dx = x - b.tx, dy = y - b.ty;
            const dd = Math.sqrt(dx*dx + dy*dy) - b.r;
            d = smin(d, dd, SMOOTH_K);
          }
          const idx = (y * RW + x) * 4;
          let r, g, b_;
          if (d < 0) {
            // Inside: amber gradient based on depth
            const t = Math.min(1, -d / 30);
            r = 255; g = 126 - t*40; b_ = 61 - t*40;
          } else if (d < 1.2) {
            // Edge highlight
            r = 255; g = 200; b_ = 140;
          } else {
            // Outside: contour rings
            const ring = Math.sin(d * 0.35) * 0.5 + 0.5;
            const fade = Math.max(0, 1 - d / 60);
            const v = ring * fade * 28;
            r = 12 + v; g = 12 + v * 0.6; b_ = 14 + v * 0.4;
          }
          data[idx] = r; data[idx+1] = g; data[idx+2] = b_; data[idx+3] = 255;
        }
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   010 · STABLE FLUIDS (Stam, 1999)
  // ============================================================
  class FluidEffect extends Effect {
    init() {
      this.N = 96;                          // sim grid (interior)
      const S = (this.N + 2) * (this.N + 2);
      this.size = S;
      this.u  = new Float32Array(S);        // x velocity
      this.v  = new Float32Array(S);        // y velocity
      this.u0 = new Float32Array(S);        // scratch / prev
      this.v0 = new Float32Array(S);
      this.d  = new Float32Array(S);        // density (smoke)
      this.d0 = new Float32Array(S);

      this.dt   = 0.12;
      this.iter = 20;                       // Jacobi iterations

      // Offscreen canvas at sim resolution; upscaled to display
      this.off = document.createElement('canvas');
      this.off.width  = this.N + 2;
      this.off.height = this.N + 2;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.N + 2, this.N + 2);
    }
    IX(i, j) { return i + (this.N + 2) * j; }

    set_bnd(b, x) {
      const N = this.N;
      for (let i = 1; i <= N; i++) {
        x[this.IX(0,     i)] = b === 1 ? -x[this.IX(1, i)] : x[this.IX(1, i)];
        x[this.IX(N + 1, i)] = b === 1 ? -x[this.IX(N, i)] : x[this.IX(N, i)];
        x[this.IX(i,     0)] = b === 2 ? -x[this.IX(i, 1)] : x[this.IX(i, 1)];
        x[this.IX(i, N + 1)] = b === 2 ? -x[this.IX(i, N)] : x[this.IX(i, N)];
      }
      x[this.IX(0,     0)]     = 0.5 * (x[this.IX(1,     0)]     + x[this.IX(0,     1)]);
      x[this.IX(0,     N + 1)] = 0.5 * (x[this.IX(1,     N + 1)] + x[this.IX(0,     N)]);
      x[this.IX(N + 1, 0)]     = 0.5 * (x[this.IX(N,     0)]     + x[this.IX(N + 1, 1)]);
      x[this.IX(N + 1, N + 1)] = 0.5 * (x[this.IX(N,     N + 1)] + x[this.IX(N + 1, N)]);
    }

    advect(b, d, d0, u, v, dt) {
      const N = this.N;
      const dt0 = dt * N;
      for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
          let x = i - dt0 * u[this.IX(i, j)];
          let y = j - dt0 * v[this.IX(i, j)];
          if (x < 0.5)     x = 0.5;
          if (x > N + 0.5) x = N + 0.5;
          if (y < 0.5)     y = 0.5;
          if (y > N + 0.5) y = N + 0.5;
          const i0 = x | 0, i1 = i0 + 1;
          const j0 = y | 0, j1 = j0 + 1;
          const s1 = x - i0, s0 = 1 - s1;
          const t1 = y - j0, t0 = 1 - t1;
          d[this.IX(i, j)] =
            s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) +
            s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)]);
        }
      }
      this.set_bnd(b, d);
    }

    project(u, v, p, div) {
      const N = this.N;
      const h = 1.0 / N;
      for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
          div[this.IX(i, j)] = -0.5 * h * (
            u[this.IX(i + 1, j)] - u[this.IX(i - 1, j)] +
            v[this.IX(i, j + 1)] - v[this.IX(i, j - 1)]
          );
          p[this.IX(i, j)] = 0;
        }
      }
      this.set_bnd(0, div);
      this.set_bnd(0, p);
      // Gauss-Seidel iterations to solve ∇²p = ∇·u
      for (let k = 0; k < this.iter; k++) {
        for (let j = 1; j <= N; j++) {
          for (let i = 1; i <= N; i++) {
            p[this.IX(i, j)] = (div[this.IX(i, j)] +
              p[this.IX(i - 1, j)] + p[this.IX(i + 1, j)] +
              p[this.IX(i, j - 1)] + p[this.IX(i, j + 1)]) * 0.25;
          }
        }
        this.set_bnd(0, p);
      }
      // Subtract pressure gradient → divergence-free velocity
      for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
          u[this.IX(i, j)] -= 0.5 * (p[this.IX(i + 1, j)] - p[this.IX(i - 1, j)]) / h;
          v[this.IX(i, j)] -= 0.5 * (p[this.IX(i, j + 1)] - p[this.IX(i, j - 1)]) / h;
        }
      }
      this.set_bnd(1, u);
      this.set_bnd(2, v);
    }

    update() {
      const N = this.N;
      // Inject fluid from mouse drag
      if (this.mx !== null && this.pmx !== null) {
        const cx = ((this.mx / this.w) * N) | 0;
        const cy = ((this.my / this.h) * N) | 0;
        const dx = (this.mx - this.pmx) * 0.6;
        const dy = (this.my - this.pmy) * 0.6;
        if (cx >= 1 && cx <= N && cy >= 1 && cy <= N) {
          for (let oj = -2; oj <= 2; oj++) {
            for (let oi = -2; oi <= 2; oi++) {
              const ix = this.IX(cx + oi, cy + oj);
              this.u[ix] += dx;
              this.v[ix] += dy;
              this.d[ix] += 60;
            }
          }
        }
      }
      // Ambient smoke sources so the canvas is never dead. Two columns at
      // different horizontal positions, each with its own slow horizontal
      // swing and slightly different vertical pulse — they curl past each
      // other and the resulting interference is much more alive than a
      // single source pendulating back and forth.
      if (this.mx === null) {
        const t = this.tick * 0.022;
        const sources = [
          { cx: ((Math.sin(t) * 0.10 + 0.30) * N) | 0,         // left source ranges 0.20–0.40
            push: 2.8 + Math.sin(t * 1.3) * 0.9,
            sway: Math.cos(t * 1.4) * 1.1,
            density: 24 + Math.sin(t * 0.8) * 4 },
          { cx: ((Math.sin(t * 1.27 + 1.1) * 0.10 + 0.70) * N) | 0,  // right source ranges 0.60–0.80
            push: 2.6 + Math.cos(t * 1.7 + 0.4) * 0.9,
            sway: Math.sin(t * 0.9 + 1.3) * 1.3,
            density: 22 + Math.cos(t * 0.6) * 4 },
        ];
        const cy = N - 6;
        for (const s of sources) {
          for (let oj = -2; oj <= 2; oj++) {
            for (let oi = -3; oi <= 3; oi++) {
              const ix = this.IX(s.cx + oi, cy + oj);
              this.d[ix] += s.density;
              this.v[ix] -= s.push;
              this.u[ix] += s.sway;
            }
          }
        }
      }

      // Velocity step: project → advect → project
      // (skip diffuse since viscosity ≈ 0)
      [this.u, this.u0] = [this.u0, this.u];
      [this.v, this.v0] = [this.v0, this.v];
      this.project(this.u0, this.v0, this.u, this.v);
      this.advect(1, this.u, this.u0, this.u0, this.v0, this.dt);
      this.advect(2, this.v, this.v0, this.u0, this.v0, this.dt);
      this.project(this.u, this.v, this.u0, this.v0);

      // Density step: advect smoke through velocity field, fade out
      [this.d, this.d0] = [this.d0, this.d];
      this.advect(0, this.d, this.d0, this.u, this.v, this.dt);
      const dis = 0.992;
      for (let i = 0; i < this.size; i++) this.d[i] *= dis;
    }

    render() {
      const W = this.N + 2;
      const data = this.imgData.data;
      // Map density → black → ember red → amber → near-white
      for (let i = 0; i < W * W; i++) {
        const d = Math.min(1, this.d[i] / 80);
        // Ramp through palette stops
        let r, g, b;
        if (d < 0.3) {
          const t = d / 0.3;
          r = 60 * t; g = 12 * t; b = 8 * t;
        } else if (d < 0.7) {
          const t = (d - 0.3) / 0.4;
          r = 60 + 195 * t;
          g = 12 + 114 * t;
          b = 8 + 53 * t;
        } else {
          const t = (d - 0.7) / 0.3;
          r = 255;
          g = 126 + 100 * t;
          b = 61 + 140 * t;
        }
        const j = i * 4;
        data[j] = r; data[j + 1] = g; data[j + 2] = b; data[j + 3] = 255;
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = '#0a0a0c';
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(this.off, 1, 1, this.N, this.N, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   011 · CURL NOISE (Bridson, 2007)
  // ============================================================
  class CurlEffect extends Effect {
    init() {
      this.noise = makePerlin((this.random() * 1e6) | 0);
      this.streamers = [];
      this.N = 100;
      const W = this.w || 540, H = this.h || 405;
      for (let i = 0; i < this.N; i++) this.streamers.push(this._spawn(W, H));
    }
    _spawn(W, H) {
      W = W || this.w; H = H || this.h;
      return {
        x: this.random() * W,
        y: this.random() * H,
        hist: [],
        age: 0,
        maxAge: 90 + this.random() * 90,
      };
    }
    onClick() {
      this.noise = makePerlin((this.random() * 1e6) | 0);
    }
    // Curl of scalar field F in 2D = (∂F/∂y, −∂F/∂x).
    // Sampling Perlin noise as F gives a divergence-free vector field.
    _curl(x, y, t) {
      const SCALE = this.settings.scale ?? 0.0035;            // noise-space units per pixel
      const eps = 0.01;                // finite-difference offset in noise space
      const n = this.noise;
      const nx = x * SCALE, ny = y * SCALE + t;
      const dFdy = (n(nx, ny + eps) - n(nx, ny - eps)) / (2 * eps);
      const dFdx = (n(nx + eps, ny) - n(nx - eps, ny)) / (2 * eps);
      return [dFdy, -dFdx];
    }
    update() {
      const t = this.tick * 0.0008;
      for (const s of this.streamers) {
        const [vx, vy] = this._curl(s.x, s.y, t);
        // Normalize to fixed speed — streamlines all read at consistent length
        const mag = Math.hypot(vx, vy);
        if (mag > 1e-6) {
          const SPEED = 3.0;
          s.x += vx / mag * SPEED;
          s.y += vy / mag * SPEED;
        }
        s.hist.push(s.x, s.y);
        // Keep ~32 trailing points (each point = 2 entries in flat array)
        if (s.hist.length > 64) { s.hist.shift(); s.hist.shift(); }
        s.age++;
        if (s.x < 0 || s.x > this.w || s.y < 0 || s.y > this.h || s.age > s.maxAge) {
          Object.assign(s, this._spawn());
          s.hist.length = 0;
        }
      }
    }
    render() {
      const ctx = this.ctx;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.lineCap = 'round';
      for (const s of this.streamers) {
        const N = s.hist.length >> 1;
        if (N < 2) continue;
        const lifeFade = Math.min(1, (s.maxAge - s.age) / 30, s.age / 10);
        // Each segment fades from tail (faint) to head (bright);
        // line thickness also tapers so streamers read as ribbons of flow.
        for (let i = 1; i < N; i++) {
          const t = i / N;
          const x0 = s.hist[(i - 1) * 2],     y0 = s.hist[(i - 1) * 2 + 1];
          const x1 = s.hist[i * 2],           y1 = s.hist[i * 2 + 1];
          ctx.strokeStyle = 'rgba(255, 126, 61, ' + (t * t * 0.7 * lifeFade).toFixed(3) + ')';
          ctx.lineWidth = 0.5 + t * 1.4;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }
    }
  }

  // ============================================================
  //   012 · FLUID ON THE GPU (Stam's algorithm in fragment shaders)
  // ============================================================
  class FluidGLEffect {
    constructor(canvas, { seed = 1, settings = {} } = {}) {
      this.canvas = canvas;
      this.settings = settings;
      this.random = makeRandom(seed);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.tick = 0;
      this.mx = this.my = this.pmx = this.pmy = null;
      this._setSize();
      const gl = canvas.getContext('webgl2', { alpha: false, premultipliedAlpha: false });
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
        throw new Error('GPU fluid is unavailable on this device. Try Stable fluids in this chapter.');
      }
      this.gl = gl;
      this.ro = new ResizeObserver(() => { this._setSize(); this.render(); });
      this.ro.observe(canvas);
      this.SIM = 256;
      this.DYE = 512;

      this._initPrograms();
      this._initQuad();
      this._initFBOs();
    }

    _setSize() {
      const r = this.canvas.getBoundingClientRect();
      if (r.width === 0) return;
      this.w = r.width; this.h = r.height;
      this.canvas.width  = Math.floor(this.w * this.dpr);
      this.canvas.height = Math.floor(this.h * this.dpr);
    }

    destroy() {
      this.ro.disconnect();
      this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    }

    frame() { this._step(); this.tick++; }

    render() {
      if (!this.gl || !this.dye) return;
      const gl = this.gl;
      gl.useProgram(this.dispProg.p);
      gl.uniform1i(this.dispProg.u.uDye, this.dye.read.attach(0, gl));
      this._blit(null);
    }

    _shader(type, src) {
      const gl = this.gl;
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s), src);
        return null;
      }
      return s;
    }

    _program(vsSrc, fsSrc) {
      const gl = this.gl;
      const vs = this._shader(gl.VERTEX_SHADER, vsSrc);
      const fs = this._shader(gl.FRAGMENT_SHADER, fsSrc);
      const p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error('Link error:', gl.getProgramInfoLog(p));
        return null;
      }
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        u[info.name] = gl.getUniformLocation(p, info.name);
      }
      return { p, u };
    }

    _initPrograms() {
      const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

      const ADV = `#version 300 es
precision highp float;
uniform sampler2D uVel;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uDt;
uniform float uDiss;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 coord = vUv - uDt * texture(uVel, vUv).xy * uTexel;
  outColor = texture(uSrc, coord) * uDiss;
}`;

      const SPLAT = `#version 300 es
precision highp float;
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;
uniform float uAspect;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  vec3 base = texture(uTarget, vUv).xyz;
  outColor = vec4(base + splat, 1.0);
}`;

      const DIV = `#version 300 es
precision highp float;
uniform sampler2D uVel;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).y;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

      const PRES = `#version 300 es
precision highp float;
uniform sampler2D uPres;
uniform sampler2D uDiv;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  float L = texture(uPres, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPres, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPres, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPres, vUv + vec2(0.0, uTexel.y)).x;
  float d = texture(uDiv, vUv).x;
  float p = (L + R + B + T - d) * 0.25;
  outColor = vec4(p, 0.0, 0.0, 1.0);
}`;

      const GRAD = `#version 300 es
precision highp float;
uniform sampler2D uPres;
uniform sampler2D uVel;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  float L = texture(uPres, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPres, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPres, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPres, vUv + vec2(0.0, uTexel.y)).x;
  vec2 v = texture(uVel, vUv).xy;
  v -= vec2(R - L, T - B) * 0.5;
  outColor = vec4(v, 0.0, 1.0);
}`;

      const DISP = `#version 300 es
precision highp float;
uniform sampler2D uDye;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = texture(uDye, vUv).rgb;
  c = c / (c + 1.0);          // Reinhard tonemap
  outColor = vec4(c, 1.0);
}`;

      this.advProg   = this._program(VS, ADV);
      this.splatProg = this._program(VS, SPLAT);
      this.divProg   = this._program(VS, DIV);
      this.presProg  = this._program(VS, PRES);
      this.gradProg  = this._program(VS, GRAD);
      this.dispProg  = this._program(VS, DISP);
    }

    _initQuad() {
      const gl = this.gl;
      this.vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1, -1,  1,
         1, -1,  1,  1, -1,  1,
      ]), gl.STATIC_DRAW);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      const loc = gl.getAttribLocation(this.advProg.p, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    }

    _createFBO(w, h, filter) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        tex, fbo, w, h,
        tx: 1 / w, ty: 1 / h,
        attach(unit, gl_) { gl_.activeTexture(gl_.TEXTURE0 + unit); gl_.bindTexture(gl_.TEXTURE_2D, tex); return unit; }
      };
    }

    _createDoubleFBO(w, h, filter) {
      let a = this._createFBO(w, h, filter);
      let b = this._createFBO(w, h, filter);
      return {
        w, h, tx: 1 / w, ty: 1 / h,
        get read()  { return a; },
        get write() { return b; },
        swap() { const t = a; a = b; b = t; },
      };
    }

    _initFBOs() {
      const gl = this.gl;
      this.dye      = this._createDoubleFBO(this.DYE, this.DYE, gl.LINEAR);
      this.velocity = this._createDoubleFBO(this.SIM, this.SIM, gl.LINEAR);
      this.divergence = this._createFBO(this.SIM, this.SIM, gl.NEAREST);
      this.pressure = this._createDoubleFBO(this.SIM, this.SIM, gl.NEAREST);
    }

    _blit(target) {
      const gl = this.gl;
      if (target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.viewport(0, 0, target.w, target.h);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      }
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    _splat(x, y, dx, dy, color) {
      const gl = this.gl;
      const aspect = this.canvas.width / this.canvas.height;

      // Velocity splat
      gl.useProgram(this.splatProg.p);
      gl.uniform1i(this.splatProg.u.uTarget, this.velocity.read.attach(0, gl));
      gl.uniform2f(this.splatProg.u.uPoint, x, y);
      gl.uniform3f(this.splatProg.u.uColor, dx, dy, 0.0);
      gl.uniform1f(this.splatProg.u.uRadius, 0.0008);
      gl.uniform1f(this.splatProg.u.uAspect, aspect);
      this._blit(this.velocity.write);
      this.velocity.swap();

      // Dye splat
      gl.uniform1i(this.splatProg.u.uTarget, this.dye.read.attach(0, gl));
      gl.uniform3f(this.splatProg.u.uColor, color[0], color[1], color[2]);
      this._blit(this.dye.write);
      this.dye.swap();
    }

    // HSL → RGB in [0,1]
    _hsl(h, s, l) {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const hh = h / 60;
      const x = c * (1 - Math.abs((hh % 2) - 1));
      let r, g, b;
      if      (hh < 1) [r,g,b] = [c, x, 0];
      else if (hh < 2) [r,g,b] = [x, c, 0];
      else if (hh < 3) [r,g,b] = [0, c, x];
      else if (hh < 4) [r,g,b] = [0, x, c];
      else if (hh < 5) [r,g,b] = [x, 0, c];
      else             [r,g,b] = [c, 0, x];
      const m = l - c * 0.5;
      return [r + m, g + m, b + m];
    }

    _step() {
      const gl = this.gl;
      const dt = 0.016;

      // Inject from mouse drag
      if (this.mx !== null && this.pmx !== null) {
        const dx = (this.mx - this.pmx) * 6;
        const dy = -(this.my - this.pmy) * 6;
        const px = this.mx / this.w;
        const py = 1 - this.my / this.h;
        const moved = Math.hypot(dx, dy);
        if (moved > 0.5) {
          const hue = (this.tick * 1.5) % 360;
          this._splat(px, py, dx, dy, this._hsl(hue, 0.9, 0.55));
        }
      }

      // Auto-emit when no mouse — two wandering sources for richer ambient look
      if (this.mx === null && this.tick % 10 === 0) {
        const t = this.tick * 0.04;
        for (let k = 0; k < 2; k++) {
          const phase = k * Math.PI;
          const px = 0.5 + Math.cos(t * 0.7 + phase) * 0.30;
          const py = 0.5 + Math.sin(t * 1.1 + phase) * 0.30;
          const dx = Math.cos(t * 1.3 + phase) * 260;
          const dy = Math.sin(t * 1.7 + phase) * 260;
          const hue = (this.tick * 1.2 + k * 180) % 360;
          this._splat(px, py, dx, dy, this._hsl(hue, 0.9, 0.55));
        }
      }

      // 1. Advect velocity
      gl.useProgram(this.advProg.p);
      gl.uniform2f(this.advProg.u.uTexel, this.velocity.tx, this.velocity.ty);
      gl.uniform1i(this.advProg.u.uVel, this.velocity.read.attach(0, gl));
      gl.uniform1i(this.advProg.u.uSrc, this.velocity.read.attach(0, gl));
      gl.uniform1f(this.advProg.u.uDt, dt);
      gl.uniform1f(this.advProg.u.uDiss, 0.998);
      this._blit(this.velocity.write);
      this.velocity.swap();

      // 2. Compute divergence
      gl.useProgram(this.divProg.p);
      gl.uniform2f(this.divProg.u.uTexel, this.velocity.tx, this.velocity.ty);
      gl.uniform1i(this.divProg.u.uVel, this.velocity.read.attach(0, gl));
      this._blit(this.divergence);

      // 3. Solve pressure (20 Jacobi iterations).
      // Clear pressure to 0 first.
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.read.fbo);
      gl.viewport(0, 0, this.pressure.w, this.pressure.h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(this.presProg.p);
      gl.uniform2f(this.presProg.u.uTexel, this.velocity.tx, this.velocity.ty);
      gl.uniform1i(this.presProg.u.uDiv, this.divergence.attach(0, gl));
      for (let i = 0; i < 20; i++) {
        gl.uniform1i(this.presProg.u.uPres, this.pressure.read.attach(1, gl));
        this._blit(this.pressure.write);
        this.pressure.swap();
      }

      // 4. Subtract pressure gradient
      gl.useProgram(this.gradProg.p);
      gl.uniform2f(this.gradProg.u.uTexel, this.velocity.tx, this.velocity.ty);
      gl.uniform1i(this.gradProg.u.uPres, this.pressure.read.attach(0, gl));
      gl.uniform1i(this.gradProg.u.uVel, this.velocity.read.attach(1, gl));
      this._blit(this.velocity.write);
      this.velocity.swap();

      // 5. Advect dye through velocity
      gl.useProgram(this.advProg.p);
      gl.uniform2f(this.advProg.u.uTexel, this.velocity.tx, this.velocity.ty);
      gl.uniform1i(this.advProg.u.uVel, this.velocity.read.attach(0, gl));
      gl.uniform1i(this.advProg.u.uSrc, this.dye.read.attach(1, gl));
      gl.uniform1f(this.advProg.u.uDt, dt);
      gl.uniform1f(this.advProg.u.uDiss, 0.997);
      this._blit(this.dye.write);
      this.dye.swap();

      // 6. Display dye to screen
      gl.useProgram(this.dispProg.p);
      gl.uniform1i(this.dispProg.u.uDye, this.dye.read.attach(0, gl));
      this._blit(null);
    }
  }

  // ============================================================
  //   013 · REACTION-DIFFUSION (Gray-Scott; Turing 1952, Pearson 1993)
  // ============================================================
  class ReactionEffect extends Effect {
    init() {
      this.N = 192;
      const S = this.N * this.N;
      this.a  = new Float32Array(S);
      this.b  = new Float32Array(S);
      this.a2 = new Float32Array(S);
      this.b2 = new Float32Array(S);

      this.dt = 1.0;
      this.Da = 1.0;
      this.Db = 0.5;
      this.stepsPerFrame = 10;

      // Each (F, k) pair produces a different pattern family.
      // The same algorithm, dramatically different worlds.
      this.presets = [
        { F: 0.055,  k: 0.062  },  // labyrinth (fast, dramatic — default)
        { F: 0.030,  k: 0.062  },  // mitosis spots
        { F: 0.039,  k: 0.058  },  // dense maze
        { F: 0.026,  k: 0.051  },  // moving stripes
        { F: 0.0367, k: 0.0649 },  // self-replicating spots (sparse, slow)
      ];
      this.presetIdx = this.settings.preset ?? 0;
      this.F = this.presets[this.presetIdx].F;
      this.k = this.presets[this.presetIdx].k;

      this._reset();

      this.off = document.createElement('canvas');
      this.off.width = this.N;
      this.off.height = this.N;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.N, this.N);
    }

    _reset() {
      const N = this.N, S = N * N;
      // Fill A=1, B=0 everywhere
      for (let i = 0; i < S; i++) {
        this.a[i]  = 1; this.a2[i] = 1;
        this.b[i]  = 0; this.b2[i] = 0;
      }
      // Seed B at several small circles. Smaller/gentler seeds keep the initial
      // conditions inside the stability regime — large concentrated B drives the
      // reaction term up enough to make the FTCS scheme blow up.
      for (let blob = 0; blob < 8; blob++) {
        const cx = ((this.random() * 0.8 + 0.1) * N) | 0;
        const cy = ((this.random() * 0.8 + 0.1) * N) | 0;
        const r = 2 + (this.random() * 3) | 0;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx*dx + dy*dy <= r*r) {
              const x = cx + dx, y = cy + dy;
              if (x >= 0 && x < N && y >= 0 && y < N) {
                this.b[y * N + x] = 0.6;
              }
            }
          }
        }
      }
    }

    onClick() {
      this.presetIdx = (this.presetIdx + 1) % this.presets.length;
      this.F = this.presets[this.presetIdx].F;
      this.k = this.presets[this.presetIdx].k;
      this._reset();
    }

    _step() {
      const N = this.N;
      const a = this.a, b = this.b;
      const a2 = this.a2, b2 = this.b2;
      const F = this.F, k = this.k;
      const Da = this.Da, Db = this.Db, dt = this.dt;

      // 9-point Laplacian (edge=0.2, diagonal=0.05, center=-1) is properly
      // normalized: with Da=1.0, dt=1.0 this stays inside the stability bound.
      // It's also more isotropic than the 5-point version — fewer grid-aligned
      // artifacts in the resulting patterns.
      // Toroidal boundaries make patterns wrap cleanly around the edges.
      for (let y = 0; y < N; y++) {
        const yu = (y === 0     ? N - 1 : y - 1) * N;
        const yd = (y === N - 1 ? 0     : y + 1) * N;
        const yc = y * N;
        for (let x = 0; x < N; x++) {
          const xl = x === 0     ? N - 1 : x - 1;
          const xr = x === N - 1 ? 0     : x + 1;
          const i = yc + x;

          const lapA =
            0.20 * (a[yc + xl] + a[yc + xr] + a[yu + x]  + a[yd + x]) +
            0.05 * (a[yu + xl] + a[yu + xr] + a[yd + xl] + a[yd + xr])
            - a[i];
          const lapB =
            0.20 * (b[yc + xl] + b[yc + xr] + b[yu + x]  + b[yd + x]) +
            0.05 * (b[yu + xl] + b[yu + xr] + b[yd + xl] + b[yd + xr])
            - b[i];

          const ai = a[i], bi = b[i];
          const reaction = ai * bi * bi;
          // Clamp to [0, 1] — these values physically live in that range and
          // clamping prevents the FTCS scheme from running away if a seed
          // configuration briefly violates the stability bound.
          const newA = ai + (Da * lapA - reaction + F * (1 - ai)) * dt;
          const newB = bi + (Db * lapB + reaction - (F + k) * bi) * dt;
          a2[i] = newA < 0 ? 0 : newA > 1 ? 1 : newA;
          b2[i] = newB < 0 ? 0 : newB > 1 ? 1 : newB;
        }
      }
      // Swap buffers
      this.a = a2; this.a2 = a;
      this.b = b2; this.b2 = b;
    }

    update() {
      // Several simulation steps per render frame so patterns evolve at watchable speed
      for (let s = 0; s < this.stepsPerFrame; s++) this._step();
    }

    render() {
      const N = this.N;
      const data = this.imgData.data;
      const b = this.b;
      // Map B concentration to amber gradient (black → ember → amber → near-white)
      for (let i = 0; i < N * N; i++) {
        const v = Math.min(1, Math.max(0, b[i] * 1.5));
        let r, g, bl;
        if (v < 0.35) {
          const t = v / 0.35;
          r = 70 * t; g = 18 * t; bl = 8 * t;
        } else if (v < 0.75) {
          const t = (v - 0.35) / 0.4;
          r = 70 + 185 * t;
          g = 18 + 108 * t;
          bl = 8  + 53  * t;
        } else {
          const t = (v - 0.75) / 0.25;
          r = 255;
          g = 126 + 100 * t;
          bl = 61  + 140 * t;
        }
        const j = i * 4;
        data[j] = r; data[j+1] = g; data[j+2] = bl; data[j+3] = 255;
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = '#0a0a0c';
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   014 · STRANGE ATTRACTORS (Lorenz 1963 onward)
  // ============================================================
  class AttractorEffect extends Effect {
    init() {
      // Each attractor is a 3D system of ODEs plus tuning for how to
      // visualize it: which 2D projection, what scale, where to center.
      this.attractors = [
        {
          // Lorenz '63 — classic butterfly. Models atmospheric convection.
          step: (x, y, z, dt) => {
            const sigma = 10, rho = 28, beta = 8/3;
            return [
              x + sigma * (y - x) * dt,
              y + (x * (rho - z) - y) * dt,
              z + (x * y - beta * z) * dt,
            ];
          },
          dt: 0.006, scale: 8, offset: [0, -25],
          project: 'xz', start: [0.1, 0, 0],
        },
        {
          // Aizawa — twisted donut / chaotic torus.
          // XZ view shows the teardrop spiral; XY would just be concentric rings.
          step: (x, y, z, dt) => {
            const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1;
            return [
              x + ((z - b) * x - d * y) * dt,
              y + (d * x + (z - b) * y) * dt,
              z + (c + a * z - z*z*z/3 - (x*x + y*y) * (1 + e * z) + f * z * x*x*x) * dt,
            ];
          },
          dt: 0.012, scale: 90, offset: [0, -0.8],
          project: 'xz', start: [0.1, 0, 0],
        },
        {
          // Halvorsen — cyclically symmetric tangled curves
          step: (x, y, z, dt) => {
            const a = 1.4;
            return [
              x + (-a * x - 4 * y - 4 * z - y*y) * dt,
              y + (-a * y - 4 * z - 4 * x - z*z) * dt,
              z + (-a * z - 4 * x - 4 * y - x*x) * dt,
            ];
          },
          dt: 0.005, scale: 14, offset: [3, 3],
          project: 'xy', start: [-1, 0, 0],
        },
        {
          // Thomas — sin-driven, looks like a sliced loaf of bread
          step: (x, y, z, dt) => {
            const b = 0.208186;
            return [
              x + (Math.sin(y) - b * x) * dt,
              y + (Math.sin(z) - b * y) * dt,
              z + (Math.sin(x) - b * z) * dt,
            ];
          },
          dt: 0.06, scale: 48, offset: [0, 0],
          project: 'xy', start: [0.1, 0, 0],
        },
      ];
      this.idx = this.settings.preset ?? 0;
      this._spawn();
      this.firstFrame = true;
    }

    _spawn() {
      const a = this.attractors[this.idx];
      this.x = a.start[0]; this.y = a.start[1]; this.z = a.start[2];
      this.framePoints = [];
    }

    onClick() {
      this.idx = (this.idx + 1) % this.attractors.length;
      this._spawn();
      this.firstFrame = true;
    }

    update() {
      const a = this.attractors[this.idx];
      // Start the frame's polyline at the current position so it joins
      // continuously with last frame's last segment, then take 90 small
      // forward steps — the trail draws itself across many frames.
      this.framePoints = [this.x, this.y, this.z];
      for (let i = 0; i < 90; i++) {
        [this.x, this.y, this.z] = a.step(this.x, this.y, this.z, a.dt);
        this.framePoints.push(this.x, this.y, this.z);
      }
    }

    _project(x, y, z) {
      const a = this.attractors[this.idx];
      const cx = this.w / 2, cy = this.h / 2;
      const scale = a.scale * Math.min(this.w, this.h) / 540;
      let px, py;
      if (a.project === 'xz') { px = x; py = z; }
      else                    { px = x; py = y; }
      // Canvas Y is inverted (top=0). Negate vertical so values go up.
      return [
        cx + (px + a.offset[0]) * scale,
        cy - (py + a.offset[1]) * scale,
      ];
    }

    render() {
      const ctx = this.ctx;
      if (this.firstFrame) {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, this.w, this.h);
        this.firstFrame = false;
      } else {
        // Slow fade so the orbit accumulates visibly without saturating
        ctx.fillStyle = 'rgba(10, 10, 12, 0.035)';
        ctx.fillRect(0, 0, this.w, this.h);
      }
      if (this.framePoints.length < 6) return;

      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 0.7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const [fx, fy] = this._project(
        this.framePoints[0], this.framePoints[1], this.framePoints[2]
      );
      ctx.moveTo(fx, fy);
      for (let i = 3; i < this.framePoints.length; i += 3) {
        const [px, py] = this._project(
          this.framePoints[i], this.framePoints[i+1], this.framePoints[i+2]
        );
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  // ============================================================
  //   015 · DIFFUSION-LIMITED AGGREGATION (Witten & Sander, 1981)
  // ============================================================
  class DLAEffect extends Effect {
    init() {
      // Grid resolution — small enough to fill in watchable time,
      // big enough that the dendrites read as branching, not chunky.
      this.G = 220;
      this.grid = new Uint16Array(this.G * this.G);  // 0 = empty, n = the order it stuck
      this.cx = this.G >> 1;
      this.cy = this.G >> 1;
      this.age = 1;
      this.grid[this.cy * this.G + this.cx] = this.age++;
      this.maxR = 2;
      this.maxR_limit = this.G * 0.46;
      // Many walkers in flight at once — the first to find the cluster wins.
      this.walkers = [];
      this.WALKER_COUNT = 16;
      // Spawn just outside the current cluster; kill walkers that stray too far.
      // Otherwise most of the simulation is wasted on aimless random walks
      // through the empty void far from anything to stick to.
      this.SPAWN_OFFSET = 5;
      this.KILL_FACTOR  = 3;

      this.off = document.createElement('canvas');
      this.off.width = this.G; this.off.height = this.G;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.G, this.G);
      this._doneAt = null;
    }

    _spawn() {
      const ang = this.random() * Math.PI * 2;
      const r = this.maxR + this.SPAWN_OFFSET;
      return {
        x: this.cx + Math.cos(ang) * r,
        y: this.cy + Math.sin(ang) * r,
        killR2: (this.maxR + this.SPAWN_OFFSET * this.KILL_FACTOR) ** 2,
      };
    }

    _reset() {
      this.grid.fill(0);
      this.age = 1;
      this.grid[this.cy * this.G + this.cx] = this.age++;
      this.maxR = 2;
      this.walkers.length = 0;
      this._doneAt = null;
    }

    onClick() { this._reset(); }

    update() {
      // When the cluster fills its allotted radius, hold the finished view
      // briefly so the eye can take in the structure, then restart.
      if (this.maxR > this.maxR_limit) {
        if (this._doneAt === null) this._doneAt = this.tick;
        if (this.tick - this._doneAt > 180) this._reset();
        return;
      }

      const G = this.G;
      const STEP_BUDGET = 6000;  // total walker-steps allowed per frame
      let budget = STEP_BUDGET;
      while (budget-- > 0) {
        // Top up the in-flight walker pool
        while (this.walkers.length < this.WALKER_COUNT) {
          this.walkers.push(this._spawn());
        }
        // Pick a random walker and step it once
        const wi = (this.random() * this.walkers.length) | 0;
        const w = this.walkers[wi];
        const r = (this.random() * 4) | 0;
        if      (r === 0) w.x++;
        else if (r === 1) w.x--;
        else if (r === 2) w.y++;
        else              w.y--;
        // Out-of-bounds kill (anything far past the cluster is rerolled —
        // pure random walk in 2D is recurrent but in practice extremely slow)
        const dx = w.x - this.cx, dy = w.y - this.cy;
        if (dx*dx + dy*dy > w.killR2) { this.walkers.splice(wi, 1); continue; }
        // 4-neighbor adhesion check
        const xi = w.x | 0, yi = w.y | 0;
        if (xi < 1 || xi >= G - 1 || yi < 1 || yi >= G - 1) continue;
        const ix = yi * G + xi;
        if (this.grid[ix - 1] || this.grid[ix + 1] ||
            this.grid[ix - G] || this.grid[ix + G]) {
          this.grid[ix] = this.age++;
          const r2 = Math.sqrt(dx*dx + dy*dy);
          if (r2 > this.maxR) this.maxR = r2;
          this.walkers.splice(wi, 1);
        }
      }
    }

    render() {
      const G = this.G;
      const data = this.imgData.data;
      const N = G * G;
      const maxAge = this.age - 1;
      // Color by age relative to the current newest particle — the wave of
      // most-recently-stuck pixels always glows brightest at the tips.
      for (let i = 0; i < N; i++) {
        const a = this.grid[i];
        const j = i * 4;
        if (a === 0) {
          data[j] = 10; data[j+1] = 10; data[j+2] = 12; data[j+3] = 255;
        } else {
          const t = a / maxAge;
          let r, g, b;
          if (t < 0.55) {
            const u = t / 0.55;
            r = 90  + 130 * u;
            g = 30  +  80 * u;
            b = 14  +  36 * u;
          } else {
            const u = (t - 0.55) / 0.45;
            r = 220 +  35 * u;
            g = 110 + 110 * u;
            b = 50  + 130 * u;
          }
          data[j] = r; data[j+1] = g; data[j+2] = b; data[j+3] = 255;
        }
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = BG;
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   016 · L-SYSTEMS (Lindenmayer, 1968)
  // ============================================================
  class LSystemEffect extends Effect {
    init() {
      // Each preset: an axiom, rewrite rules, turning angle, iteration depth,
      // and where on the canvas the turtle starts pointing.
      this.presets = [
        { // Classic algorithmic plant — feathery and dense
          axiom: 'F',
          rules: { F: 'FF+[+F-F-F]-[-F+F+F]' },
          angle: 22.5, iter: 4, startAng: -90, anchor: 'bottom',
        },
        { // Wider, more architectural bush
          axiom: 'F',
          rules: { F: 'F[+F]F[-F][F]' },
          angle: 20, iter: 5, startAng: -90, anchor: 'bottom',
        },
        { // Asymmetric vine — visibly handed
          axiom: 'X',
          rules: {
            X: 'F-[[X]+X]+F[+FX]-X',
            F: 'FF',
          },
          angle: 25, iter: 5, startAng: -78, anchor: 'bottom',
        },
        { // Koch snowflake-ish — geometric rather than botanical
          axiom: 'F++F++F',
          rules: { F: 'F-F++F-F' },
          angle: 60, iter: 4, startAng: 0, anchor: 'center',
        },
      ];
      this.idx = this.settings.preset ?? 0;
      this._build();
    }

    _build() {
      const p = this.presets[this.idx];
      // Expand the axiom by the rewrite rules `iter` times. The string can
      // grow to tens of thousands of characters — that's fine, the turtle
      // walk is linear and fast.
      let s = p.axiom;
      for (let i = 0; i < p.iter; i++) {
        let next = '';
        for (let j = 0; j < s.length; j++) {
          const c = s[j];
          next += (p.rules[c] !== undefined ? p.rules[c] : c);
        }
        s = next;
      }
      this.string = s;

      // Dry-run the turtle to compute bounds, so we can scale the drawing
      // to fit any canvas size regardless of how big this particular tree
      // turned out to be.
      const angRad = p.angle * Math.PI / 180;
      let x = 0, y = 0, a = p.startAng * Math.PI / 180;
      let minX = 0, maxX = 0, minY = 0, maxY = 0;
      const stack = [];
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === 'F' || c === 'G') {
          x += Math.cos(a); y += Math.sin(a);
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        } else if (c === '+') a += angRad;
        else if (c === '-') a -= angRad;
        else if (c === '[') stack.push([x, y, a]);
        else if (c === ']') { const t = stack.pop(); x = t[0]; y = t[1]; a = t[2]; }
      }
      this.bounds = { minX, maxX, minY, maxY };
      this.drawIdx = 0;
      this.firstFrame = true;
      this._doneAt = null;
    }

    onClick() {
      this.idx = (this.idx + 1) % this.presets.length;
      this._build();
    }

    update() {
      if (this.drawIdx < this.string.length) {
        // ~5s growth regardless of tree size
        const step = Math.max(2, Math.ceil(this.string.length / 300));
        this.drawIdx = Math.min(this.string.length, this.drawIdx + step);
        if (this.drawIdx >= this.string.length) this._doneAt = this.tick;
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, this.w, this.h);

      const p = this.presets[this.idx];
      const b = this.bounds;
      const PAD = 18;
      const sx = (this.w - PAD * 2) / Math.max(1, b.maxX - b.minX);
      const sy = (this.h - PAD * 2) / Math.max(1, b.maxY - b.minY);
      const scale = Math.min(sx, sy);

      let ox, oy;
      if (p.anchor === 'bottom') {
        ox = this.w * 0.5 - ((b.minX + b.maxX) * 0.5) * scale;
        oy = this.h - PAD - b.maxY * scale;
      } else {
        ox = this.w * 0.5 - ((b.minX + b.maxX) * 0.5) * scale;
        oy = this.h * 0.5 - ((b.minY + b.maxY) * 0.5) * scale;
      }

      // Interpret the string up to drawIdx as turtle moves
      const angRad = p.angle * Math.PI / 180;
      let x = 0, y = 0, a = p.startAng * Math.PI / 180;
      const stack = [];
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const limit = this.drawIdx;
      for (let i = 0; i < limit; i++) {
        const c = this.string[i];
        if (c === 'F' || c === 'G') {
          const nx = x + Math.cos(a);
          const ny = y + Math.sin(a);
          ctx.moveTo(ox + x * scale, oy + y * scale);
          ctx.lineTo(ox + nx * scale, oy + ny * scale);
          x = nx; y = ny;
        } else if (c === '+') a += angRad;
        else if (c === '-') a -= angRad;
        else if (c === '[') stack.push([x, y, a]);
        else if (c === ']') { const t = stack.pop(); x = t[0]; y = t[1]; a = t[2]; }
      }
      ctx.stroke();
    }
  }

  // ============================================================
  //   017 · PHYLLOTAXIS (Vogel, 1979)
  // ============================================================
  class PhyllotaxisEffect extends Effect {
    init() {
      this.MAX_SEEDS = 1200;
      this.angles = [
        { val: Math.PI * (3 - Math.sqrt(5)), label: 'φ (137.5077°)' },
        { val: 137.3 * Math.PI / 180,        label: '137.3°' },
        { val: 138.0 * Math.PI / 180,        label: '138.0°' },
        { val: 90.0  * Math.PI / 180,        label: '90°' },
      ];
      this.idx = this.settings.preset ?? 0;
      this.seeds = 0;
      this._holdT = 0;
    }
    onClick() {
      this.idx = (this.idx + 1) % this.angles.length;
      this.seeds = 0;
      this._holdT = 0;
    }
    update() {
      if (this.seeds < this.MAX_SEEDS) {
        this.seeds = Math.min(this.MAX_SEEDS, this.seeds + 8);
      } else if (++this._holdT > 240) {
        this.seeds = 0; this._holdT = 0;
      }
    }
    render() {
      const ctx = this.ctx;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, this.w, this.h);
      const cx = this.w * 0.5, cy = this.h * 0.5;
      const c = Math.min(this.w, this.h) / 70;
      const angle = this.settings.angle != null ? this.settings.angle * Math.PI / 180 : this.angles[this.idx].val;
      for (let n = 0; n < this.seeds; n++) {
        const a = n * angle;
        const r = c * Math.sqrt(n);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const t = n / this.MAX_SEEDS;
        ctx.fillStyle = `rgba(255, ${(126 + t*60) | 0}, ${(61 + t*100) | 0}, ${0.75 + t*0.22})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.8 + t * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // Tiny corner label so users can see which angle is currently active.
      // Bottom-right because the canvas-overlay claims the left side.
      ctx.font = '10px JetBrains Mono';
      ctx.fillStyle = '#5a5650';
      ctx.textAlign = 'right';
      ctx.fillText(this.settings.angle != null ? this.settings.angle.toFixed(2) + '°' : this.angles[this.idx].label, this.w - 16, this.h - 14);
      ctx.textAlign = 'start';
    }
  }

  // ============================================================
  //   018 · WAVE FUNCTION COLLAPSE (Gumin, 2016)
  // ============================================================
  class WFCEffect extends Effect {
    init() {
      // Tile alphabet: all 16 binary edge configurations.
      // edge order N=bit3, E=bit2, S=bit1, W=bit0 of the tile index.
      // Having all 16 means every constraint pair has a satisfying tile —
      // the algorithm never paints itself into a contradiction.
      this.NT = 16;
      this.tiles = [];
      for (let i = 0; i < 16; i++) {
        this.tiles.push([(i>>3)&1, (i>>2)&1, (i>>1)&1, i&1]);
      }
      this.ALL = 0xFFFF;

      // Precompute: compat[dir][t] = bitmask of tiles that can be placed
      // as the neighbor in direction dir given tile t in the current cell.
      // The constraint is simply tile.edge[dir] === neighbor.edge[opposite(dir)].
      this.compat = [[], [], [], []];
      const opp = [2, 3, 0, 1];   // N↔S, E↔W
      for (let d = 0; d < 4; d++) {
        for (let t = 0; t < this.NT; t++) {
          let mask = 0;
          const myEdge = this.tiles[t][d];
          for (let n = 0; n < this.NT; n++) {
            if (this.tiles[n][opp[d]] === myEdge) mask |= (1 << n);
          }
          this.compat[d][t] = mask;
        }
      }

      this.COLS = 70;
      this.ROWS = 30;
      this.K_PER_FRAME = 12;      // collapses per frame; tune for pacing
      this._reset();
    }

    _reset() {
      this.cells = new Uint16Array(this.COLS * this.ROWS);
      for (let i = 0; i < this.cells.length; i++) this.cells[i] = this.ALL;
      // Highlight value 0..1 that decays each frame — gives a wave-of-light
      // along the propagation path.
      this.glow = new Float32Array(this.cells.length);
      this._doneAt = null;
    }

    onClick() { this._reset(); }

    // Hamming weight / popcount — number of allowed tiles for a cell
    _pop(n) {
      n = n - ((n >> 1) & 0x55555555);
      n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
      return (((n + (n >> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
    }

    _step() {
      // 1. Find the unsolved cell with minimum entropy (fewest options),
      //    breaking ties uniformly at random (reservoir sampling)
      let best = -1, bestC = Infinity, ties = 0;
      const len = this.cells.length;
      for (let i = 0; i < len; i++) {
        const c = this._pop(this.cells[i]);
        if (c <= 1) continue;
        if (c < bestC) { bestC = c; best = i; ties = 1; }
        else if (c === bestC) { ties++; if (this.random() * ties < 1) best = i; }
      }
      if (best === -1) return false;  // everything collapsed

      // 2. Collapse — pick a uniformly random tile from the cell's options
      const mask = this.cells[best];
      const opts = [];
      for (let t = 0; t < this.NT; t++) if (mask & (1 << t)) opts.push(t);
      const pick = opts[(this.random() * opts.length) | 0];
      this.cells[best] = 1 << pick;
      this.glow[best] = 1.0;

      // 3. Propagate the new constraint outward. For each cell on the queue,
      //    look at its 4 neighbors: the neighbor's allowed mask is the OR
      //    of compat[d][t] for every tile t still allowed in the source
      //    cell. Intersect with the neighbor's existing mask; if anything
      //    changed, enqueue the neighbor to keep cascading.
      const queue = [best];
      const dx = [0, 1, 0, -1];
      const dy = [-1, 0, 1, 0];
      while (queue.length) {
        const i = queue.pop();
        const x = i % this.COLS, y = (i / this.COLS) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = x + dx[d], ny = y + dy[d];
          if (nx < 0 || nx >= this.COLS || ny < 0 || ny >= this.ROWS) continue;
          const ni = ny * this.COLS + nx;
          const m = this.cells[i];
          let allowed = 0;
          for (let t = 0; t < this.NT; t++) {
            if (m & (1 << t)) allowed |= this.compat[d][t];
          }
          const newM = this.cells[ni] & allowed;
          if (newM !== this.cells[ni]) {
            this.cells[ni] = newM;
            if (this._pop(newM) === 1) this.glow[ni] = Math.max(this.glow[ni], 0.55);
            queue.push(ni);
          }
        }
      }
      return true;
    }

    update() {
      // Decay highlight regardless of state
      for (let i = 0; i < this.glow.length; i++) this.glow[i] *= 0.86;

      if (this._doneAt !== null) {
        if (this.tick - this._doneAt > 420) this._reset();
        return;
      }
      for (let i = 0; i < this.K_PER_FRAME; i++) {
        if (!this._step()) { this._doneAt = this.tick; break; }
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, this.w, this.h);
      const cw = this.w / this.COLS;
      const ch = this.h / this.ROWS;
      ctx.lineCap = 'round';

      for (let i = 0; i < this.cells.length; i++) {
        const mask = this.cells[i];
        const x = i % this.COLS, y = (i / this.COLS) | 0;
        const px = x * cw, py = y * ch;
        const cx = px + cw * 0.5, cy = py + ch * 0.5;
        const c = this._pop(mask);

        if (c === 1) {
          // Collapsed cell — draw the connection pattern
          let t = 0; while (!(mask & (1 << t))) t++;
          const e = this.tiles[t];
          const flash = this.glow[i];
          const r = 255;
          const g = (126 + 110 * flash) | 0;
          const b = (61  + 150 * flash) | 0;
          ctx.strokeStyle = `rgb(${r},${g},${b})`;
          ctx.lineWidth = 1.5 + flash * 1.3;
          ctx.beginPath();
          if (e[0]) { ctx.moveTo(cx, cy); ctx.lineTo(cx, py); }
          if (e[1]) { ctx.moveTo(cx, cy); ctx.lineTo(px + cw, cy); }
          if (e[2]) { ctx.moveTo(cx, cy); ctx.lineTo(cx, py + ch); }
          if (e[3]) { ctx.moveTo(cx, cy); ctx.lineTo(px, cy); }
          ctx.stroke();
          const edgeSum = e[0] + e[1] + e[2] + e[3];
          if (edgeSum >= 1) {
            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            ctx.arc(cx, cy, edgeSum >= 3 ? 2.6 : 1.7, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Uncollapsed — faint dot whose opacity tracks remaining entropy.
          // Cells that have been "narrowed" but not yet collapsed glow more
          // strongly, so the propagation wave is visible as a halo.
          const t = (c - 1) / (this.NT - 1);  // 0 = collapsed, 1 = unconstrained
          const alpha = 0.06 + (1 - t) * 0.20;
          ctx.fillStyle = `rgba(255, 126, 61, ${alpha})`;
          ctx.beginPath();
          ctx.arc(cx, cy, 0.7 + (1 - t) * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ============================================================
  //   020 · LATTICE BOLTZMANN (D2Q9, flow past three cylinders)
  // ============================================================
  // Discrete-velocity model of the Navier–Stokes equations. Each grid cell
  // stores 9 floats — populations streaming in 9 lattice directions
  // (rest + 4 axial + 4 diagonal). Each step:
  //   1. Collide: relax each population toward its local equilibrium.
  //   2. Stream: each direction's population shifts one cell along c[k].
  // Bounce-back walls (top/bot/obstacles) reflect populations into their
  // opposite direction; inflow on the left prescribes equilibrium at U0;
  // outflow on the right copies the cell into itself. We visualize the
  // resulting velocity field the classic way: thousands of massless tracer
  // particles seeded at the left edge, each tagged by its spawn-height
  // band with a rainbow color, advected through the flow. Their drifting
  // trails become streamlines that bend around the obstacles and wiggle
  // through the vortex street downstream.
  class LBMEffect extends Effect {
    init() {
      this.GW = 280; this.GH = 80;
      this.N = this.GW * this.GH;
      // τ = 0.53 → ν = 0.01. With D=14, U₀=0.10, Re = U·D/ν ≈ 140.
      // Comfortably above the shedding threshold (Re_crit ≈ 47), and far
      // enough from the τ=0.5 stability margin that the simulation can run
      // indefinitely without numerical blow-up.
      this.tau = 0.53;
      this.U0 = 0.10;

      // D2Q9 velocity set. Order: rest, E, N, W, S, NE, NW, SW, SE.
      this.cx  = new Int8Array([0,  1, 0, -1,  0,  1, -1, -1,  1]);
      this.cy  = new Int8Array([0,  0, 1,  0, -1,  1,  1, -1, -1]);
      // Lattice weights for D2Q9. (Capital W to avoid colliding with the
      // Effect base class's this.w, which holds the canvas CSS width.)
      this.W   = new Float32Array([4/9, 1/9, 1/9, 1/9, 1/9, 1/36, 1/36, 1/36, 1/36]);
      // Opposite-direction lookup (for bounce-back).
      this.opp = new Int8Array([0, 3, 4, 1, 2, 7, 8, 5, 6]);

      this.f  = new Float32Array(this.N * 9);
      this.ft = new Float32Array(this.N * 9);
      this.solid = new Uint8Array(this.N);
      this.ux = new Float32Array(this.N);
      this.uy = new Float32Array(this.N);

      // Three cylinders in a triangle, apex pointing UPSTREAM (against the
      // flow). The single front cylinder splits the inflow into two streams
      // that then have to thread between the wider pair of downstream
      // cylinders — a configuration that generates richer wake structure
      // than a single bluff body could on its own.
      this.cylinders = [
        { x: this.GW * 0.16, y: this.GH * 0.50, r: 6 },   // front apex
        { x: this.GW * 0.32, y: this.GH * 0.30, r: 6 },   // back top
        { x: this.GW * 0.32, y: this.GH * 0.70, r: 6 },   // back bottom
      ];
      for (let y = 0; y < this.GH; y++) {
        for (let x = 0; x < this.GW; x++) {
          for (const c of this.cylinders) {
            const dx = x - c.x, dy = y - c.y;
            if (dx*dx + dy*dy < c.r * c.r) {
              this.solid[y*this.GW + x] = 1;
              break;
            }
          }
        }
      }

      this._initF();

      // Tracer particles: P particles in NBANDS color bands by initial Y.
      // We track each particle's previous position so render() can draw a
      // short line segment from old to new — the per-frame motion vector
      // becomes a streak, and the fade-trail stitches many frames of these
      // streaks together into continuous-looking streamlines.
      this.P = 8000;
      this.NBANDS = 32;
      this.pxA    = new Float32Array(this.P);
      this.pyA    = new Float32Array(this.P);
      this.pxOld  = new Float32Array(this.P);
      this.pyOld  = new Float32Array(this.P);
      this.pBand  = new Uint8Array(this.P);

      // Rainbow palette: top of frame (band 0) = red, bottom = violet.
      // HSL hue rotates 0° → 280° across the strip, full saturation.
      this.bandColors = new Array(this.NBANDS);
      for (let b = 0; b < this.NBANDS; b++) {
        const hue = b * (280 / (this.NBANDS - 1));
        this.bandColors[b] = this._hslString(hue, 90, 56);
      }

      // Scatter the initial particles across the whole canvas so that
      // streamlines appear immediately instead of taking 10 seconds for
      // the first particles to traverse.
      for (let i = 0; i < this.P; i++) {
        this.pxA[i] = this.random() * this.GW;
        this.pyA[i] = this.random() * this.GH;
        this.pxOld[i] = this.pxA[i];
        this.pyOld[i] = this.pyA[i];
        this.pBand[i] = Math.min(this.NBANDS - 1,
          Math.floor(this.pyA[i] / this.GH * this.NBANDS));
      }

      // Advection multiplier: how many lattice cells a particle moves
      // per frame per unit of lattice velocity. Higher = livelier streaks.
      this.advScale = 1.6;
    }

    _hslString(h, s, l) {
      // HSL → "rgb(r, g, b)" string for fast fillStyle assignment.
      h /= 360; s /= 100; l /= 100;
      let r, g, b;
      if (s === 0) { r = g = b = l; }
      else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1; if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return `rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)})`;
    }

    _initF() {
      // Uniform rightward flow at U0 plus a tiny transverse jitter
      // (~0.5% of U0). Two cylinders supply most of the symmetry-breaking
      // by themselves, so the noise just speeds up the first cycle.
      for (let y = 0; y < this.GH; y++) {
        for (let x = 0; x < this.GW; x++) {
          const i = y*this.GW + x;
          const uy = (this.random() - 0.5) * 0.005;
          const u2 = 1.5 * (this.U0*this.U0 + uy*uy);
          for (let k = 0; k < 9; k++) {
            const dot = 3 * (this.cx[k]*this.U0 + this.cy[k]*uy);
            this.f[i*9 + k] = this.W[k] * (1 + dot + 0.5*dot*dot - u2);
          }
        }
      }
    }

    _respawnParticle(i) {
      // Re-emit at the left edge with a fresh random Y. The Y determines
      // the band, so a particle's band may change on respawn — but the
      // streamline pattern preserves overall band stratification because
      // there's always a steady supply of "new red" particles at the top.
      // Set old position equal to new so the first frame after respawn
      // doesn't draw a long line from the particle's exit point.
      this.pxA[i] = this.random() * 4;
      this.pyA[i] = this.random() * this.GH;
      this.pxOld[i] = this.pxA[i];
      this.pyOld[i] = this.pyA[i];
      this.pBand[i] = Math.min(this.NBANDS - 1,
        Math.floor(this.pyA[i] / this.GH * this.NBANDS));
    }

    onClick() {
      // Re-scatter particles AND give the flow a kick. Useful for
      // breaking the simulation out of any locked-in periodic mode.
      for (let i = 0; i < this.P; i++) {
        this.pxA[i] = this.random() * this.GW;
        this.pyA[i] = this.random() * this.GH;
        this.pxOld[i] = this.pxA[i];
        this.pyOld[i] = this.pyA[i];
        this.pBand[i] = Math.min(this.NBANDS - 1,
          Math.floor(this.pyA[i] / this.GH * this.NBANDS));
      }
      for (let y = 0; y < this.GH; y++) {
        for (let x = 0; x < this.GW; x++) {
          const i = y*this.GW + x;
          if (this.solid[i]) continue;
          const ux = this.U0 + (this.random() - 0.5) * 0.02;
          const uy = (y - this.GH/2) / this.GH * 0.06;
          const usq = 1.5 * (ux*ux + uy*uy);
          for (let k = 0; k < 9; k++) {
            const dot = 3 * (this.cx[k]*ux + this.cy[k]*uy);
            this.f[i*9 + k] = this.W[k] * (1 + dot + 0.5*dot*dot - usq);
          }
        }
      }
    }

    _step() {
      const { GW, GH, N, f, ft, solid, tau, cx, cy, W: w, opp, U0 } = this;
      const invTau = 1 / tau;
      const u2_0 = 1.5 * U0 * U0;

      // Collide: in-place BGK relaxation toward local equilibrium.
      // We clamp ux/uy and re-equilibrate cells whose populations have
      // gone non-finite — a rare but real symptom of running close to
      // the τ=0.5 stability margin. Catching it here keeps a single bad
      // cell from poisoning the whole field via streaming.
      for (let i = 0; i < N; i++) {
        if (solid[i]) continue;
        const i9 = i * 9;
        let rho = 0, ux = 0, uy = 0;
        for (let k = 0; k < 9; k++) {
          const fk = f[i9 + k];
          rho += fk;
          ux += cx[k] * fk;
          uy += cy[k] * fk;
        }
        if (!isFinite(rho) || rho < 1e-6 || rho > 5) {
          // Cell is sick. Reset to equilibrium at inflow conditions.
          for (let k = 0; k < 9; k++) {
            const dot = 3 * cx[k] * U0;
            f[i9 + k] = w[k] * (1 + dot + 0.5*dot*dot - u2_0);
          }
          this.ux[i] = U0; this.uy[i] = 0;
          continue;
        }
        ux /= rho; uy /= rho;
        // Clamp velocities to the lattice Mach safety zone.
        if (ux >  0.20) ux =  0.20;
        if (ux < -0.20) ux = -0.20;
        if (uy >  0.20) uy =  0.20;
        if (uy < -0.20) uy = -0.20;
        this.ux[i] = ux; this.uy[i] = uy;
        const u2 = 1.5 * (ux*ux + uy*uy);
        for (let k = 0; k < 9; k++) {
          const dot = 3 * (cx[k]*ux + cy[k]*uy);
          const feq = w[k] * rho * (1 + dot + 0.5*dot*dot - u2);
          f[i9 + k] += invTau * (feq - f[i9 + k]);
        }
      }

      // Stream (pull form).
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const i = y * GW + x;
          if (solid[i]) continue;
          const i9 = i * 9;
          for (let k = 0; k < 9; k++) {
            const nx = x - cx[k], ny = y - cy[k];
            if (ny < 0 || ny >= GH) {
              ft[i9 + k] = f[i9 + opp[k]];
            } else if (nx < 0) {
              const dot = 3 * cx[k] * U0;
              ft[i9 + k] = w[k] * (1 + dot + 0.5*dot*dot - u2_0);
            } else if (nx >= GW) {
              ft[i9 + k] = f[i9 + k];
            } else {
              const j = ny * GW + nx;
              if (solid[j]) {
                ft[i9 + k] = f[i9 + opp[k]];
              } else {
                ft[i9 + k] = f[j*9 + k];
              }
            }
          }
        }
      }
      const tmp = this.f; this.f = this.ft; this.ft = tmp;
    }

    _advectParticles() {
      const GW = this.GW, GH = this.GH;
      const ux = this.ux, uy = this.uy, solid = this.solid;
      const advScale = this.advScale;
      for (let i = 0; i < this.P; i++) {
        const px = this.pxA[i], py = this.pyA[i];
        const x0 = Math.floor(px), y0 = Math.floor(py);
        if (!(x0 >= 0 && x0 < GW - 1 && y0 >= 0 && y0 < GH - 1)) {
          // Out of bounds OR NaN position — respawn.
          this._respawnParticle(i); continue;
        }
        const fx = px - x0, fy = py - y0;
        const i00 = y0 * GW + x0;
        const i10 = i00 + 1;
        const i01 = i00 + GW;
        const i11 = i01 + 1;
        const ix = (1-fx)*(1-fy)*ux[i00] + fx*(1-fy)*ux[i10]
                 + (1-fx)*fy*ux[i01]     + fx*fy*ux[i11];
        const iy = (1-fx)*(1-fy)*uy[i00] + fx*(1-fy)*uy[i10]
                 + (1-fx)*fy*uy[i01]     + fx*fy*uy[i11];
        const newX = px + ix * advScale;
        const newY = py + iy * advScale;
        // The !(condition) form catches NaN (which would make all the
        // direct comparisons false and silently leak a NaN position).
        if (!(newX >= 0 && newX < GW - 0.5 && newY >= 0 && newY < GH)) {
          this._respawnParticle(i); continue;
        }
        const cxi = Math.floor(newX), cyi = Math.floor(newY);
        if (solid[cyi * GW + cxi]) { this._respawnParticle(i); continue; }
        // Save current as previous BEFORE overwriting; render() draws a
        // line from old → new each frame.
        this.pxOld[i] = px;
        this.pyOld[i] = py;
        this.pxA[i] = newX;
        this.pyA[i] = newY;
      }
    }

    update() {
      // Three LBM sub-steps then advance the tracers once. The LBM
      // simulation runs faster than the visualization needs so the
      // velocity field is well-developed by the time particles sample it.
      this._step();
      this._step();
      this._step();
      this._advectParticles();
    }

    render() {
      const ctx = this.ctx;
      // Persistent fade: a low-alpha background pass dims last frame's
      // drawing slightly. Combined with the per-frame line segments, this
      // overlaps roughly 8–10 frames of motion into continuous-looking
      // streamlines instead of disjoint dots.
      ctx.fillStyle = 'rgba(10, 10, 12, 0.12)';
      ctx.fillRect(0, 0, this.w, this.h);

      const sX = this.w / this.GW;
      const sY = this.h / this.GH;

      // Render each particle as a short line from its old position to its
      // new position. Batched by color band so we only swap strokeStyle
      // NBANDS times per frame instead of P times. The double loop is
      // O(P · NBANDS), but with no allocations and a tight inner loop it
      // costs less than the random fillStyle thrash would.
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.5;
      for (let b = 0; b < this.NBANDS; b++) {
        ctx.strokeStyle = this.bandColors[b];
        ctx.beginPath();
        for (let i = 0; i < this.P; i++) {
          if (this.pBand[i] !== b) continue;
          ctx.moveTo(this.pxOld[i] * sX, this.pyOld[i] * sY);
          ctx.lineTo(this.pxA[i]   * sX, this.pyA[i]   * sY);
        }
        ctx.stroke();
      }

      // Cylinders drawn last so the fade never dulls them. Dark interior
      // masks any particle that briefly overlaps the ring; the bright
      // red outline echoes the convention in the reference visualizations.
      for (const c of this.cylinders) {
        const cx = c.x * sX, cy = c.y * sY, cr = c.r * sX;
        ctx.fillStyle = '#0a0a0c';
        ctx.beginPath();
        ctx.arc(cx, cy, cr - 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff3322';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ============================================================
  //   012 · CONWAY'S GAME OF LIFE (B3/S23, toroidal)
  // ============================================================
  // Each cell looks at its 8 neighbors. A live cell with 2 or 3 live
  // neighbors stays alive; a dead cell with exactly 3 becomes alive;
  // everything else dies. Wrap-around boundaries (torus topology) so
  // gliders never fall off the edge and the population doesn't slowly
  // bleed out at the walls. Cells that die leave a brief red-ember
  // fade so the act of dying is visible — without that, deaths just
  // become missing pixels and the simulation loses its pulse.
  class LifeEffect extends Effect {
    init() {
      this.GW = 128;
      this.GH = 96;
      this.NCELLS = this.GW * this.GH;
      this.cells = new Uint8Array(this.NCELLS);
      this.next  = new Uint8Array(this.NCELLS);
      this.fade  = new Uint8Array(this.NCELLS);
      this.FADE_FRAMES = 6;

      // Watchdog: Life loves to settle into still lifes and short-period
      // oscillators. If nothing has changed for ~3 seconds we reseed so
      // the canvas keeps moving.
      this.framesSinceChange = 0;
      this.STAGNATION_LIMIT = 180;

      this._seed();

      this.off = document.createElement('canvas');
      this.off.width  = this.GW;
      this.off.height = this.GH;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.GW, this.GH);
    }

    _seed() {
      // Random density around 32% — empirically the sweet spot for
      // generating gliders, oscillators, and complex dust patterns.
      // Below ~20% the soup dies fast; above ~50% it collapses into
      // dense stable lifes and oscillators.
      for (let i = 0; i < this.NCELLS; i++) {
        this.cells[i] = this.random() < 0.32 ? 1 : 0;
        this.fade[i] = 0;
      }
      this.framesSinceChange = 0;
    }

    onClick() { this._seed(); }

    _step() {
      const W = this.GW, H = this.GH;
      const cells = this.cells, next = this.next, fade = this.fade;
      let changed = false;
      for (let y = 0; y < H; y++) {
        const ym = (y - 1 + H) % H;
        const yp = (y + 1) % H;
        const yi  = y * W;
        const ymi = ym * W;
        const ypi = yp * W;
        for (let x = 0; x < W; x++) {
          const xm = (x - 1 + W) % W;
          const xp = (x + 1) % W;
          const n =
            cells[ymi + xm] + cells[ymi + x] + cells[ymi + xp] +
            cells[yi  + xm]                   + cells[yi  + xp] +
            cells[ypi + xm] + cells[ypi + x] + cells[ypi + xp];
          const cur = cells[yi + x];
          const newVal = cur === 1 ? (n === 2 || n === 3 ? 1 : 0)
                                   : (n === 3 ? 1 : 0);
          next[yi + x] = newVal;
          if (cur === 1 && newVal === 0) fade[yi + x] = this.FADE_FRAMES;
          if (cur !== newVal) changed = true;
        }
      }
      // Age the fade trails.
      for (let i = 0; i < this.NCELLS; i++) if (fade[i] > 0) fade[i]--;
      // Swap buffers.
      const tmp = this.cells; this.cells = this.next; this.next = tmp;
      return changed;
    }

    update() {
      // Two generations per frame — enough motion to read as alive at
      // 60fps, slow enough that you can still track gliders.
      const a = this._step();
      const b = this._step();
      if (a || b) this.framesSinceChange = 0;
      else this.framesSinceChange++;
      if (this.framesSinceChange > this.STAGNATION_LIMIT) this._seed();
    }

    render() {
      const data = this.imgData.data;
      const cells = this.cells, fade = this.fade;
      const F = this.FADE_FRAMES;
      for (let i = 0; i < this.NCELLS; i++) {
        const j = i * 4;
        if (cells[i]) {
          // Live cell: full amber accent.
          data[j] = 255; data[j+1] = 126; data[j+2] = 61; data[j+3] = 255;
        } else if (fade[i] > 0) {
          // Just-died: deep red ember, fades over FADE_FRAMES gens.
          const t = fade[i] / F;
          data[j]   = 90 * t;
          data[j+1] = 18 * t;
          data[j+2] = 10 * t;
          data[j+3] = 255;
        } else {
          // Background.
          data[j] = 10; data[j+1] = 10; data[j+2] = 12; data[j+3] = 255;
        }
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = '#0a0a0c';
      this.ctx.fillRect(0, 0, this.w, this.h);
      // Pixelated upscale — Life is a discrete grid, blurring it lies.
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   021 · SLIME MOLD / Physarum (Jones, 2010)
  // ============================================================
  // Thousands of agents wander a trail grid. Each agent samples the trail
  // at three points ahead (forward + two angled), turns toward whichever
  // sniffed strongest, walks one step, and deposits a little more trail
  // behind itself. Each tick the trail is box-blurred and slightly decayed.
  // No agent is aware of any other — they coordinate purely through the
  // chemical landscape they share, which is the definition of stigmergy.
  // The same machinery (almost exactly) is what physical Physarum slime
  // molds use to route between food sources in Petri dishes.
  class SlimeEffect extends Effect {
    init() {
      this.GW = 220; this.GH = 95;
      this.NA = 1800;
      this.trail = new Float32Array(this.GW * this.GH);
      this.trail2 = new Float32Array(this.GW * this.GH);
      this.agents = new Array(this.NA);
      this._seed();

      // Sensor / motion tuning. SENSE_DIST sets how far ahead agents
      // sample; if it's too small they can't "see" each other's trails and
      // never form networks. TURN/STEP determine how reactive vs how
      // straight-walking each agent is; DECAY governs how long old trails
      // linger and therefore how thick the resulting veins get.
      this.SENSE_DIST = 9;
      this.SENSE_ANG = Math.PI / 4;
      this.TURN = 0.5;
      this.STEP = 0.7;
      this.DECAY = 0.92;

      // Three slowly orbiting food sources give the colony something to
      // reach toward when the cursor isn't present. Without them the
      // colony just swirls; with them you get the iconic network growth.
      // Each one orbits at a different speed/phase so they don't lock up.
      this.foods = [
        { cx: this.GW * 0.22, cy: this.GH * 0.5,  rx: this.GW * 0.10, ry: this.GH * 0.28, w: 0.0040, ph: 0.0 },
        { cx: this.GW * 0.78, cy: this.GH * 0.5,  rx: this.GW * 0.10, ry: this.GH * 0.28, w: 0.0035, ph: 2.1 },
        { cx: this.GW * 0.50, cy: this.GH * 0.35, rx: this.GW * 0.14, ry: this.GH * 0.18, w: 0.0048, ph: 4.0 },
      ];

      this.off = document.createElement('canvas');
      this.off.width = this.GW;
      this.off.height = this.GH;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.GW, this.GH);
    }

    _seed() {
      // Spawn agents across three small clusters. This makes the early
      // frames legible — you watch three separate colonies grow, meet,
      // and merge into one network, which is the most dramatic moment.
      const clusters = [
        { x: this.GW * 0.30, y: this.GH * 0.50 },
        { x: this.GW * 0.70, y: this.GH * 0.50 },
        { x: this.GW * 0.50, y: this.GH * 0.30 },
      ];
      for (let i = 0; i < this.NA; i++) {
        const c = clusters[i % clusters.length];
        const a = this.random() * Math.PI * 2;
        const r = 2 + this.random() * 5;
        this.agents[i] = {
          x: c.x + Math.cos(a) * r,
          y: c.y + Math.sin(a) * r,
          a: a,
        };
      }
    }

    _sample(x, y) {
      const ix = ((x | 0) % this.GW + this.GW) % this.GW;
      const iy = ((y | 0) % this.GH + this.GH) % this.GH;
      return this.trail[iy * this.GW + ix];
    }

    _inject(cx, cy, strength) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          if (dx*dx + dy*dy > 16) continue;
          const ix = (((cx + dx) | 0) % this.GW + this.GW) % this.GW;
          const iy = (((cy + dy) | 0) % this.GH + this.GH) % this.GH;
          this.trail[iy * this.GW + ix] += strength;
        }
      }
    }

    onClick() {
      this.trail.fill(0);
      this.trail2.fill(0);
      this._seed();
    }

    update() {
      // Cursor takes priority when present. Otherwise the three orbiting
      // food sources keep the colony actively reaching for something.
      if (this.mx !== null) {
        const cx = (this.mx / this.w) * this.GW;
        const cy = (this.my / this.h) * this.GH;
        this._inject(cx, cy, 4);
      } else {
        for (const f of this.foods) {
          const fx = f.cx + Math.cos(this.tick * f.w + f.ph) * f.rx;
          const fy = f.cy + Math.sin(this.tick * f.w * 1.3 + f.ph) * f.ry;
          this._inject(fx, fy, 2.2);
        }
      }

      // Move each agent. The sense-and-turn logic is the heart of the algorithm.
      for (let i = 0; i < this.NA; i++) {
        const ag = this.agents[i];
        const fx = ag.x + Math.cos(ag.a) * this.SENSE_DIST;
        const fy = ag.y + Math.sin(ag.a) * this.SENSE_DIST;
        const lx = ag.x + Math.cos(ag.a - this.SENSE_ANG) * this.SENSE_DIST;
        const ly = ag.y + Math.sin(ag.a - this.SENSE_ANG) * this.SENSE_DIST;
        const rx = ag.x + Math.cos(ag.a + this.SENSE_ANG) * this.SENSE_DIST;
        const ry = ag.y + Math.sin(ag.a + this.SENSE_ANG) * this.SENSE_DIST;
        const F = this._sample(fx, fy);
        const L = this._sample(lx, ly);
        const R = this._sample(rx, ry);
        if (F > L && F > R) { /* heading is best, keep it */ }
        else if (L > R) ag.a -= this.TURN;
        else if (R > L) ag.a += this.TURN;
        else ag.a += (this.random() - 0.5) * this.TURN;

        ag.x += Math.cos(ag.a) * this.STEP;
        ag.y += Math.sin(ag.a) * this.STEP;
        if (ag.x < 0) ag.x += this.GW;
        if (ag.x >= this.GW) ag.x -= this.GW;
        if (ag.y < 0) ag.y += this.GH;
        if (ag.y >= this.GH) ag.y -= this.GH;
        const ix = ag.x | 0, iy = ag.y | 0;
        this.trail[iy * this.GW + ix] += 1.5;
      }

      // Diffuse + decay. A 3×3 box blur per cell (with toroidal wrap) is
      // the cheapest diffusion that still spreads gradients far enough for
      // agents to sense the trail laid down by their neighbors.
      const GW = this.GW, GH = this.GH;
      const t = this.trail, t2 = this.trail2, D = this.DECAY;
      for (let y = 0; y < GH; y++) {
        const ym = y === 0 ? GH - 1 : y - 1;
        const yp = y === GH - 1 ? 0 : y + 1;
        for (let x = 0; x < GW; x++) {
          const xm = x === 0 ? GW - 1 : x - 1;
          const xp = x === GW - 1 ? 0 : x + 1;
          const sum = t[ym*GW+xm] + t[ym*GW+x] + t[ym*GW+xp]
                    + t[y*GW+xm]  + t[y*GW+x]  + t[y*GW+xp]
                    + t[yp*GW+xm] + t[yp*GW+x] + t[yp*GW+xp];
          t2[y*GW+x] = (sum / 9) * D;
        }
      }
      this.trail = t2; this.trail2 = t;
    }

    render() {
      const data = this.imgData.data;
      const N = this.GW * this.GH;
      // Power-curve color map: gamma ≈ 0.6 lifts low values into the
      // visible range so faint trails appear as amber haze rather than
      // disappearing into the background. Saturates smoothly toward white.
      for (let i = 0; i < N; i++) {
        const raw = Math.min(1, this.trail[i] * 0.05);
        const v = Math.pow(raw, 0.6);
        const j = i * 4;
        data[j]   = (10 + v * 245) | 0;
        data[j+1] = (10 + v * v * 200) | 0;
        data[j+2] = (12 + v * v * v * 130) | 0;
        data[j+3] = 255;
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = BG;
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   022 · MARCHING SQUARES (Lorensen & Cline, 1987, 2D analog)
  // ============================================================
  // A scalar field generated from a handful of moving metaballs. For each
  // grid cell, we look at which of its 4 corners are above an iso-threshold
  // (giving one of 16 possible patterns) and emit the corresponding contour
  // segment(s), linearly interpolating where each one crosses the cell edge.
  // Running the same march at three thresholds gives nested rings — the
  // same trick every topographic map uses to draw elevation contours.
  class MarchingEffect extends Effect {
    init() {
      this.GW = 160; this.GH = 68;
      this.field = new Float32Array(this.GW * this.GH);
      this.balls = [];
      const N = 8;
      for (let i = 0; i < N; i++) {
        this.balls.push({
          x: 10 + this.random() * (this.GW - 20),
          y: 10 + this.random() * (this.GH - 20),
          vx: (this.random() - 0.5) * 0.18,
          vy: (this.random() - 0.5) * 0.18,
          r: 4 + this.random() * 2,
        });
      }
      // Three iso-thresholds → three nested contour rings per ball cluster.
      // Lower thresholds because the smaller balls give a weaker field.
      this.thresholds = [0.15, 0.30, 0.55];
    }

    update() {
      for (const b of this.balls) {
        b.x += b.vx; b.y += b.vy;
        if (b.x < 4 || b.x > this.GW - 4) b.vx *= -1;
        if (b.y < 4 || b.y > this.GH - 4) b.vy *= -1;
      }
      // Sample the metaball field. If the cursor is over the canvas, add
      // an extra ball at the cursor position so the user can pull the
      // contour lines around as they move.
      const cx = this.mx !== null ? (this.mx / this.w) * this.GW : null;
      const cy = this.my !== null ? (this.my / this.h) * this.GH : null;
      const GW = this.GW, GH = this.GH;
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          let s = 0;
          for (const b of this.balls) {
            const dx = x - b.x, dy = y - b.y;
            s += (b.r * b.r) / (dx*dx + dy*dy + 0.01);
          }
          if (cx !== null) {
            const dx = x - cx, dy = y - cy;
            s += 25 / (dx*dx + dy*dy + 0.01);
          }
          this.field[y * GW + x] = s;
        }
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, this.w, this.h);
      const cw = this.w / (this.GW - 1);
      const ch = this.h / (this.GH - 1);
      const F = this.field, GW = this.GW;

      for (let ti = 0; ti < this.thresholds.length; ti++) {
        const T = this.thresholds[ti];
        const alpha = 0.35 + ti * 0.25;
        ctx.strokeStyle = `rgba(255, ${126 + ti * 40}, ${61 + ti * 50}, ${alpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let y = 0; y < this.GH - 1; y++) {
          for (let x = 0; x < this.GW - 1; x++) {
            const tl = F[y * GW + x];
            const tr = F[y * GW + x + 1];
            const br = F[(y+1) * GW + x + 1];
            const bl = F[(y+1) * GW + x];
            // Build the 4-bit corner-classification code.
            let code = 0;
            if (tl > T) code |= 1;
            if (tr > T) code |= 2;
            if (br > T) code |= 4;
            if (bl > T) code |= 8;
            if (code === 0 || code === 15) continue;

            // Linearly interpolate where each cell edge crosses the iso-line.
            const px = x * cw, py = y * ch;
            const tT = (T - tl) / (tr - tl);
            const rT = (T - tr) / (br - tr);
            const bT = (T - bl) / (br - bl);
            const lT = (T - tl) / (bl - tl);
            const topX  = px + tT * cw, topY  = py;
            const rgtX  = px + cw,      rgtY  = py + rT * ch;
            const botX  = px + bT * cw, botY  = py + ch;
            const lftX  = px,           lftY  = py + lT * ch;

            // 16-case lookup. Symmetric pairs collapse: code N and 15-N
            // emit the same segment (just inverted inside/outside).
            switch (code) {
              case 1:  case 14: ctx.moveTo(lftX, lftY); ctx.lineTo(topX, topY); break;
              case 2:  case 13: ctx.moveTo(topX, topY); ctx.lineTo(rgtX, rgtY); break;
              case 4:  case 11: ctx.moveTo(rgtX, rgtY); ctx.lineTo(botX, botY); break;
              case 8:  case 7:  ctx.moveTo(botX, botY); ctx.lineTo(lftX, lftY); break;
              case 3:  case 12: ctx.moveTo(lftX, lftY); ctx.lineTo(rgtX, rgtY); break;
              case 6:  case 9:  ctx.moveTo(topX, topY); ctx.lineTo(botX, botY); break;
              // Ambiguous saddle cases — pick one resolution consistently.
              case 5:  ctx.moveTo(lftX, lftY); ctx.lineTo(topX, topY);
                       ctx.moveTo(rgtX, rgtY); ctx.lineTo(botX, botY); break;
              case 10: ctx.moveTo(topX, topY); ctx.lineTo(rgtX, rgtY);
                       ctx.moveTo(botX, botY); ctx.lineTo(lftX, lftY); break;
            }
          }
        }
        ctx.stroke();
      }
    }
  }

  // ============================================================
  //   023 · VORONOI + LLOYD RELAXATION
  // ============================================================
  // For each pixel we find its nearest seed by brute-force scan. That's
  // O(N · M) where N = pixels and M = seeds — fine at this resolution, and
  // it lets us simultaneously accumulate the centroid of each cell while
  // we're already iterating. Lloyd's algorithm then nudges every seed
  // toward its cell's centroid each frame; over time the seeds settle into
  // a near-uniform packing (a *centroidal Voronoi tessellation*) that is
  // the gold-standard blue-noise point distribution.
  class VoronoiEffect extends Effect {
    init() {
      this.GW = 180; this.GH = 80;
      this.MAX_SEEDS = 40;
      this.idMap = new Int16Array(this.GW * this.GH);
      this.seeds = [];
      this._reseed();

      this.off = document.createElement('canvas');
      this.off.width = this.GW;
      this.off.height = this.GH;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.GW, this.GH);
    }

    _reseed() {
      this.seeds = [];
      const N = 22;
      for (let i = 0; i < N; i++) {
        this.seeds.push({
          x: 4 + this.random() * (this.GW - 8),
          y: 4 + this.random() * (this.GH - 8),
          h: this.random(),
        });
      }
    }

    onClick(cx, cy) {
      if (this.seeds.length >= this.MAX_SEEDS) {
        this._reseed();
      } else {
        this.seeds.push({
          x: (cx / this.w) * this.GW,
          y: (cy / this.h) * this.GH,
          h: this.random(),
        });
      }
    }

    update() {
      const GW = this.GW, GH = this.GH;
      const S = this.seeds;
      const NS = S.length;
      // Per-seed centroid accumulators.
      const cxs = new Float64Array(NS);
      const cys = new Float64Array(NS);
      const cnt = new Int32Array(NS);
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          let best = 0, bd = Infinity;
          for (let i = 0; i < NS; i++) {
            const dx = x - S[i].x, dy = y - S[i].y;
            const d = dx*dx + dy*dy;
            if (d < bd) { bd = d; best = i; }
          }
          this.idMap[y * GW + x] = best;
          cxs[best] += x; cys[best] += y; cnt[best]++;
        }
      }
      // Lloyd step: move each seed gently toward its centroid.
      for (let i = 0; i < NS; i++) {
        if (cnt[i] > 0) {
          const tx = cxs[i] / cnt[i], ty = cys[i] / cnt[i];
          S[i].x += (tx - S[i].x) * 0.04;
          S[i].y += (ty - S[i].y) * 0.04;
        }
      }
    }

    render() {
      const GW = this.GW, GH = this.GH;
      const data = this.imgData.data;
      const id = this.idMap;
      // Cell interior color: a warm gray varying subtly by seed hue.
      for (let i = 0; i < GW * GH; i++) {
        const idx = id[i];
        const h = (this.seeds[idx] && this.seeds[idx].h) || 0;
        const j = i * 4;
        data[j]   = 24 + h * 38;
        data[j+1] = 16 + h * 18;
        data[j+2] = 14 + h * 6;
        data[j+3] = 255;
      }
      // Edge pass: brighten any pixel whose right or bottom neighbor
      // belongs to a different cell.
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW - 1; x++) {
          const a = id[y*GW+x], b = id[y*GW+x+1];
          if (a !== b) {
            const j = (y*GW+x) * 4;
            data[j] = 255; data[j+1] = 126; data[j+2] = 61;
          }
        }
      }
      for (let y = 0; y < GH - 1; y++) {
        for (let x = 0; x < GW; x++) {
          const a = id[y*GW+x], b = id[(y+1)*GW+x];
          if (a !== b) {
            const j = (y*GW+x) * 4;
            data[j] = 255; data[j+1] = 126; data[j+2] = 61;
          }
        }
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = BG;
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
      // Seed dots drawn on top at native canvas resolution.
      this.ctx.fillStyle = '#fff5e8';
      for (const s of this.seeds) {
        this.ctx.beginPath();
        this.ctx.arc((s.x / GW) * this.w, (s.y / GH) * this.h, 2.2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  // ============================================================
  //   024 · FLOYD–STEINBERG DITHERING (1976)
  // ============================================================
  // Each pixel rounds to its nearest available palette entry, then PUSHES
  // the quantization error onto its neighbors at the canonical kernel
  // weights (7/16 right, 3/16 below-left, 5/16 below, 1/16 below-right).
  // The mistakes cancel out across the image, so you can render smooth
  // gradients with only a handful of grey levels — the same trick every
  // 8-bit display, every printed newspaper photo, every GIF ever used.
  // The source here is a smooth procedural scene (two animated lights, plus
  // a slow sinusoidal ripple) that we re-quantize every frame.
  class DitherEffect extends Effect {
    init() {
      // Source signal is generated at one half-width of the display buffer.
      // The display buffer is two source widths plus a 1-px vertical divider —
      // left half shows the smooth source, right half shows the same source
      // after Floyd–Steinberg with the current palette depth.
      this.W = 160; this.H = 138;
      this.src = new Float32Array(this.W * this.H);
      this.err = new Float32Array(this.W * this.H);
      this.palettes = [2, 4, 8, 16];
      this.paletteIdx = this.settings.preset ?? 0;

      this.canvasW = this.W * 2;
      this.off = document.createElement('canvas');
      this.off.width = this.canvasW;
      this.off.height = this.H;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.canvasW, this.H);
    }

    onClick() {
      this.paletteIdx = (this.paletteIdx + 1) % this.palettes.length;
    }

    update() {
      const t = this.tick * 0.012;
      const W = this.W, H = this.H;
      // Light 1: orbits the source center on a slow ellipse.
      const lx1 = W * 0.5 + Math.cos(t * 0.7) * W * 0.32;
      const ly1 = H * 0.5 + Math.sin(t * 0.5) * H * 0.38;
      // Light 2: follows cursor (mapped into source coordinates so the
      // light shows at the same relative position whether the cursor is
      // in the left half or the right half); falls back to counter-orbit
      // when no cursor is present.
      let lx2, ly2;
      if (this.mx !== null) {
        const halfW = this.w * 0.5;
        const xInHalf = this.mx % halfW;
        lx2 = (xInHalf / halfW) * W;
        ly2 = (this.my / this.h) * H;
      } else {
        lx2 = W * 0.5 + Math.cos(-t * 0.9 + 1.5) * W * 0.34;
        ly2 = H * 0.5 + Math.sin(-t * 1.1 + 0.7) * H * 0.34;
      }
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d1 = Math.hypot(x - lx1, y - ly1);
          const d2 = Math.hypot(x - lx2, y - ly2);
          const v1 = Math.max(0, 1 - d1 / 80);
          const v2 = Math.max(0, 1 - d2 / 60);
          let v = v1 + v2 * 0.85;
          v += Math.sin(x * 0.04 + y * 0.05 + t * 1.4) * 0.06;
          this.src[y * W + x] = Math.min(1, Math.max(0, v * 0.55));
        }
      }
    }

    _amber(v) {
      // Single palette mapping used for both halves so the comparison
      // is honest — only the input values differ.
      return [
        (10 + v * 245) | 0,
        (10 + v * v * 200) | 0,
        (12 + v * v * v * 130) | 0,
      ];
    }

    render() {
      const W = this.W, H = this.H, CW = this.canvasW;
      const levels = this.palettes[this.paletteIdx];
      const step = 1 / (levels - 1);
      const err = this.err;
      err.set(this.src);
      // Floyd–Steinberg on the err buffer (in place). Top→bottom, left→right.
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const old = err[i];
          const q = Math.round(old * (levels - 1)) * step;
          err[i] = q;
          const e = old - q;
          if (x + 1 < W)              err[i + 1]     += e * 7/16;
          if (x - 1 >= 0 && y + 1 < H) err[i + W - 1] += e * 3/16;
          if (y + 1 < H)              err[i + W]     += e * 5/16;
          if (x + 1 < W && y + 1 < H) err[i + W + 1] += e * 1/16;
        }
      }
      const data = this.imgData.data;
      // Each row writes: left half (smooth source), right half (dithered).
      for (let y = 0; y < H; y++) {
        const rowStart = y * CW;
        for (let x = 0; x < W; x++) {
          const cs = this._amber(this.src[y * W + x]);
          const cd = this._amber(err[y * W + x]);
          const jL = (rowStart + x) * 4;
          const jR = (rowStart + W + x) * 4;
          data[jL] = cs[0]; data[jL+1] = cs[1]; data[jL+2] = cs[2]; data[jL+3] = 255;
          data[jR] = cd[0]; data[jR+1] = cd[1]; data[jR+2] = cd[2]; data[jR+3] = 255;
        }
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = BG;
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
      // Faint divider line at display resolution — matches the style used
      // by entry 026, sitting above the pixel grid rather than inside it.
      this.ctx.strokeStyle = 'rgba(244, 241, 234, 0.12)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(this.w / 2, 0);
      this.ctx.lineTo(this.w / 2, this.h);
      this.ctx.stroke();
    }
  }

  // ============================================================
  //   025 · RAYCASTING — Wolfenstein 3D style (Carmack, 1992)
  // ============================================================
  // For each screen column we shoot a ray into a 2D grid map and DDA-step
  // it cell by cell until we hit a wall. The distance to that hit (with a
  // cosine fish-eye correction) determines how tall the wall slice should
  // be on screen, and which face of the cell was hit determines its shade.
  // No floors, no ceilings, no real 3D math — just 120 rays per frame.
  class RaycastEffect extends Effect {
    init() {
      // Two small maps. 1 = wall, 0 = open floor. Both maps are designed
      // with a fully open rectangular perimeter just inside the outer wall —
      // the auto-walk path traverses that perimeter so it never clips a
      // wall and never has to backtrack.
      const M = [
        [
          "11111111111111111111",
          "10000000000000000001",
          "10011110001110011001",
          "10010000001000010001",
          "10010001100000011001",
          "10000001100010000001",
          "10001110000011100001",
          "10001000000001000001",
          "10000000111100000001",
          "10001100000000110001",
          "10000000111100000001",
          "10000001100010000001",
          "10011110000011100001",
          "10000001100000010001",
          "10000000000000000001",
          "11111111111111111111",
        ],
        [
          "11111111111111111111",
          "10000000000000000001",
          "10110110110110110101",
          "10000000000000000001",
          "10110110110110110101",
          "10000000000000000001",
          "10110110110110110101",
          "10000000000000000001",
          "10000000000000000001",
          "10110110110110110101",
          "10000000000000000001",
          "10110110110110110101",
          "10000000000000000001",
          "10110110110110110101",
          "10000000000000000001",
          "11111111111111111111",
        ],
      ];
      this.maps = M.map(rows => rows.map(r => r.split('').map(Number)));
      this.mapIdx = this.settings.preset ?? 0;
      this._setMap();
      this.pathT = 0;

      // Manual-mode state: when true, the auto-walk pauses and WASD /
      // arrow keys drive the player directly. A click on the canvas
      // switches to the next map *and* enters manual mode; a click
      // outside the canvas (or Escape) exits.
      this.manualMode = false;
      this.keys = new Set();


    }

    _setMap() {
      this.map = this.maps[this.mapIdx];
      this.MH = this.map.length;
      this.MW = this.map[0].length;
      this.px = 1.5;
      this.py = 1.5;
      this.pa = 0;
      this.pathT = 0;
    }

    onClick() {
      this.mapIdx = (this.mapIdx + 1) % this.maps.length;
      this._setMap();
      this.manualMode = true;
      this.keys.clear();
    }

    _open(x, y) {
      if (x < 0 || x >= this.MW || y < 0 || y >= this.MH) return false;
      return this.map[y | 0][x | 0] === 0;
    }

    // Lerp between angles handling the 2π wrap so a 170° → -170° turn
    // goes the short way (20°) instead of the long way (340°).
    _angLerp(a, b, t) {
      let diff = b - a;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      return a + diff * t;
    }

    update() {
      if (this.manualMode) {
        // Direct WASD / arrow-key control with separate-axis collision so
        // the player can slide along walls instead of catching on corners.
        const TURN = 0.0225;
        const SPEED = 0.035;
        if (this.keys.has('a') || this.keys.has('arrowleft'))  this.pa -= TURN;
        if (this.keys.has('d') || this.keys.has('arrowright')) this.pa += TURN;
        let move = 0;
        if (this.keys.has('w') || this.keys.has('arrowup'))   move += SPEED;
        if (this.keys.has('s') || this.keys.has('arrowdown')) move -= SPEED;
        if (move !== 0) {
          const dx = Math.cos(this.pa) * move;
          const dy = Math.sin(this.pa) * move;
          if (this._open(this.px + dx, this.py)) this.px += dx;
          if (this._open(this.px, this.py + dy)) this.py += dy;
        }
      } else {
        // Auto-walk along the rectangular perimeter. 4 equal-time segments
        // × ~50 seconds per full loop at 60fps — a slow casual stroll. The
        // gentle angular lerp (0.025) toward the current segment's heading
        // turns each corner into a soft curve over ~80 frames rather than
        // a 90° snap.
        const LOOP = 3000;
        this.pathT = (this.pathT + 1) % LOOP;
        const t = this.pathT / LOOP;
        const corners = [
          [1.5, 1.5],
          [this.MW - 1.5, 1.5],
          [this.MW - 1.5, this.MH - 1.5],
          [1.5, this.MH - 1.5],
        ];
        const headings = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        const seg = Math.floor(t * 4);
        const segT = (t * 4) - seg;
        const a = corners[seg];
        const b = corners[(seg + 1) % 4];
        this.px = a[0] + (b[0] - a[0]) * segT;
        this.py = a[1] + (b[1] - a[1]) * segT;
        this.pa = this._angLerp(this.pa, headings[seg], 0.025);
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.fillStyle = '#1a1418';
      ctx.fillRect(0, 0, this.w, this.h * 0.5);
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, this.h * 0.5, this.w, this.h * 0.5);

      const COLUMNS = 120;
      const colW = this.w / COLUMNS;
      const FOV = Math.PI / 3;
      const dir = this.pa;
      for (let c = 0; c < COLUMNS; c++) {
        const a = dir + (c / COLUMNS - 0.5) * FOV;
        const dx = Math.cos(a), dy = Math.sin(a);
        let mx = this.px | 0, my = this.py | 0;
        const stepX = dx > 0 ? 1 : -1;
        const stepY = dy > 0 ? 1 : -1;
        const dXdT = Math.abs(1 / dx);
        const dYdT = Math.abs(1 / dy);
        let tx = dx > 0 ? (mx + 1 - this.px) * dXdT : (this.px - mx) * dXdT;
        let ty = dy > 0 ? (my + 1 - this.py) * dYdT : (this.py - my) * dYdT;
        let side = 0;
        let dist = 0;
        let hit = false;
        for (let s = 0; s < 64; s++) {
          if (tx < ty) { mx += stepX; dist = tx; tx += dXdT; side = 0; }
          else         { my += stepY; dist = ty; ty += dYdT; side = 1; }
          if (mx < 0 || mx >= this.MW || my < 0 || my >= this.MH) { hit = true; break; }
          if (this.map[my][mx]) { hit = true; break; }
        }
        if (!hit) continue;
        const perp = Math.max(0.01, dist * Math.cos(a - dir));
        const sliceH = Math.min(this.h, this.h / perp);
        const yTop = (this.h - sliceH) * 0.5;
        const shade = Math.max(0.1, 1 - perp / 10);
        const sideMul = side === 1 ? 0.65 : 1.0;
        const r = (255 * shade * sideMul) | 0;
        const g = (126 * shade * sideMul) | 0;
        const b = ( 61 * shade * sideMul) | 0;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(c * colW, yTop, colW + 0.5, sliceH);
      }

      // Mini-map in top-left.
      const ms = 4;
      const mx0 = 14, my0 = 14;
      ctx.fillStyle = 'rgba(10,10,12,0.78)';
      ctx.fillRect(mx0 - 4, my0 - 4, this.MW * ms + 8, this.MH * ms + 8);
      for (let y = 0; y < this.MH; y++) {
        for (let x = 0; x < this.MW; x++) {
          if (this.map[y][x]) {
            ctx.fillStyle = '#4a4640';
            ctx.fillRect(mx0 + x * ms, my0 + y * ms, ms, ms);
          }
        }
      }
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(mx0 + this.px * ms, my0 + this.py * ms, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx0 + this.px * ms, my0 + this.py * ms);
      ctx.lineTo(mx0 + (this.px + Math.cos(dir) * 3) * ms,
                 my0 + (this.py + Math.sin(dir) * 3) * ms);
      ctx.stroke();

      // Manual-mode indicator: bright accent border on the mini-map plus
      // a "WASD / arrows" label below it.
      if (this.manualMode) {
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1;
        ctx.strokeRect(mx0 - 4.5, my0 - 4.5, this.MW * ms + 9, this.MH * ms + 9);
        ctx.fillStyle = ACCENT;
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('WASD / arrows', mx0 - 1, my0 + this.MH * ms + 14);
      }
    }
  }

  // ============================================================
  //   026 · MANDELBROT & JULIA (Julia 1918, Mandelbrot 1980)
  // ============================================================
  // Left half is the Mandelbrot set: for each point c, iterate z ← z² + c
  // starting at z = 0 and count how many steps the orbit takes to escape
  // (or fail to). Right half is the Julia set for the *currently selected*
  // c: same iteration, but c stays fixed while the starting z sweeps the
  // plane. As the cursor moves over the Mandelbrot, the corresponding Julia
  // morphs continuously — every point in the Mandelbrot is its own Julia.
  class MandelbrotEffect extends Effect {
    init() {
      this.W = 360; this.H = 156;
      this.hw = this.W / 2;
      this.maxIter = 80;
      // Bailout radius 16 (squared: 256). The escape-time integer count
      // has visible banding at the set boundary; a smooth (fractional)
      // iteration count μ = n + 1 − log₂(log|z|) removes the banding,
      // but the math is only well-conditioned at a large bailout — that's
      // why we use 16 instead of the textbook 2.
      this.BAIL2 = 256;
      this.LOG2 = Math.log(2);
      this.cReal = this.settings.real ?? -0.78; this.cImag = this.settings.imaginary ?? 0.18;
      this.frozen = false;
      this.mandelDone = false;

      this.off = document.createElement('canvas');
      this.off.width = this.W; this.off.height = this.H;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.W, this.H);
    }

    onClick() {
      // Toggle freeze. While unfrozen, the Julia tracks the cursor; while
      // frozen, you can move the cursor freely without changing it.
      this.frozen = !this.frozen;
    }

    _palette(it) {
      // Inside the set → near-black. Outside → amber gradient by smooth
      // iteration count (it is a float, not an integer).
      if (it >= this.maxIter) return [10, 10, 12];
      const t = Math.max(0, it / this.maxIter);
      return [
        (10 + Math.pow(t, 0.5) * 245) | 0,
        (10 + Math.pow(t, 1.3) * 200) | 0,
        (12 + Math.pow(t, 2.2) * 130) | 0,
      ];
    }

    update() {
      if (this.mx !== null && !this.frozen) {
        const fx = this.mx / this.w;
        const fy = this.my / this.h;
        if (fx < 0.5) {
          // Convert pixel position on the left half to a point in the
          // Mandelbrot's complex plane.
          this.cReal = -2.2 + (fx * 2) * 2.9;
          this.cImag = -1.1 + fy * 2.2;
        }
      }
    }

    render() {
      const W = this.W, H = this.H, hw = this.hw, M = this.maxIter;
      const BAIL2 = this.BAIL2, LOG2 = this.LOG2;
      const data = this.imgData.data;

      // Mandelbrot only needs to be computed once — c varies per pixel but
      // doesn't depend on time or input. After the first frame the left
      // half lives in imgData and we just keep it there.
      if (!this.mandelDone) {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < hw; x++) {
            const cr = -2.2 + (x / hw) * 2.9;
            const ci = -1.1 + (y / H) * 2.2;
            let zr = 0, zi = 0, it = 0;
            let r2 = 0;
            while (it < M) {
              r2 = zr*zr + zi*zi;
              if (r2 > BAIL2) break;
              const nr = zr*zr - zi*zi + cr;
              zi = 2*zr*zi + ci;
              zr = nr;
              it++;
            }
            let smooth = it;
            if (it < M) {
              // μ = n + 1 − log₂(log|z|): the fractional offset that fills
              // in the gap between integer iteration counts.
              const logZn = Math.log(r2) * 0.5;
              smooth = it + 1 - Math.log(logZn / LOG2) / LOG2;
            }
            const c = this._palette(smooth);
            const j = (y * W + x) * 4;
            data[j] = c[0]; data[j+1] = c[1]; data[j+2] = c[2]; data[j+3] = 255;
          }
        }
        this.mandelDone = true;
      }

      // Julia recomputed every frame for the current c.
      const cr = this.cReal, ci = this.cImag;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < hw; x++) {
          let zr = -1.6 + (x / hw) * 3.2;
          let zi = -1.1 + (y / H) * 2.2;
          let it = 0;
          let r2 = 0;
          while (it < M) {
            r2 = zr*zr + zi*zi;
            if (r2 > BAIL2) break;
            const nr = zr*zr - zi*zi + cr;
            zi = 2*zr*zi + ci;
            zr = nr;
            it++;
          }
          let smooth = it;
          if (it < M) {
            const logZn = Math.log(r2) * 0.5;
            smooth = it + 1 - Math.log(logZn / LOG2) / LOG2;
          }
          const c = this._palette(smooth);
          const j = (y * W + (x + hw)) * 4;
          data[j] = c[0]; data[j+1] = c[1]; data[j+2] = c[2]; data[j+3] = 255;
        }
      }

      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = BG;
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);

      // Crosshair on the Mandelbrot marking the current c.
      const ctx = this.ctx;
      const halfDisplay = this.w / 2;
      const markerX = ((this.cReal + 2.2) / 2.9) * halfDisplay;
      const markerY = ((this.cImag + 1.1) / 2.2) * this.h;
      ctx.strokeStyle = this.frozen ? '#fff5e8' : 'rgba(255, 245, 232, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
      ctx.stroke();
      if (this.frozen) {
        ctx.beginPath();
        ctx.moveTo(markerX - 7, markerY); ctx.lineTo(markerX + 7, markerY);
        ctx.moveTo(markerX, markerY - 7); ctx.lineTo(markerX, markerY + 7);
        ctx.stroke();
      }
      // Faint divider between Mandelbrot and Julia.
      ctx.strokeStyle = 'rgba(244, 241, 234, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.w / 2, 0);
      ctx.lineTo(this.w / 2, this.h);
      ctx.stroke();
    }
  }

  // ============================================================
  //   027 · PLASMA EFFECT (demoscene, late 1980s)
  // ============================================================
  // Per pixel: sum four sine waves of (x, y, x+y, distance-to-center) at
  // different frequencies and time offsets, divide to normalize to [-1,1],
  // and feed through a palette lookup. The interference between waves at
  // incommensurate frequencies makes the bands shift past one another
  // continuously — beautiful entropy for fifteen lines of math.
  class PlasmaEffect extends Effect {
    init() {
      this.W = 320; this.H = 138;
      // Four palettes the user can cycle through. Each maps a [0,1] value
      // to an [r,g,b] triple. The first is on-brand amber; the rest sweep
      // through old-school demoscene palettes for variety.
      this.palettes = [
        (v) => [
          (10 + Math.pow(v, 0.6) * 245) | 0,
          (10 + Math.pow(v, 1.3) * 200) | 0,
          (12 + Math.pow(v, 2.2) * 130) | 0,
        ],
        (v) => [
          (40 + v * 215) | 0,
          (10 + Math.pow(v, 2) * 100) | 0,
          (50 + (1 - v) * 100) | 0,
        ],
        (v) => {
          const r = (v < 0.5 ? v * 2 * 90 : 255) | 0;
          const g = (v < 0.5 ? v * 2 * 40 : ((v - 0.5) * 2) * 200 + 40) | 0;
          const b = (v < 0.5 ? (1 - v * 2) * 180 : ((v - 0.5) * 2) * 220) | 0;
          return [r, g, b];
        },
        (v) => { const g = (10 + v * 240) | 0; return [g, g, g]; },
      ];
      this.paletteIdx = this.settings.preset ?? 0;

      this.off = document.createElement('canvas');
      this.off.width = this.W; this.off.height = this.H;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.W, this.H);
    }

    onClick() {
      this.paletteIdx = (this.paletteIdx + 1) % this.palettes.length;
    }

    update() {}

    render() {
      const W = this.W, H = this.H;
      const t = this.tick * 0.018;
      const data = this.imgData.data;
      const pal = this.palettes[this.paletteIdx];
      // Cursor (or fallback) sets the center of the radial wave term —
      // moving the cursor visibly slides the bullseye around the canvas.
      let cx = W * 0.5, cy = H * 0.5;
      if (this.mx !== null) {
        cx = (this.mx / this.w) * W;
        cy = (this.my / this.h) * H;
      }
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dx = x - cx, dy = y - cy;
          const v = (
            Math.sin(x * 0.06 + t) +
            Math.sin(y * 0.05 - t * 1.3) +
            Math.sin((x + y) * 0.04 + t * 0.7) +
            Math.sin(Math.hypot(dx, dy) * 0.05 - t * 1.5)
          ) / 4;
          const u = (v + 1) * 0.5;
          const c = pal(u);
          const j = (y * W + x) * 4;
          data[j] = c[0]; data[j+1] = c[1]; data[j+2] = c[2]; data[j+3] = 255;
        }
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = BG;
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   028 · VOXEL SPACE (Comanche, 1992)
  // ============================================================
  // For each pixel column, walk forward sampling a heightmap. Project each
  // sample to a screen y; fill from that y down to the column's previous
  // ceiling. A per-column y-buffer gives correct occlusion for free — far
  // strips can only ever paint above near ones.
  class VoxelSpaceEffect extends Effect {
    init() {
      this.W = 320; this.H = 180;
      this.off = document.createElement('canvas');
      this.off.width = this.W; this.off.height = this.H;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.W, this.H);
      this.ybuf = new Int32Array(this.W);
      this.camZ = 0;
      this.camX = 0;
      this.camH = 70;          // camera flies above the terrain
      this.horizon = this.H * 0.42;
      this.focal = 100;
      this.zNear = 6;           // very-near samples make perspective explode
      this.zMax = 260;
    }

    // Procedural heightmap as a sum of cheap sinusoids. Range roughly [0, 90].
    _height(wx, wz) {
      return 45 + (
        Math.sin(wx * 0.012) * Math.cos(wz * 0.013) * 30 +
        Math.sin((wx + wz) * 0.037)              * 12 +
        Math.cos(wx * 0.085) * Math.sin(wz * 0.07) * 6
      );
    }

    update() {
      this.camZ += 0.8;
      // Cursor pans the camera left/right; gentle sway as a fallback.
      let pan = Math.sin(this.tick * 0.005) * 30;
      if (this.mx !== null) pan = ((this.mx / this.w) - 0.5) * 140;
      this.camX = pan;
    }

    render() {
      const W = this.W, H = this.H;
      const data = this.imgData.data;

      // Sky gradient
      for (let y = 0; y < H; y++) {
        const t = y / H;
        const r = 14 + t * 36, g = 12 + t * 40, b = 22 + t * 58;
        for (let x = 0; x < W; x++) {
          const j = (y * W + x) * 4;
          data[j] = r; data[j+1] = g; data[j+2] = b; data[j+3] = 255;
        }
      }

      // Reset y-buffer to bottom of screen
      for (let x = 0; x < W; x++) this.ybuf[x] = H;

      const horizon = this.horizon, focal = this.focal, camH = this.camH;
      let z = this.zNear, zStep = 1;

      // Front-to-back march. Step grows with z (constant angular resolution).
      while (z < this.zMax) {
        const spanWorld = (W / focal) * z;
        const stepX = spanWorld / W;
        const startWX = -spanWorld * 0.5 + this.camX;
        const wz = z + this.camZ;
        const fog = Math.min(1, Math.pow(z / this.zMax, 0.9));

        for (let x = 0; x < W; x++) {
          const wx = startWX + x * stepX;
          const h = this._height(wx, wz);
          let screenY = (horizon - ((h - camH) * focal / z)) | 0;
          // Off-screen-above samples still count as "ceiling = top of screen"
          // so this column is fully sealed and we skip remaining iterations.
          if (screenY < 0) screenY = 0;
          if (screenY < this.ybuf[x]) {
            // Color by altitude
            let r, g, b;
            if (h > 70)       { r = 215; g = 210; b = 200; } // snow
            else if (h > 56)  { r = 122; g =  98; b =  74; } // rock
            else if (h > 40)  { r =  72; g =  92; b =  48; } // forest
            else if (h > 26)  { r =  98; g = 108; b =  60; } // grass
            else              { r =  56; g =  78; b =  98; } // water
            // Distance fog toward the sky tone
            r = r * (1 - fog) + 28 * fog;
            g = g * (1 - fog) + 32 * fog;
            b = b * (1 - fog) + 50 * fog;
            const bot = Math.min(H, this.ybuf[x]);
            for (let y = screenY; y < bot; y++) {
              const j = (y * W + x) * 4;
              data[j] = r; data[j+1] = g; data[j+2] = b; data[j+3] = 255;
            }
            this.ybuf[x] = screenY;
          }
        }
        z += zStep;
        zStep *= 1.005;
      }

      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = BG;
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   029 · LANGTON'S ANT (Langton, 1986)
  // ============================================================
  // An ant on a grid. On a light cell turn right and flip; on a dark cell
  // turn left and flip; step forward. After ~10k chaotic steps the ant
  // spontaneously locks into a periodic "highway" pattern. Nobody has
  // proved why it always does this, only that it always has.
  class LangtonEffect extends Effect {
    init() {
      this.G = 140;
      this.off = document.createElement('canvas');
      this.off.width = this.G; this.off.height = this.G;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.G, this.G);
      this._reset();
    }

    _reset() {
      this.grid = new Uint8Array(this.G * this.G);
      this.x = this.G >> 1;
      this.y = this.G >> 1;
      this.dir = 0;          // 0=up, 1=right, 2=down, 3=left
      this.steps = 0;
    }

    onClick() { this._reset(); }

    update() {
      // Run many steps per frame so the chaotic phase resolves into the
      // highway in a few seconds of viewing.
      const STEPS = 600;
      const G = this.G;
      for (let i = 0; i < STEPS; i++) {
        const idx = this.y * G + this.x;
        const c = this.grid[idx];
        // Light (0): turn right; dark (1): turn left
        this.dir = (this.dir + (c ? 3 : 1)) & 3;
        this.grid[idx] = 1 - c;
        if (this.dir === 0)      this.y--;
        else if (this.dir === 1) this.x++;
        else if (this.dir === 2) this.y++;
        else                     this.x--;
        // Wrap (ant rarely reaches the edges before the highway emerges,
        // and when it does, this keeps the simulation alive).
        if (this.x < 0)  this.x += G; else if (this.x >= G) this.x -= G;
        if (this.y < 0)  this.y += G; else if (this.y >= G) this.y -= G;
        this.steps++;
      }
    }

    render() {
      const G = this.G;
      const data = this.imgData.data;
      // Render grid: 0 = ink-on-dark background, 1 = page cream.
      for (let i = 0; i < G * G; i++) {
        const j = i * 4;
        if (this.grid[i]) {
          data[j] = 232; data[j+1] = 228; data[j+2] = 218;
        } else {
          data[j] = 14;  data[j+1] = 14;  data[j+2] = 16;
        }
        data[j+3] = 255;
      }
      // Highlight the ant in accent.
      const aj = (this.y * G + this.x) * 4;
      data[aj] = 255; data[aj+1] = 126; data[aj+2] = 61; data[aj+3] = 255;

      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = BG;
      this.ctx.fillRect(0, 0, this.w, this.h);
      // Pixelated draw so each cell stays crisp at any canvas size.
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   030 · TUNNEL (demoscene, early 1990s)
  // ============================================================
  // Precompute, per pixel, the angle to the center and an inverse-distance
  // depth. At runtime, add a time offset to depth and sample a procedural
  // texture. The whole "plunging through a shaft" feel comes from inverse
  // distance: pixels near the center have huge depth and so scroll past
  // fastest.
  class TunnelEffect extends Effect {
    init() {
      this.W = 240; this.H = 180;
      this.off = document.createElement('canvas');
      this.off.width = this.W; this.off.height = this.H;
      this.offCtx = this.off.getContext('2d');
      this.imgData = this.offCtx.createImageData(this.W, this.H);
      this.lutU = new Float32Array(this.W * this.H);
      this.lutV = new Float32Array(this.W * this.H);
      this.lutF = new Float32Array(this.W * this.H); // center darkening
      const cx = this.W * 0.5, cy = this.H * 0.5;
      const RATIO = 36;
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const dx = x - cx, dy = y - cy;
          const dist = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx) / (Math.PI * 2);
          const i = y * this.W + x;
          this.lutU[i] = angle + 1;
          this.lutV[i] = RATIO / Math.max(1, dist);
          this.lutF[i] = Math.min(1, dist / 26);
        }
      }
      this.palettes = [
        // Amber (on-brand)
        (v) => {
          v = v < 0 ? 0 : (v > 1 ? 1 : v);
          return [
            (10 + Math.pow(v, 0.6) * 245) | 0,
            (10 + Math.pow(v, 1.3) * 200) | 0,
            (12 + Math.pow(v, 2.2) * 130) | 0,
          ];
        },
        // Cool teal
        (v) => {
          v = v < 0 ? 0 : (v > 1 ? 1 : v);
          return [
            (10 + v * v * 60) | 0,
            (40 + v * 160) | 0,
            (60 + v * 180) | 0,
          ];
        },
        // Magenta/purple
        (v) => {
          v = v < 0 ? 0 : (v > 1 ? 1 : v);
          return [
            (40 + v * 215) | 0,
            (10 + Math.pow(v, 2) * 100) | 0,
            (60 + v * 180) | 0,
          ];
        },
        // Mono
        (v) => { v = v < 0 ? 0 : (v > 1 ? 1 : v); const g = (20 + v * 220) | 0; return [g, g, g]; },
      ];
      this.pi = this.settings.preset ?? 0;
    }

    onClick() { this.pi = (this.pi + 1) % this.palettes.length; }

    update() {}

    render() {
      const W = this.W, H = this.H;
      const data = this.imgData.data;
      const t = this.tick * 0.012;
      // Cursor drifts the apparent center of the tunnel via texture offset.
      let du = 0, dv = 0;
      if (this.mx !== null) {
        du = ((this.mx / this.w) - 0.5) * 0.6;
        dv = ((this.my / this.h) - 0.5) * 0.8;
      }
      const pal = this.palettes[this.pi];
      const n = W * H;
      for (let i = 0; i < n; i++) {
        const u = this.lutU[i] + t * 0.15 + du;
        const v = this.lutV[i] + t + dv;
        // XOR-checker pattern on the unwrapped (u, v) texture.
        const fu = u - Math.floor(u);
        const fv = v - Math.floor(v);
        const a = (fu * 16) | 0;
        const b = (fv * 16) | 0;
        let val = ((a ^ b) & 15) / 15;
        val = val * 0.65 + 0.35;     // floor so dark squares aren't pure black
        val *= this.lutF[i];          // fade the very center to near black
        const c = pal(val);
        const j = i * 4;
        data[j] = c[0]; data[j+1] = c[1]; data[j+2] = c[2]; data[j+3] = 255;
      }
      this.offCtx.putImageData(this.imgData, 0, 0);
      this.ctx.fillStyle = BG;
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(this.off, 0, 0, this.w, this.h);
    }
  }

  // ============================================================
  //   BOOTSTRAP — instantiate, observe, run on visibility
  // ============================================================
  export const REGISTRY = {
    fire: FireEffect,
    boids: BoidsEffect,
    rope: RopeEffect,
    flow: FlowEffect,
    terrain: TerrainEffect,
    mode7: Mode7Effect,
    hash: HashEffect,
    spring: SpringEffect,
    sdf: SDFEffect,
    fluid: FluidEffect,
    curl: CurlEffect,
    fluidgl: FluidGLEffect,
    reaction: ReactionEffect,
    attractor: AttractorEffect,
    dla: DLAEffect,
    lsystem: LSystemEffect,
    phyllotaxis: PhyllotaxisEffect,
    wfc: WFCEffect,
    lbm: LBMEffect,
    life: LifeEffect,
    slime: SlimeEffect,
    marching: MarchingEffect,
    voronoi: VoronoiEffect,
    dither: DitherEffect,
    raycast: RaycastEffect,
    mandelbrot: MandelbrotEffect,
    plasma: PlasmaEffect,
    voxelspace: VoxelSpaceEffect,
    langton: LangtonEffect,
    tunnel: TunnelEffect,
  };

