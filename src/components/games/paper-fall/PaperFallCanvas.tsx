"use client";

// ═══════════════════════════════════════════════════════════
// PaperFall — Canvas Renderer
// Full-scene rendering: sky, hills, clouds, cannon, words,
// bomb words, fragments, projectiles, particles, HUD
// ═══════════════════════════════════════════════════════════

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { PaperFallEngine, mulberry32 } from './PaperFallEngine';
import type {
  PaperFallWord, BombFragment, GameFx, FxBall, FxChip,
  FxSpark, FxSmoke, FxFlash, FxPop, Difficulty,
} from './types';

// ── OKLCH → RGBA helper ──────────────────────────────────
function ok(L: number, C: number, H: number, a = 1): string {
  const h = H * Math.PI / 180;
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.2914855480 * B;
  const l3 = l_ ** 3, m3 = m_ ** 3, s3 = s_ ** 3;
  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
  const f = (x: number) => {
    x = Math.min(1, Math.max(0, x));
    return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
  };
  return `rgba(${f(r)},${f(g)},${f(b)},${a})`;
}

// ── Color palette ────────────────────────────────────────
const COL = {
  skyTop: (a = 1) => ok(.90, .048, 250, a),
  skyMid: (a = 1) => ok(.935, .038, 236, a),
  skyLow: (a = 1) => ok(.95, .048, 84, a),
  glow: (a = 1) => ok(.98, .055, 86, a),
  paper: (a = 1) => ok(.975, .018, 84, a),
  paperEdge: (a = 1) => ok(.68, .045, 68, a),
  ink: (a = 1) => ok(.26, .036, 265, a),
  inkSoft: (a = 1) => ok(.45, .028, 265, a),
  ember: (a = 1) => ok(.56, .176, 38, a),
  emberHot: (a = 1) => ok(.80, .145, 74, a),
  emberDim: (a = 1) => ok(.45, .150, 32, a),
  hillFar: (a = 1) => ok(.74, .032, 254, a),
  hillMid: (a = 1) => ok(.55, .045, 258, a),
  hillNear: (a = 1) => ok(.30, .045, 262, a),
  grass: (a = 1) => ok(.48, .075, 148, a),
  iron: (a = 1) => ok(.36, .022, 264, a),
  ironLit: (a = 1) => ok(.74, .020, 252, a),
  ironDark: (a = 1) => ok(.17, .018, 264, a),
  wood: (a = 1) => ok(.40, .060, 52, a),
  woodLit: (a = 1) => ok(.58, .070, 58, a),
  brass: (a = 1) => ok(.68, .100, 78, a),
  smoke: (a = 1) => ok(.84, .014, 262, a),
  bombGlow: (a = 1) => ok(.60, .200, 25, a),
  bombRed: (a = 1) => ok(.50, .180, 20, a),
};

// ── Canvas handle interface ──────────────────────────────
export interface PaperFallCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
}

interface Props {
  engine: PaperFallEngine;
  isPlaying: boolean;
  className?: string;
}

const BARREL = 62;
const STEP = 1 / 120;

const PaperFallCanvas = forwardRef<PaperFallCanvasHandle, Props>(
  ({ engine, isPlaying, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const backdropRef = useRef<HTMLCanvasElement | null>(null);
    const sizeRef = useRef({ W: 0, H: 0, DPR: 1, TOP: 0, GROUND: 0, FIELD: 0, SC: 1, FS: 22 });
    const cannonRef = useRef({ x: 0, y: 0, aim: -Math.PI / 2, recoil: 0 });
    const fxRef = useRef<GameFx>(engine.fx);
    const animRef = useRef<number>(0);
    const lastRef = useRef<number>(0);
    const accRef = useRef<number>(0);
    const hudClockRef = useRef<number>(0);
    const readyRef = useRef(false);

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
    }));

    // ── Cloud data (static) ──────────────────────────────
    const cloudsRef = useRef<Array<{
      x: number; y: number; s: number; sp: number;
      puffs: Array<{ dx: number; dy: number; rr: number }>;
    }>>([]);

    useEffect(() => {
      const r = mulberry32(4242);
      const clouds = [];
      for (let i = 0; i < 8; i++) {
        const puffs = [];
        const n = 3 + Math.floor(r() * 3);
        for (let j = 0; j < n; j++) puffs.push({ dx: (j - n / 2) * (22 + r() * 12), dy: (r() - 0.5) * 12, rr: 18 + r() * 18 });
        clouds.push({ x: r(), y: 0.05 + r() * 0.5, s: 0.6 + r() * 0.8, sp: (0.004 + r() * 0.01) * (r() < 0.5 ? -1 : 1), puffs });
      }
      cloudsRef.current = clouds;
    }, []);

    // ── Layout ───────────────────────────────────────────
    const layout = useCallback(() => {
      const cvs = canvasRef.current;
      if (!cvs) return false;
      const rect = cvs.getBoundingClientRect();
      const w = Math.round(rect.width), h = Math.round(rect.height);
      if (w < 40 || h < 40) return false;

      const s = sizeRef.current;
      if (w === s.W && h === s.H && readyRef.current) return true;

      s.W = w; s.H = h;
      s.DPR = Math.min(window.devicePixelRatio || 1, 2);
      cvs.width = Math.round(w * s.DPR);
      cvs.height = Math.round(h * s.DPR);

      s.SC = Math.max(0.62, Math.min(1.15, Math.min(w / 1180, h / 720)));
      s.FS = Math.round(Math.max(15, Math.min(28, Math.min(w * 0.021, h * 0.038))));
      s.TOP = w < 660 ? 110 : 86;
      s.GROUND = Math.round(h - Math.max(78, 86 * s.SC));
      s.FIELD = Math.max(140, s.GROUND - s.TOP);

      cannonRef.current.x = w / 2;
      cannonRef.current.y = s.GROUND + 20 * s.SC;

      backdropRef.current = buildBackdrop(s, cloudsRef.current);
      readyRef.current = true;
      return true;
    }, []);

    // ── Build static backdrop ────────────────────────────
    function buildBackdrop(
      s: typeof sizeRef.current,
      _clouds: typeof cloudsRef.current
    ): HTMLCanvasElement {
      const off = document.createElement('canvas');
      off.width = Math.round(s.W * s.DPR);
      off.height = Math.round(s.H * s.DPR);
      const g = off.getContext('2d')!;
      g.setTransform(s.DPR, 0, 0, s.DPR, 0, 0);

      // Sky gradient
      const sky = g.createLinearGradient(0, 0, 0, s.GROUND + 20);
      sky.addColorStop(0, COL.skyTop());
      sky.addColorStop(0.46, COL.skyMid());
      sky.addColorStop(0.84, COL.skyLow());
      sky.addColorStop(1, ok(0.94, 0.060, 72));
      g.fillStyle = sky;
      g.fillRect(0, 0, s.W, s.H);

      // Sun bloom
      const sx = s.W * 0.76, sy = s.GROUND - s.FIELD * 0.10;
      const rad = Math.min(s.FIELD * 1.5, s.W * 0.7);
      const bloom = g.createRadialGradient(sx, sy, 0, sx, sy, rad);
      bloom.addColorStop(0, COL.glow(0.85));
      bloom.addColorStop(0.20, COL.glow(0.34));
      bloom.addColorStop(0.55, COL.glow(0.10));
      bloom.addColorStop(1, COL.glow(0));
      g.fillStyle = bloom;
      g.fillRect(0, 0, s.W, s.H);
      g.beginPath();
      g.arc(sx, sy, 17 * s.SC, 0, 7);
      g.fillStyle = ok(0.995, 0.028, 88, 0.92);
      g.fill();

      // Hills
      const drawHill = (baseY: number, amp: number, freq: number, phase: number, col: string) => {
        g.beginPath();
        g.moveTo(0, s.H);
        for (let x = 0; x <= s.W; x += 6) {
          const y = baseY - Math.sin(x * freq + phase) * amp
            - Math.sin(x * freq * 2.7 + phase * 1.9) * amp * 0.32
            - Math.sin(x * freq * 0.43 + phase * 0.6) * amp * 0.75;
          g.lineTo(x, y);
        }
        g.lineTo(s.W, s.H);
        g.closePath();
        g.fillStyle = col;
        g.fill();
      };
      drawHill(s.GROUND - 2 * s.SC, 20 * s.SC, 0.0042, 1.1, COL.hillFar(0.5));
      drawHill(s.GROUND + 14 * s.SC, 26 * s.SC, 0.0031, 3.4, COL.hillMid(0.6));
      drawHill(s.GROUND + 30 * s.SC, 14 * s.SC, 0.0058, 0.3, COL.hillNear());

      // Grass blades
      const base = s.GROUND + 30 * s.SC, amp = 14 * s.SC;
      const ridge = (x: number) => base - Math.sin(x * 0.0058) * amp
        - Math.sin(x * 0.0157 + 0.57) * amp * 0.32
        - Math.sin(x * 0.0025 + 0.18) * amp * 0.75;
      const rg = mulberry32(9182);
      g.lineWidth = 1.2;
      for (let i = 0; i < 80; i++) {
        const x = rg() * s.W, y = ridge(x), hh = (4 + rg() * 8) * s.SC, lean = (rg() - 0.5) * 6 * s.SC;
        g.beginPath();
        g.moveTo(x, y + 2);
        g.quadraticCurveTo(x + lean * 0.4, y - hh * 0.6, x + lean, y - hh);
        g.strokeStyle = rg() < 0.4 ? COL.grass(0.55) : COL.hillNear(0.8);
        g.stroke();
      }

      // Birds
      g.strokeStyle = COL.inkSoft(0.28);
      g.lineWidth = 1.5;
      [[0.15, 0.20, 1], [0.20, 0.27, 0.8], [0.25, 0.17, 0.65]].forEach(([bx, by, bs]) => {
        const x = s.W * bx, y = s.TOP + s.FIELD * by, k = 6 * bs * s.SC;
        g.beginPath();
        g.moveTo(x - k, y);
        g.quadraticCurveTo(x - k * 0.4, y - k * 0.6, x, y - k * 0.1);
        g.quadraticCurveTo(x + k * 0.4, y - k * 0.6, x + k, y);
        g.stroke();
      });

      return off;
    }

    // ── Word font & measurement ──────────────────────────
    function wordFont(fs: number) {
      return `600 ${fs}px Fraunces, Georgia, serif`;
    }

    function measureWord(ctx: CanvasRenderingContext2D, w: PaperFallWord, fs: number) {
      ctx.font = wordFont(fs);
      const chars: Array<{ ch: string; x: number; w: number }> = [];
      let x = 0;
      for (const ch of w.text) {
        const m = ctx.measureText(ch).width;
        chars.push({ ch, x, w: m });
        x += m;
      }
      w.tw = x;
      w.chars = chars;
      w.bw = x + fs * 1.0;
      w.bh = fs * 1.55;
    }

    function wordPos(w: PaperFallWord, s: typeof sizeRef.current) {
      return { x: w.x * s.W, y: s.TOP + w.y * s.FIELD };
    }

    // ── Main animation loop ──────────────────────────────
    useEffect(() => {
      layout();
      const obs = new ResizeObserver(() => layout());
      if (canvasRef.current) obs.observe(canvasRef.current);

      lastRef.current = performance.now();
      accRef.current = 0;

      const frame = (now: number) => {
        animRef.current = requestAnimationFrame(frame);
        if (!readyRef.current && !layout()) {
          lastRef.current = now;
          return;
        }

        let raw = (now - lastRef.current) / 1000;
        lastRef.current = now;
        const fx = fxRef.current;
        // Don't clamp dt for the physics loop so the game catches up if tab was minimized.
        // Cap at 15 seconds to prevent browser lockup.
        const dtPhysics = Math.min(15.0, raw) * fx.timeScale;
        accRef.current += dtPhysics;

        // Visual dt (for particles) should still be clamped to avoid massive teleportation jumps
        const dtVisual = Math.min(0.05, raw) * fx.timeScale;

        let guard = 0;
        while (accRef.current >= STEP && guard++ < 1000) {
          engine.step(STEP);
          accRef.current -= STEP;
        }

        if (engine.state.phase === 'dying' && fx.timeScale < 1) {
          fx.timeScale = Math.min(1, fx.timeScale + 0.0015);
        }

        stepFx(dtVisual, engine, fx, sizeRef.current);
        render(now / 1000, dtVisual, engine, fx);
      };

      animRef.current = requestAnimationFrame(frame);

      return () => {
        cancelAnimationFrame(animRef.current);
        obs.disconnect();
      };
    }, [engine, layout]);

    // ── FX step ──────────────────────────────────────────
    function stepFx(dt: number, eng: PaperFallEngine, fx: GameFx, s: typeof sizeRef.current) {
      const S = eng.state;
      const cannon = cannonRef.current;

      // Cannon aim tracking
      cannon.recoil = Math.max(0, cannon.recoil - dt * 4.4);
      const tgt = S.locked != null ? S.words.find((v) => v.id === S.locked) : null;
      let want: number;
      if (tgt) {
        const p = wordPos(tgt, s);
        want = Math.atan2(p.y - (cannon.y - 6 * s.SC), p.x - cannon.x);
      } else {
        want = -Math.PI / 2 + Math.sin(S.t * 0.5) * 0.09;
      }
      want = Math.max(-Math.PI * 0.96, Math.min(-Math.PI * 0.04, want));
      cannon.aim += (want - cannon.aim) * Math.min(1, dt * 12);

      // Balls
      for (const b of fx.balls) {
        const w = S.words.find((v) => v.id === b.target);
        const p = w ? wordPos(w, s) : (b.last || { x: b.x, y: b.y - 40 });
        b.last = p;
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1, mv = b.sp * dt;
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 6) b.trail.shift();
        if (d <= mv + b.r) {
          b.x = p.x; b.y = p.y; b.done = true;
          if (w && b.kill) {
            w.dead = true;
            burstFx(b.x, b.y, fx, s, S);
          } else {
            hitSparkFx(b.x, b.y, fx, s, S);
          }
        } else {
          b.x += (dx / d) * mv;
          b.y += (dy / d) * mv;
        }
      }
      fx.balls = fx.balls.filter((b) => !b.done);

      // Particles
      for (const c of fx.chips) { c.life -= dt; c.vy += 1100 * dt; c.vx *= 0.994; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; }
      fx.chips = fx.chips.filter((c) => c.life > 0 && c.y < s.H + 50).slice(-380);
      for (const sp of fx.sparks) { sp.life -= dt; sp.vy += 560 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vx *= 0.96; sp.vy *= 0.96; }
      fx.sparks = fx.sparks.filter((sp) => sp.life > 0).slice(-260);
      for (const sm of fx.smoke) { sm.life -= dt; sm.x += sm.vx * dt; sm.y += sm.vy * dt; sm.vx *= 0.95; sm.vy = sm.vy * 0.95 - 22 * dt; sm.r += sm.grow * dt; }
      fx.smoke = fx.smoke.filter((sm) => sm.life > 0).slice(-170);
      for (const fl of fx.flashes) fl.life -= dt;
      fx.flashes = fx.flashes.filter((fl) => fl.life > 0);
      for (const p of fx.pops) { p.life -= dt; p.y -= 42 * dt; }
      fx.pops = fx.pops.filter((p) => p.life > 0);
      fx.shake *= Math.pow(0.0016, dt);
    }

    function burstFx(px: number, py: number, fx: GameFx, s: typeof sizeRef.current, S: typeof engine.state) {
      const cols = [COL.paper(1), COL.paper(1), ok(0.90, 0.032, 80), COL.ember(1), COL.emberDim(1), COL.ink(1)];
      for (let i = 0; i < 26; i++) {
        fx.chips.push({
          x: px + (S.rand() - 0.5) * 60, y: py + (S.rand() - 0.5) * 30,
          vx: (S.rand() - 0.5) * 380, vy: -50 - S.rand() * 260,
          rot: S.rand() * 6.3, vr: (S.rand() - 0.5) * 13,
          w: (3 + S.rand() * 7) * s.SC, h: (2 + S.rand() * 5) * s.SC,
          col: cols[Math.floor(S.rand() * cols.length)],
          life: 1 + S.rand() * 0.8, dur: 1.8,
        });
      }
      for (let i = 0; i < 14; i++) {
        fx.sparks.push({
          x: px, y: py,
          vx: (S.rand() - 0.5) * 620, vy: (S.rand() - 0.5) * 620,
          life: 0.16 + S.rand() * 0.26, dur: 0.44, hot: S.rand() < 0.5,
        });
      }
    }

    function hitSparkFx(px: number, py: number, fx: GameFx, s: typeof sizeRef.current, S: typeof engine.state) {
      for (let i = 0; i < 8; i++) {
        fx.sparks.push({
          x: px, y: py,
          vx: (S.rand() - 0.5) * 340, vy: (S.rand() - 0.5) * 340 - 50,
          life: 0.1 + S.rand() * 0.2, dur: 0.3, hot: S.rand() < 0.6,
        });
      }
      for (let i = 0; i < 3; i++) {
        fx.chips.push({
          x: px, y: py,
          vx: (S.rand() - 0.5) * 160, vy: -36 - S.rand() * 100,
          rot: S.rand() * 6.3, vr: (S.rand() - 0.5) * 11,
          w: 3.5 * s.SC, h: 2.5 * s.SC, col: COL.paper(1),
          life: 0.55, dur: 0.8,
        });
      }
    }

    // ── Fire cannon ──────────────────────────────────────
    // Called whenever a character is typed successfully
    useEffect(() => {
      const origHandleChar = engine.handleChar.bind(engine);
      engine.handleChar = (raw: string) => {
        const prevTyped = engine.state.typed;
        const prevCleared = engine.state.cleared;
        const result = origHandleChar(raw);
        if (result !== false && engine.state.typed > prevTyped) {
          const kill = engine.state.cleared > prevCleared;
          fireCannon(kill, engine, fxRef.current, sizeRef.current, result);
        }
        return result;
      };
      return () => { engine.handleChar = origHandleChar; };
    }, [engine]);

    function fireCannon(kill: boolean, eng: PaperFallEngine, fx: GameFx, s: typeof sizeRef.current, targetId: number) {
      const cannon = cannonRef.current;
      const S = eng.state;
      const L = (BARREL + 6) * s.SC - cannon.recoil * 13 * s.SC;
      const mx = cannon.x + Math.cos(cannon.aim) * L;
      const my = cannon.y - 6 * s.SC + Math.sin(cannon.aim) * L;

      // Find target word for score pop position (it may already be doomed, but still in the array)
      const tgt = S.words.find(w => w.id === targetId);

      fx.balls.push({
        x: mx, y: my, target: targetId,
        r: (kill ? 8.5 : 4.8) * s.SC,
        sp: (kill ? 2000 : 1700) * s.SC,
        kill, trail: [],
      });
      cannon.recoil = kill ? 1 : 0.55;

      // Muzzle flash
      fx.flashes.push({ x: mx, y: my, a: cannon.aim, life: kill ? 0.2 : 0.12, dur: kill ? 0.2 : 0.12, s: kill ? 1 : 0.6 });

      // Smoke puffs
      for (let i = 0; i < (kill ? 6 : 3); i++) {
        fx.smoke.push({
          x: mx, y: my,
          vx: Math.cos(cannon.aim) * (40 + S.rand() * 110) + (S.rand() - 0.5) * 36,
          vy: Math.sin(cannon.aim) * (40 + S.rand() * 110) - 10,
          r: (6 + S.rand() * 8) * s.SC, grow: (22 + S.rand() * 22) * s.SC,
          life: 0.7 + S.rand() * 0.7, dur: 1.4,
        });
      }
      fx.shake = Math.min(8 * s.SC, fx.shake + (kill ? 3.8 : 1.2) * s.SC);

      // Score pop
      if (kill) {
        const p = tgt ? wordPos(tgt, s) : { x: mx, y: my - 40 };
        const mult = 1 + Math.min(S.combo, 30) * 0.04;
        const gain = Math.round((20 + (tgt?.text?.length ?? 5) * 13) * mult * (1 + S.level * 0.08));
        fx.pops.push({ x: p.x, y: p.y - 30, txt: '+' + gain, life: 0.9, dur: 0.9 });
      }
    }

    // ── Bomb explosion FX ────────────────────────────────
    useEffect(() => {
      engine.onBombExplode = (wordId, wx, wy) => {
        const s = sizeRef.current;
        const fx = fxRef.current;
        const S = engine.state;
        const px = wx * s.W, py = s.TOP + wy * s.FIELD;

        // Explosion burst — fire colors
        const fireCols = [COL.bombRed(1), COL.ember(1), COL.emberHot(1), ok(0.9, 0.1, 40), ok(0.7, 0.15, 30)];
        for (let i = 0; i < 40; i++) {
          fx.chips.push({
            x: px + (S.rand() - 0.5) * 40, y: py + (S.rand() - 0.5) * 40,
            vx: (S.rand() - 0.5) * 500, vy: -100 - S.rand() * 300,
            rot: S.rand() * 6.3, vr: (S.rand() - 0.5) * 15,
            w: (3 + S.rand() * 8) * s.SC, h: (2 + S.rand() * 6) * s.SC,
            col: fireCols[Math.floor(S.rand() * fireCols.length)],
            life: 1.2 + S.rand() * 0.6, dur: 1.8,
          });
        }
        for (let i = 0; i < 24; i++) {
          fx.sparks.push({
            x: px, y: py,
            vx: (S.rand() - 0.5) * 800, vy: (S.rand() - 0.5) * 800,
            life: 0.2 + S.rand() * 0.3, dur: 0.5, hot: true,
          });
        }
        for (let i = 0; i < 10; i++) {
          fx.smoke.push({
            x: px + (S.rand() - 0.5) * 60, y: py,
            vx: (S.rand() - 0.5) * 160, vy: -30 - S.rand() * 80,
            r: (10 + S.rand() * 14) * s.SC, grow: (40 + S.rand() * 40) * s.SC,
            life: 1.0 + S.rand() * 1.0, dur: 2.0,
          });
        }
        fx.shake = Math.min(14 * s.SC, fx.shake + 8 * s.SC);
      };

      return () => { engine.onBombExplode = undefined; };
    }, [engine]);

    // ── Render frame ─────────────────────────────────────
    function render(t: number, dt: number, eng: PaperFallEngine, fx: GameFx) {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;
      const s = sizeRef.current;
      const S = eng.state;

      ctx.setTransform(s.DPR, 0, 0, s.DPR, 0, 0);
      ctx.clearRect(0, 0, s.W, s.H);

      // Screen shake
      const sx = fx.shake > 0.1 ? (Math.random() - 0.5) * fx.shake : 0;
      const sy = fx.shake > 0.1 ? (Math.random() - 0.5) * fx.shake : 0;
      ctx.save();
      ctx.translate(sx, sy);

      // Backdrop
      if (backdropRef.current) ctx.drawImage(backdropRef.current, 0, 0, s.W, s.H);

      // Clouds
      drawClouds(ctx, dt, s);

      // Ground danger line
      drawGroundLine(ctx, t, s, S);

      // Aim line
      const cannon = cannonRef.current;
      const tgt = S.locked != null ? S.words.find((v) => v.id === S.locked) : null;
      if (tgt) {
        const mL = (BARREL + 6) * s.SC - cannon.recoil * 13 * s.SC;
        const mx = cannon.x + Math.cos(cannon.aim) * mL;
        const my = cannon.y - 6 * s.SC + Math.sin(cannon.aim) * mL;
        const p = wordPos(tgt, s);
        ctx.save();
        ctx.strokeStyle = COL.ember(0.24);
        ctx.lineWidth = 1.1;
        ctx.setLineDash([3 * s.SC, 7 * s.SC]);
        ctx.lineDashOffset = -t * 55;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }

      // Measure words if needed
      for (const w of S.words) {
        if (!w.chars) measureWord(ctx, w, s.FS);
      }

      // Draw words
      for (const w of S.words) {
        if (!w.doomed) drawSlip(ctx, w, S.locked === w.id, t, s);
      }

      // Draw bomb fragments
      for (const f of S.fragments) {
        if (!f.dead) drawFragment(ctx, f, s, t);
      }

      // Cannon
      drawCannon(ctx, s, cannon);

      // Projectiles
      drawBalls(ctx, fx, s);

      // Particles
      drawFxParticles(ctx, fx, s);

      ctx.restore();
    }

    // ── Draw clouds ──────────────────────────────────────
    function drawClouds(ctx: CanvasRenderingContext2D, dt: number, s: typeof sizeRef.current) {
      for (const c of cloudsRef.current) {
        c.x += c.sp * dt * 0.6;
        if (c.x > 1.3) c.x = -0.3;
        if (c.x < -0.3) c.x = 1.3;
        const cx = c.x * s.W, cy = s.TOP + c.y * s.FIELD * 0.7, sc = c.s * s.SC;
        for (const p of c.puffs) {
          const x = cx + p.dx * sc, y = cy + p.dy * sc, rr = p.rr * sc;
          const gl = ctx.createRadialGradient(x - rr * 0.2, y - rr * 0.3, 0, x, y, rr);
          gl.addColorStop(0, COL.paper(0.72));
          gl.addColorStop(0.55, COL.paper(0.28));
          gl.addColorStop(1, COL.paper(0));
          ctx.fillStyle = gl;
          ctx.beginPath();
          ctx.arc(x, y, rr, 0, 7);
          ctx.fill();
        }
      }
    }

    // ── Draw ground line ─────────────────────────────────
    function drawGroundLine(ctx: CanvasRenderingContext2D, t: number, s: typeof sizeRef.current, S: typeof engine.state) {
      let closest = 1;
      for (const w of S.words) if (!w.doomed) closest = Math.min(closest, 1 - w.y);
      const heat = smooth(0.30, 0.02, closest);
      ctx.save();
      ctx.strokeStyle = heat > 0.02 ? ok(0.55, 0.15, 34, 0.25 + heat * 0.6) : COL.ink(0.18);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([8 * s.SC, 8 * s.SC]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath();
      ctx.moveTo(0, s.GROUND);
      ctx.lineTo(s.W, s.GROUND);
      ctx.stroke();
      ctx.setLineDash([]);
      if (heat > 0.02) {
        const g = ctx.createLinearGradient(0, s.GROUND - 52 * s.SC, 0, s.GROUND);
        g.addColorStop(0, COL.ember(0));
        g.addColorStop(1, COL.ember(0.09 + heat * 0.15 * (0.7 + 0.3 * Math.sin(t * 8))));
        ctx.fillStyle = g;
        ctx.fillRect(0, s.GROUND - 52 * s.SC, s.W, 52 * s.SC);
      }
      ctx.restore();
    }

    // ── Draw paper slip ──────────────────────────────────
    function drawSlip(ctx: CanvasRenderingContext2D, w: PaperFallWord, locked: boolean, t: number, s: typeof sizeRef.current) {
      const p = wordPos(w, s);
      const danger = smooth(0.68, 0.99, w.y);
      const fs = s.FS;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(w.tilt + Math.sin(w.phase) * (0.03 + danger * 0.045) + w.hit * 0.04);
      const bw = w.bw!, bh = w.bh!, rr = 3 * s.SC;

      // Shadow
      ctx.save();
      ctx.shadowColor = ok(0.34, 0.045, 264, 0.26 + danger * 0.12);
      ctx.shadowBlur = (9 + danger * 10) * s.SC;
      ctx.shadowOffsetY = 4 * s.SC;
      ctx.fillStyle = COL.paper(1);
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, rr);
      ctx.fill();
      ctx.restore();

      // Body gradient
      const body = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
      body.addColorStop(0, ok(0.99, 0.010, 86));
      body.addColorStop(0.55, ok(0.965 - danger * 0.05, 0.016 + danger * 0.045, 82 - danger * 20));
      body.addColorStop(1, ok(0.92 - danger * 0.09, 0.024 + danger * 0.065, 74 - danger * 28));
      ctx.fillStyle = body;
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, rr);
      ctx.fill();

      // Border
      ctx.lineWidth = locked ? 1.6 * s.SC : 1 * s.SC;
      if (w.isBomb && !w.bombExploded) {
        // Bomb word — pulsing red border
        const pulse = 0.5 + 0.5 * Math.sin((w.bombFlash ?? 0) * 6);
        ctx.strokeStyle = COL.bombRed(0.6 + pulse * 0.4);
        ctx.lineWidth = 2 * s.SC;
      } else {
        ctx.strokeStyle = locked ? COL.ember(0.9) : (danger > 0.05 ? ok(0.55, 0.13, 34, 0.35 + danger * 0.5) : COL.paperEdge(0.45));
      }
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, rr);
      ctx.stroke();

      // Bomb icon
      if (w.isBomb && !w.bombExploded) {
        const bombPulse = 0.5 + 0.5 * Math.sin((w.bombFlash ?? 0) * 6);
        // Glow behind bomb icon
        const bombGlow = ctx.createRadialGradient(-bw / 2 - 8 * s.SC, -bh / 2 - 4 * s.SC, 0, -bw / 2 - 8 * s.SC, -bh / 2 - 4 * s.SC, 16 * s.SC);
        bombGlow.addColorStop(0, COL.bombGlow(0.4 * bombPulse));
        bombGlow.addColorStop(1, COL.bombGlow(0));
        ctx.fillStyle = bombGlow;
        ctx.beginPath();
        ctx.arc(-bw / 2 - 8 * s.SC, -bh / 2 - 4 * s.SC, 16 * s.SC, 0, 7);
        ctx.fill();
        // Bomb emoji
        ctx.font = `${Math.round(14 * s.SC)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', -bw / 2 - 8 * s.SC, -bh / 2 - 2 * s.SC);
      }

      // Text
      ctx.font = wordFont(fs);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const x0 = -(w.tw ?? 0) / 2;

      // Typed highlight
      if (w.typed > 0 && w.chars) {
        const d = w.chars[w.typed - 1];
        ctx.fillStyle = COL.ember(0.13);
        roundRect(ctx, x0 - fs * 0.16, -bh / 2 + 3 * s.SC, d.x + d.w + fs * 0.30, bh - 6 * s.SC, 2);
        ctx.fill();
      }

      w.chars?.forEach((c, i) => {
        ctx.fillStyle = i < w.typed ? COL.emberDim(0.5) : (i === w.typed && locked ? COL.ink(1) : COL.ink(0.92));
        ctx.fillText(c.ch, x0 + c.x, 1);
      });

      // Cursor underline
      if (locked && w.typed < (w.chars?.length ?? 0) && w.chars) {
        const c = w.chars[w.typed];
        ctx.fillStyle = COL.ember(0.5 + 0.5 * Math.sin(t * 9));
        ctx.fillRect(x0 + c.x, bh / 2 - 5.5 * s.SC, c.w, 2.2 * s.SC);
      }

      ctx.restore();
    }

    // ── Draw bomb fragment ───────────────────────────────
    function drawFragment(ctx: CanvasRenderingContext2D, f: BombFragment, s: typeof sizeRef.current, t: number) {
      const px = f.x * s.W, py = s.TOP + f.y * s.FIELD;
      const fs = Math.round(s.FS * 0.85);
      const bw = fs * 1.4, bh = fs * 1.4;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(f.rot);

      // Tiny paper slip
      ctx.fillStyle = ok(0.97, 0.02, 84, Math.min(1, f.life * 0.5));
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 2);
      ctx.fill();

      // Red border (individual fragment)
      ctx.strokeStyle = COL.bombRed(Math.min(1, f.life * 0.4));
      ctx.lineWidth = 1.2 * s.SC;
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 2);
      ctx.stroke();

      // Character
      ctx.font = `600 ${fs}px Fraunces, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = f.typed ? COL.emberDim(0.4) : COL.ink(Math.min(1, f.life * 0.5));
      ctx.fillText(f.char, 0, 1);

      ctx.restore();
    }

    // ── Draw cannon ──────────────────────────────────────
    function drawCannon(ctx: CanvasRenderingContext2D, s: typeof sizeRef.current, cannon: typeof cannonRef.current) {
      const sc = s.SC, px = cannon.x, py = cannon.y;

      // Shadow
      const sh = ctx.createRadialGradient(px, py + 16 * sc, 0, px, py + 16 * sc, 60 * sc);
      sh.addColorStop(0, ok(0.22, 0.030, 264, 0.32));
      sh.addColorStop(1, ok(0.22, 0.030, 264, 0));
      ctx.save(); ctx.translate(px, py + 16 * sc); ctx.scale(1, 0.28);
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, 60 * sc, 0, 7); ctx.fill(); ctx.restore();

      // Left wheel
      drawWheel(ctx, px - 21 * sc, py + 13 * sc, 12 * sc, 0.55);

      // Carriage body
      ctx.save(); ctx.translate(px, py);
      const wood = ctx.createLinearGradient(0, -10 * sc, 0, 18 * sc);
      wood.addColorStop(0, COL.woodLit()); wood.addColorStop(0.45, COL.wood()); wood.addColorStop(1, ok(0.29, 0.048, 48));
      ctx.fillStyle = wood;
      ctx.beginPath();
      ctx.moveTo(-38 * sc, 5 * sc); ctx.lineTo(13 * sc, -5 * sc); ctx.lineTo(20 * sc, 3 * sc);
      ctx.lineTo(17 * sc, 15 * sc); ctx.lineTo(-43 * sc, 17 * sc); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = ok(0.25, 0.042, 48, 0.8); ctx.lineWidth = 1.1 * sc; ctx.stroke();
      ctx.fillStyle = COL.brass(0.85);
      ctx.fillRect(-3 * sc, -3 * sc, 4 * sc, 16 * sc);
      ctx.fillRect(-28 * sc, 7 * sc, 3.5 * sc, 9 * sc);
      ctx.restore();

      // Barrel
      ctx.save();
      ctx.translate(px, py - 6 * sc);
      ctx.rotate(cannon.aim);
      ctx.translate(-cannon.recoil * 12 * sc, 0);
      const r1 = 12 * sc, r2 = 8.6 * sc, L = BARREL * sc;
      ctx.beginPath();
      ctx.moveTo(-21 * sc, -r1);
      ctx.bezierCurveTo(8 * sc, -r1 * 0.99, 28 * sc, -r2 * 1.08, L - 8 * sc, -r2);
      ctx.lineTo(L - 8 * sc, -r2 * 1.3); ctx.lineTo(L, -r2 * 1.3);
      ctx.lineTo(L, r2 * 1.3); ctx.lineTo(L - 8 * sc, r2 * 1.3); ctx.lineTo(L - 8 * sc, r2);
      ctx.bezierCurveTo(28 * sc, r2 * 1.08, 8 * sc, r1 * 0.99, -21 * sc, r1);
      ctx.arc(-21 * sc, 0, r1, Math.PI / 2, -Math.PI / 2, false);
      ctx.closePath();
      const metal = ctx.createLinearGradient(0, -r1, 0, r1);
      metal.addColorStop(0, ok(0.19, 0.018, 264)); metal.addColorStop(0.20, COL.iron());
      metal.addColorStop(0.36, COL.ironLit()); metal.addColorStop(0.54, COL.iron());
      metal.addColorStop(0.82, ok(0.22, 0.020, 264)); metal.addColorStop(1, ok(0.15, 0.016, 264));
      ctx.fillStyle = metal; ctx.fill();
      ctx.strokeStyle = ok(0.13, 0.016, 264, 0.85); ctx.lineWidth = 1 * sc; ctx.stroke();
      // Brass bands
      [[-5, 4.5], [24, 3.6]].forEach(([bx, bwid]) => {
        const g2 = ctx.createLinearGradient(0, -r1, 0, r1);
        g2.addColorStop(0, ok(0.26, 0.032, 72)); g2.addColorStop(0.36, COL.brass(1)); g2.addColorStop(1, ok(0.22, 0.030, 66));
        ctx.fillStyle = g2; ctx.fillRect(bx * sc, -r1 * 1.04, bwid * sc, r1 * 2.08);
      });
      // Specular highlight
      const spec = ctx.createLinearGradient(-16 * sc, 0, L, 0);
      spec.addColorStop(0, COL.ironLit(0)); spec.addColorStop(0.35, COL.ironLit(0.5)); spec.addColorStop(1, COL.ironLit(0));
      ctx.fillStyle = spec; ctx.fillRect(-13 * sc, -r1 * 0.5, L, 1.8 * sc);
      // Muzzle
      ctx.fillStyle = ok(0.11, 0.014, 264);
      ctx.beginPath(); ctx.ellipse(L - 1 * sc, 0, 2.2 * sc, r2 * 0.95, 0, 0, 7); ctx.fill();
      // Rear knob
      const kn = ctx.createRadialGradient(-28 * sc, -2 * sc, 0, -26 * sc, 0, 7 * sc);
      kn.addColorStop(0, COL.ironLit(0.9)); kn.addColorStop(1, COL.ironDark());
      ctx.fillStyle = kn; ctx.beginPath(); ctx.arc(-26 * sc, 0, 5.2 * sc, 0, 7); ctx.fill();
      ctx.restore();

      // Right wheel
      drawWheel(ctx, px + 5 * sc, py + 15 * sc, 17 * sc, 1);
    }

    function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lit: number) {
      ctx.save(); ctx.translate(x, y);
      const rim = ctx.createLinearGradient(-r, -r, r, r);
      rim.addColorStop(0, ok(0.32 + 0.14 * lit, 0.055, 52)); rim.addColorStop(0.5, ok(0.46 + 0.10 * lit, 0.062, 58)); rim.addColorStop(1, ok(0.26, 0.042, 48));
      ctx.strokeStyle = rim; ctx.lineWidth = r * 0.24;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, 7); ctx.stroke();
      ctx.strokeStyle = ok(0.36, 0.036, 58, 0.85 * lit + 0.2); ctx.lineWidth = Math.max(1, r * 0.07);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15);
        ctx.lineTo(Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74); ctx.stroke();
      }
      const hub = ctx.createRadialGradient(-r * 0.06, -r * 0.08, 0, 0, 0, r * 0.22);
      hub.addColorStop(0, COL.brass(1)); hub.addColorStop(1, ok(0.30, 0.042, 58));
      ctx.fillStyle = hub; ctx.beginPath(); ctx.arc(0, 0, r * 0.19, 0, 7); ctx.fill();
      ctx.restore();
    }

    // ── Draw projectiles ─────────────────────────────────
    function drawBalls(ctx: CanvasRenderingContext2D, fx: GameFx, s: typeof sizeRef.current) {
      for (const b of fx.balls) {
        // Trail
        b.trail.forEach((p, i) => {
          ctx.fillStyle = ok(0.36, 0.020, 264, (i + 1) / b.trail.length * 0.16);
          ctx.beginPath(); ctx.arc(p.x, p.y, b.r * (0.35 + i / b.trail.length * 0.6), 0, 7); ctx.fill();
        });
        // Ball
        const g = ctx.createRadialGradient(b.x - b.r * 0.38, b.y - b.r * 0.44, b.r * 0.06, b.x, b.y, b.r * 1.1);
        g.addColorStop(0, ok(0.76, 0.014, 252)); g.addColorStop(0.28, COL.iron());
        g.addColorStop(0.75, ok(0.21, 0.020, 264)); g.addColorStop(1, ok(0.14, 0.016, 264));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
        if (b.kill) {
          const h = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.4);
          h.addColorStop(0, COL.emberHot(0.26)); h.addColorStop(1, COL.emberHot(0));
          ctx.fillStyle = h; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.4, 0, 7); ctx.fill();
        }
      }
    }

    // ── Draw particles ───────────────────────────────────
    function drawFxParticles(ctx: CanvasRenderingContext2D, fx: GameFx, s: typeof sizeRef.current) {
      // Smoke
      for (const sm of fx.smoke) {
        const a = Math.max(0, sm.life / sm.dur) * 0.45;
        const g = ctx.createRadialGradient(sm.x, sm.y, 0, sm.x, sm.y, sm.r);
        g.addColorStop(0, COL.smoke(a)); g.addColorStop(0.6, COL.smoke(a * 0.42)); g.addColorStop(1, COL.smoke(0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sm.x, sm.y, sm.r, 0, 7); ctx.fill();
      }
      // Muzzle flashes
      for (const f of fx.flashes) {
        const k = f.life / f.dur, r = 28 * s.SC * f.s * (1.2 - k * 0.45);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        g.addColorStop(0, ok(0.99, 0.055, 90, 0.92 * k)); g.addColorStop(0.35, COL.emberHot(0.65 * k)); g.addColorStop(1, COL.ember(0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
        ctx.fillStyle = ok(0.99, 0.050, 88, 0.7 * k);
        ctx.beginPath(); ctx.moveTo(0, -5 * s.SC * f.s); ctx.quadraticCurveTo(26 * s.SC * f.s, 0, 0, 5 * s.SC * f.s);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      // Sparks
      for (const sp of fx.sparks) {
        const a = Math.max(0, sp.life / sp.dur);
        ctx.strokeStyle = sp.hot ? COL.emberHot(a) : COL.ember(a);
        ctx.lineWidth = 1.5 * s.SC;
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.x - sp.vx * 0.012, sp.y - sp.vy * 0.012); ctx.stroke();
      }
      // Chips
      for (const c of fx.chips) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
        ctx.globalAlpha = Math.min(1, c.life / 0.4); ctx.fillStyle = c.col;
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * (0.4 + 0.6 * Math.abs(Math.cos(c.rot))));
        ctx.restore(); ctx.globalAlpha = 1;
      }
      // Score pops
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.round(15 * s.SC)}px "IBM Plex Mono", monospace`;
      for (const p of fx.pops) {
        ctx.globalAlpha = Math.min(1, p.life / p.dur * 1.6);
        ctx.fillStyle = COL.emberDim(1); ctx.fillText(p.txt, p.x, p.y);
      }
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }

    // ── Helpers ──────────────────────────────────────────
    function smooth(a: number, b: number, v: number) {
      const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
      return t * t * (3 - 2 * t);
    }

    function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }
    }

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'manipulation' }}
      />
    );
  }
);

PaperFallCanvas.displayName = 'PaperFallCanvas';
export default PaperFallCanvas;
