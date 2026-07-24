import { SlitherSkin } from '@/store/useSlitherStore';
import { slitherAudio } from './SlitherAudio';

export interface ClientSnakeSegment {
  x: number;
  y: number;
}

export interface ClientSnake {
  id: string;
  nickname: string;
  skin: SlitherSkin;
  isBot: boolean;
  score: number;
  isAlive: boolean;
  angle: number;
  isBoosting: boolean;
  segments: ClientSnakeSegment[];
  width: number;
  // Visual animation & pupil
  eyeBlinkTimer?: number;
  isBlinking?: boolean;
  // Interpolation targets
  targetAngle?: number;
  targetSegments?: ClientSnakeSegment[];
}

export interface ClientFood {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  value: number;
  pulseOffset: number;
  // Magnetic attraction animation
  attractedTo?: string;
  attractionProgress?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface ServerSnapshotSnake {
  id: string;
  nickname: string;
  skin: SlitherSkin;
  isBot: boolean;
  score: number;
  isAlive: boolean;
  angle: number;
  isBoosting: boolean;
  segments: ClientSnakeSegment[];
  width: number;
}

export interface ServerSnapshot {
  timestamp: number;
  snakes: Map<string, ServerSnapshotSnake>;
}

export interface SlitherEngineCallbacks {
  onScoreUpdate: (score: number) => void;
  onKillsUpdate: (kills: number) => void;
  onGameOver: (score: number, kills: number, timePlayed: number) => void;
}

// Spatial Hash Grid for fast O(1) proximity queries
class SpatialHashGrid<T extends { x: number; y: number }> {
  private cellSize: number;
  private grid: Map<string, T[]> = new Map();

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  public clear() {
    this.grid.clear();
  }

  private getKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx}:${cy}`;
  }

  public insert(item: T) {
    const key = this.getKey(item.x, item.y);
    let cell = this.grid.get(key);
    if (!cell) {
      cell = [];
      this.grid.set(key, cell);
    }
    cell.push(item);
  }

  public query(x: number, y: number, radius: number): T[] {
    const results: T[] = [];
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.grid.get(`${cx}:${cy}`);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }
}

export class SlitherClientEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mode: 'SINGLEPLAYER' | 'MULTIPLAYER' | 'LAN';
  private callbacks: SlitherEngineCallbacks;

  // Game state
  public myUserId: string;
  public nickname: string;
  public skin: SlitherSkin;

  // Physics parameters
  public worldRadius = 3000;
  private baseSpeed = 3.6;
  private boostSpeed = 7.0;
  private turnSpeed = 0.085;

  // Entities
  public snakes: Map<string, ClientSnake> = new Map();
  public foods: ClientFood[] = [];
  private foodsMap: Map<string, ClientFood> = new Map();
  private foodGrid: SpatialHashGrid<ClientFood> = new SpatialHashGrid(120);

  // Particles & Pooling
  private particlePool: Particle[] = [];
  private activeParticles: Particle[] = [];

  // Camera
  private cameraX = 0;
  private cameraY = 0;
  private cameraZoom = 1.0;
  private targetZoom = 1.0;

  // Inputs
  private mouseX = 0;
  private mouseY = 0;
  private targetAngle = 0;
  private isBoosting = false;
  private keysPressed: Set<string> = new Set();
  private botSpawnCooldown = 0;

  // Performance & Debug Overlay Tracking
  public fps = 60;
  private frameCount = 0;
  private lastFpsTime = Date.now();
  public showDebugOverlay = false;
  public ping = 0;
  public jitter = 0;
  private lastPingCheckTime = 0;

  // Multiplayer Snapshot Buffer & Client-Side Prediction
  private snapshotBuffer: ServerSnapshot[] = [];
  private interpolationDelay = 65; // 65ms snapshot delay buffer
  private predictionErrorX = 0;
  private predictionErrorY = 0;
  private lastProcessedSnapshotTime = 0;
  private serverLeaderboard: { nickname: string; score: number }[] = [];

  // Stats
  private killsCount = 0;
  private startTime = 0;
  private isRunning = false;
  private animationFrameId: number | null = null;

  // Pre-rendered offscreen caches
  private foodSpriteCache: Map<string, HTMLCanvasElement> = new Map();
  private backgroundPatternCanvas: HTMLCanvasElement | null = null;

  // Multiplayer
  private socket: any = null;
  private gameId: string | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    mode: 'SINGLEPLAYER' | 'MULTIPLAYER' | 'LAN',
    userId: string,
    nickname: string,
    skin: SlitherSkin,
    callbacks: SlitherEngineCallbacks,
    socket?: any,
    gameId?: string | null
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.mode = mode;
    this.myUserId = userId;
    this.nickname = nickname;
    this.skin = skin;
    this.callbacks = callbacks;
    this.socket = socket;
    this.gameId = gameId || null;

    this.initParticlePool(300);
    this.initPreRenderedCaches();
    this.resizeCanvas();
    this.setupInput();
  }

  private initParticlePool(size: number) {
    for (let i = 0; i < size; i++) {
      this.particlePool.push({
        x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '#fff', alpha: 1, life: 0, maxLife: 1, active: false
      });
    }
  }

  private spawnParticle(x: number, y: number, color: string, speed: number = 3, size: number = 4) {
    let p = this.particlePool.pop();
    if (!p) {
      p = { x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '#fff', alpha: 1, life: 0, maxLife: 1, active: false };
    }
    const angle = Math.random() * Math.PI * 2;
    const spd = (0.3 + Math.random() * 0.7) * speed;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * spd;
    p.vy = Math.sin(angle) * spd;
    p.size = size * (0.6 + Math.random() * 0.8);
    p.color = color;
    p.alpha = 1.0;
    p.life = 0;
    p.maxLife = 20 + Math.random() * 25;
    p.active = true;
    this.activeParticles.push(p);
  }

  private updateParticles() {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.alpha = 1 - (p.life / p.maxLife);

      if (p.life >= p.maxLife || p.alpha <= 0) {
        p.active = false;
        this.activeParticles.splice(i, 1);
        this.particlePool.push(p);
      }
    }
  }

  private initPreRenderedCaches() {
    const colors = ['#FF0055', '#00FF66', '#0066FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FF9900'];
    const sizes = [4, 6, 8, 10, 14];

    colors.forEach((color) => {
      sizes.forEach((size) => {
        const offCanvas = document.createElement('canvas');
        const padding = size * 3.5;
        offCanvas.width = padding * 2;
        offCanvas.height = padding * 2;
        const offCtx = offCanvas.getContext('2d')!;

        const center = padding;
        const outerGrad = offCtx.createRadialGradient(center, center, 0, center, center, size * 2.8);
        outerGrad.addColorStop(0, color);
        outerGrad.addColorStop(0.35, color);
        outerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        offCtx.fillStyle = outerGrad;
        offCtx.beginPath();
        offCtx.arc(center, center, size * 2.8, 0, Math.PI * 2);
        offCtx.fill();

        offCtx.fillStyle = '#ffffff';
        offCtx.beginPath();
        offCtx.arc(center, center, size * 0.45, 0, Math.PI * 2);
        offCtx.fill();

        this.foodSpriteCache.set(`${color}_${size}`, offCanvas);
      });
    });

    const hexRadius = 45;
    const w = hexRadius * 1.5;
    const h = hexRadius * Math.sqrt(3);
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = Math.ceil(w * 2);
    tileCanvas.height = Math.ceil(h * 2);
    const tCtx = tileCanvas.getContext('2d')!;

    tCtx.fillStyle = '#0a0d14';
    tCtx.fillRect(0, 0, tileCanvas.width, tileCanvas.height);
    tCtx.strokeStyle = '#151b28';
    tCtx.lineWidth = 2;

    const drawHex = (cx: number, cy: number) => {
      tCtx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = cx + Math.cos(angle) * hexRadius;
        const y = cy + Math.sin(angle) * hexRadius;
        if (i === 0) tCtx.moveTo(x, y);
        else tCtx.lineTo(x, y);
      }
      tCtx.closePath();
      tCtx.stroke();
    };

    drawHex(w * 0.5, h * 0.5);
    drawHex(w * 2.0, h * 0.5);
    drawHex(w * 1.25, h * 1.366);

    this.backgroundPatternCanvas = tileCanvas;
  }

  public start() {
    this.isRunning = true;
    this.startTime = Date.now();
    this.killsCount = 0;

    if (this.mode === 'SINGLEPLAYER') {
      this.initSinglePlayer();
    } else {
      this.setupMultiplayer();
    }

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.cleanupInput();
    slitherAudio.stopBoostSound();

    if (this.mode !== 'SINGLEPLAYER' && this.socket) {
      this.socket.off('game_state');
      this.socket.off('player_died');
    }
  }

  private resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      this.canvas.width = rect.width || parent.clientWidth || window.innerWidth;
      this.canvas.height = rect.height || parent.clientHeight || window.innerHeight;
    } else {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  private setupInput() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('touchmove', this.handleTouchMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('contextmenu', this.handleContextMenu);
  }

  private cleanupInput() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private handleResize = () => {
    this.resizeCanvas();
  };

  private handleMouseMove = (e: MouseEvent) => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    let hasMovementKeys = false;
    ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach((k) => {
      if (this.keysPressed.has(k)) hasMovementKeys = true;
    });
    if (!hasMovementKeys) {
      this.updateTargetAngle();
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      this.mouseX = e.touches[0].clientX;
      this.mouseY = e.touches[0].clientY;
      this.updateTargetAngle();
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      this.setBoostingState(true);
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      this.setBoostingState(false);
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'F3') {
      this.showDebugOverlay = !this.showDebugOverlay;
    }
    if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      this.keysPressed.add(e.code);
      this.updateTargetAngleFromKeys();
    }
    if (e.code === 'Space') {
      this.setBoostingState(true);
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      this.keysPressed.delete(e.code);
      this.updateTargetAngleFromKeys();
    }
    if (e.code === 'Space') {
      this.setBoostingState(false);
    }
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private setBoostingState(boosting: boolean) {
    if (this.isBoosting === boosting) return;
    this.isBoosting = boosting;
    if (boosting) {
      slitherAudio.startBoostSound();
    } else {
      slitherAudio.stopBoostSound();
    }
    this.sendBoostState(boosting);
  }

  private updateTargetAngleFromKeys() {
    let dx = 0;
    let dy = 0;
    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) dy -= 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) dy += 1;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) dx -= 1;
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) dx += 1;

    if (dx !== 0 || dy !== 0) {
      this.targetAngle = Math.atan2(dy, dx);
      this.sendAngle();
    }
  }

  private updateTargetAngle() {
    const dx = this.mouseX - this.canvas.width / 2;
    const dy = this.mouseY - this.canvas.height / 2;
    this.targetAngle = Math.atan2(dy, dx);
    this.sendAngle();
  }

  private sendAngle() {
    if (this.mode !== 'SINGLEPLAYER' && this.socket && this.gameId) {
      this.socket.emit('game_action', {
        gameId: this.gameId,
        userId: this.myUserId,
        action: 'angle_update',
        data: { angle: this.targetAngle }
      });
    }
  }

  private sendBoostState(boosting: boolean) {
    if (this.mode !== 'SINGLEPLAYER' && this.socket && this.gameId) {
      this.socket.emit('game_action', {
        gameId: this.gameId,
        userId: this.myUserId,
        action: 'boost_update',
        data: { isBoosting: boosting }
      });
    }
  }

  // ==========================================
  // SINGLE PLAYER SIMULATION (100% UNTOUCHED)
  // ==========================================
  private initSinglePlayer() {
    this.snakes.set(this.myUserId, this.createLocalSnake(this.myUserId, this.nickname, this.skin, false, 0, 0));

    for (let i = 0; i < 49; i++) {
      this.spawnBotSafely(i);
    }

    for (let i = 0; i < 1000; i++) {
      this.spawnRandomFood();
    }
  }

  private spawnBotSafely(index?: number) {
    const idx = index !== undefined ? index : this.snakes.size;
    const id = `bot_${idx}_${Math.random().toString(36).substring(2, 7)}`;
    let bx = 0;
    let by = 0;

    const player = this.snakes.get(this.myUserId);
    const playerHead = player ? player.segments[0] : { x: 0, y: 0 };

    let attempts = 0;
    while (attempts < 15) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 350 + Math.random() * (this.worldRadius - 650);
      bx = Math.cos(angle) * dist;
      by = Math.sin(angle) * dist;

      const dx = bx - playerHead.x;
      const dy = by - playerHead.y;
      if (dx * dx + dy * dy >= 800 * 800) break;
      attempts++;
    }

    const skins: SlitherSkin[] = ['CLASSIC', 'RED', 'BLUE', 'YELLOW', 'RAINBOW', 'GLOW'];
    const skin = skins[Math.floor(Math.random() * skins.length)];
    const botNames = ['Slinky', 'Anaconda', 'Viper', 'Boa', 'Mamba', 'Cobrette', 'Python', 'Kaa', 'Basilisk', 'Garter', 'Sidewinder', 'Serpent', 'Naga', 'Wiggle'];
    const name = botNames[Math.floor(Math.random() * botNames.length)] + ` [Bot]`;

    this.snakes.set(id, this.createLocalSnake(id, name, skin, true, bx, by));
  }

  private createLocalSnake(
    id: string,
    name: string,
    skin: SlitherSkin,
    isBot: boolean,
    x: number,
    y: number
  ): ClientSnake {
    const segments: ClientSnakeSegment[] = [];
    const length = isBot ? 18 + Math.floor(Math.random() * 40) : 18;
    const startAngle = Math.random() * Math.PI * 2;
    const spacing = 6.5;

    for (let i = 0; i < length; i++) {
      segments.push({
        x: x - Math.cos(startAngle) * (i * spacing),
        y: y - Math.sin(startAngle) * (i * spacing)
      });
    }

    return {
      id,
      nickname: name,
      skin,
      isBot,
      score: length,
      isAlive: true,
      angle: startAngle,
      isBoosting: false,
      segments,
      width: 20 + Math.min(45, Math.pow(length, 0.35) * 3)
    };
  }

  private spawnRandomFood() {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.worldRadius;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const colors = ['#FF0055', '#00FF66', '#0066FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FF9900'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const sizes = [4, 6, 8, 10, 14];
    const val = 1 + Math.floor(Math.random() * 4);
    const size = sizes[Math.min(sizes.length - 1, val - 1)];

    const food: ClientFood = {
      id: `food_${Math.random().toString(36).substring(2, 9)}`,
      x,
      y,
      size,
      color,
      value: val,
      pulseOffset: Math.random() * Math.PI * 2
    };
    this.foods.push(food);
  }

  private updateSinglePlayer() {
    while (this.foods.length < 800) {
      this.spawnRandomFood();
    }

    this.foodGrid.clear();
    for (let i = 0; i < this.foods.length; i++) {
      this.foodGrid.insert(this.foods[i]);
    }

    if (this.snakes.size < 50) {
      this.botSpawnCooldown++;
      if (this.botSpawnCooldown >= 60) {
        this.botSpawnCooldown = 0;
        this.spawnBotSafely();
      }
    }

    const player = this.snakes.get(this.myUserId);
    if (player && player.isAlive) {
      player.isBoosting = this.isBoosting && player.segments.length > 10;

      let diff = this.targetAngle - player.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      player.angle += diff * this.turnSpeed;

      this.moveSnakePhysics(player);
      this.checkFoodCollision(player);

      this.cameraX += (player.segments[0].x - this.cameraX) * 0.12;
      this.cameraY += (player.segments[0].y - this.cameraY) * 0.12;

      this.targetZoom = 1.0 - Math.min(0.55, (player.segments.length - 15) * 0.0018);
      this.cameraZoom += (this.targetZoom - this.cameraZoom) * 0.05;

      this.callbacks.onScoreUpdate(Math.floor(player.score * 10));
    }

    for (const [id, snake] of this.snakes.entries()) {
      if (id === this.myUserId || !snake.isAlive) continue;

      this.updateBotAI(snake);
      this.moveSnakePhysics(snake);
      this.checkFoodCollision(snake);
    }

    for (const [idA, snakeA] of this.snakes.entries()) {
      if (!snakeA.isAlive) continue;
      const headA = snakeA.segments[0];

      const distFromCenter = Math.sqrt(headA.x * headA.x + headA.y * headA.y);
      if (distFromCenter + snakeA.width * 0.4 >= this.worldRadius) {
        this.killSnake(snakeA);
        continue;
      }

      for (const [idB, snakeB] of this.snakes.entries()) {
        if (!snakeB.isAlive || idA === idB) continue;

        const collisionDist = (snakeA.width + snakeB.width) * 0.42;
        const headRadSq = collisionDist * collisionDist;

        for (let s = 0; s < snakeB.segments.length; s++) {
          const segB = snakeB.segments[s];
          const dx = headA.x - segB.x;
          const dy = headA.y - segB.y;
          if (dx * dx + dy * dy < headRadSq) {
            this.killSnake(snakeA);
            if (idB === this.myUserId && snakeA.isBot) {
              this.killsCount++;
              this.callbacks.onKillsUpdate(this.killsCount);
            }
            break;
          }
        }
      }
    }
  }

  private moveSnakePhysics(snake: ClientSnake) {
    const speed = snake.isBoosting ? this.boostSpeed : this.baseSpeed;
    const head = snake.segments[0];

    const nextHeadX = head.x + Math.cos(snake.angle) * speed;
    const nextHeadY = head.y + Math.sin(snake.angle) * speed;

    snake.segments.unshift({ x: nextHeadX, y: nextHeadY });

    if (snake.isBoosting) {
      if (Math.random() < 0.3) {
        const tail = snake.segments[snake.segments.length - 1];
        this.spawnParticle(tail.x, tail.y, this.getSkinColor(snake.skin), 2, 5);
      }

      if (Math.random() < 0.18 && snake.segments.length > 12) {
        const lastSeg = snake.segments.pop()!;
        this.foods.push({
          id: `food_${Math.random().toString(36).substring(2, 9)}`,
          x: lastSeg.x + (Math.random() * 16 - 8),
          y: lastSeg.y + (Math.random() * 16 - 8),
          size: 8,
          color: '#00FFFF',
          value: 3,
          pulseOffset: Math.random() * Math.PI * 2
        });
        snake.score = snake.segments.length;
      }
    }

    const targetLength = snake.score;
    while (snake.segments.length > targetLength) {
      snake.segments.pop();
    }

    const spacing = 6.0 + Math.min(6.0, snake.width * 0.08);
    for (let i = 1; i < snake.segments.length; i++) {
      const prev = snake.segments[i - 1];
      const curr = snake.segments[i];
      const dx = prev.x - curr.x;
      const dy = prev.y - curr.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > spacing) {
        const ratio = spacing / dist;
        curr.x = prev.x - dx * ratio;
        curr.y = prev.y - dy * ratio;
      }
    }

    snake.width = 20 + Math.min(45, Math.pow(snake.segments.length, 0.35) * 3);
  }

  private checkFoodCollision(snake: ClientSnake) {
    const head = snake.segments[0];
    const headRad = snake.width / 2;

    const nearbyFoods = this.foodGrid.query(head.x, head.y, headRad + 70);

    for (let i = 0; i < nearbyFoods.length; i++) {
      const food = nearbyFoods[i];
      const dx = head.x - food.x;
      const dy = head.y - food.y;
      const distSq = dx * dx + dy * dy;

      const attractDist = headRad + 55;
      if (distSq < attractDist * attractDist) {
        food.x += (head.x - food.x) * 0.28;
        food.y += (head.y - food.y) * 0.28;
      }

      const eatDist = headRad + food.size * 0.6;
      if (distSq < eatDist * eatDist) {
        snake.score += food.value * 0.18;

        if (snake.id === this.myUserId) {
          slitherAudio.playFoodSound(food.value);
        }

        this.spawnParticle(food.x, food.y, food.color, 4, 3);

        const index = this.foods.indexOf(food);
        if (index !== -1) {
          this.foods.splice(index, 1);
        }
      }
    }
  }

  private killSnake(snake: ClientSnake) {
    snake.isAlive = false;

    if (snake.id === this.myUserId) {
      slitherAudio.playDeathSound();
      slitherAudio.stopBoostSound();
    }

    for (let i = 0; i < snake.segments.length; i += 2) {
      const seg = snake.segments[i];
      const colors = ['#FF0055', '#00FF66', '#0066FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FF9900'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const sizes = [6, 8, 10, 14];

      this.spawnParticle(seg.x, seg.y, color, 5, 8);

      this.foods.push({
        id: `food_${Math.random().toString(36).substring(2, 9)}`,
        x: seg.x + (Math.random() * 30 - 15),
        y: seg.y + (Math.random() * 30 - 15),
        size: sizes[Math.floor(Math.random() * sizes.length)],
        color,
        value: 2 + Math.floor(Math.random() * 3),
        pulseOffset: Math.random() * Math.PI * 2
      });
    }

    if (snake.id === this.myUserId) {
      this.isRunning = false;
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      this.callbacks.onGameOver(Math.floor(snake.score * 10), this.killsCount, duration);
    } else {
      setTimeout(() => {
        if (!this.isRunning) return;
        this.spawnBotSafely();
      }, 3000);

      this.snakes.delete(snake.id);
    }
  }

  private updateBotAI(bot: ClientSnake) {
    const head = bot.segments[0];

    const dist = Math.sqrt(head.x * head.x + head.y * head.y);
    if (dist > this.worldRadius - 250) {
      const angleToCenter = Math.atan2(-head.y, -head.x);
      bot.angle += (angleToCenter - bot.angle) * 0.2;
      return;
    }

    let isAvoiding = false;
    const detectRadius = bot.width * 2.8 + 45;
    const detectRadSq = detectRadius * detectRadius;

    for (const [otherId, other] of this.snakes.entries()) {
      if (!other.isAlive) continue;

      for (let s = 0; s < other.segments.length; s += 2) {
        if (otherId === bot.id && s < 5) continue;
        const seg = other.segments[s];
        const dx = head.x - seg.x;
        const dy = head.y - seg.y;

        if (dx * dx + dy * dy < detectRadSq) {
          isAvoiding = true;
          const steerAngle = Math.atan2(dy, dx);
          bot.angle += (steerAngle - bot.angle) * 0.2;

          if (Math.random() < 0.08 && bot.segments.length > 15) {
            bot.isBoosting = true;
            setTimeout(() => { bot.isBoosting = false; }, 600);
          }
          break;
        }
      }
      if (isAvoiding) break;
    }

    if (isAvoiding) return;

    const nearbyFoods = this.foodGrid.query(head.x, head.y, 350);
    let nearestFood: ClientFood | null = null;
    let nearestDistSq = Infinity;

    for (let i = 0; i < nearbyFoods.length; i++) {
      const food = nearbyFoods[i];
      const dx = food.x - head.x;
      const dy = food.y - head.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < nearestDistSq) {
        nearestFood = food;
        nearestDistSq = dSq;
      }
    }

    if (nearestFood) {
      const foodAngle = Math.atan2(nearestFood.y - head.y, nearestFood.x - head.x);
      let diff = foodAngle - bot.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      bot.angle += diff * 0.09;
    } else {
      if (Math.random() < 0.04) {
        bot.angle += (Math.random() - 0.5) * 1.2;
      }
    }
  }

  // ============================================================
  // MULTIPLAYER SYNCHRONIZATION PIPELINE (FULLY ISOLATED FIX)
  // ============================================================
  private setupMultiplayer() {
    if (!this.socket) return;

    // Immediately notify server of lobby join & spawn request
    const gId = this.gameId || 'slither_global';
    this.socket.emit('lobby_join', { gameId: gId, userId: this.myUserId, nickname: this.nickname });
    this.socket.emit('game_action', { gameId: gId, userId: this.myUserId, action: 'respawn', data: { nickname: this.nickname, skin: this.skin } });

    this.socket.on('game_state', (state: any) => {
      const now = Date.now();

      // Calculate ping & jitter
      if (this.lastPingCheckTime > 0) {
        const samplePing = now - this.lastPingCheckTime;
        this.jitter = Math.abs(samplePing - this.ping);
        this.ping = Math.round(samplePing);
      }
      this.lastPingCheckTime = now;

      if (state.worldRadius) this.worldRadius = state.worldRadius;

      if (Array.isArray(state.leaderboard)) {
        this.serverLeaderboard = state.leaderboard.map((entry: any) => ({
          nickname: entry.nickname,
          score: entry.score
        }));
      }

      // 1. Non-destructive Food Map Update (preserves floating pulse animation)
      if (Array.isArray(state.foods)) {
        const receivedFoodIds = new Set<string>();

        state.foods.forEach((f: any) => {
          receivedFoodIds.add(f.id);
          const existing = this.foodsMap.get(f.id);
          if (existing) {
            existing.x += (f.x - existing.x) * 0.4;
            existing.y += (f.y - existing.y) * 0.4;
            existing.size = f.size || existing.size;
            existing.color = f.color || existing.color;
            existing.value = f.value || existing.value;
          } else {
            this.foodsMap.set(f.id, {
              id: f.id,
              x: f.x,
              y: f.y,
              size: f.size || 6,
              color: f.color || '#00FF66',
              value: f.value || 1,
              pulseOffset: Math.random() * Math.PI * 2
            });
          }
        });

        for (const [id] of this.foodsMap.entries()) {
          if (!receivedFoodIds.has(id)) {
            this.foodsMap.delete(id);
          }
        }

        this.foods = Array.from(this.foodsMap.values());
      }

      // 2. Push snapshot into Snapshot Interpolation Buffer
      if (Array.isArray(state.snakes)) {
        const snapshotSnakes = new Map<string, ServerSnapshotSnake>();

        state.snakes.forEach((s: any) => {
          snapshotSnakes.set(s.id, {
            id: s.id,
            nickname: s.nickname,
            skin: s.skin,
            isBot: s.isBot,
            score: s.score,
            isAlive: s.isAlive,
            angle: s.angle,
            isBoosting: s.isBoosting,
            segments: s.segments,
            width: 20 + Math.min(45, Math.pow(s.score, 0.35) * 3)
          });
        });

        this.snapshotBuffer.push({
          timestamp: now,
          snakes: snapshotSnakes
        });

        // Prune old snapshots (keep last 12 snapshots ~ 400ms buffer)
        while (this.snapshotBuffer.length > 12) {
          this.snapshotBuffer.shift();
        }

        // Soft reconciliation & instantiation check for local player
        const mySnapshot = snapshotSnakes.get(this.myUserId);
        if (mySnapshot && mySnapshot.isAlive) {
          let myLocalSnake = this.snakes.get(this.myUserId);
          if (!myLocalSnake) {
            // First time spawning local player in multiplayer mode!
            myLocalSnake = {
              id: mySnapshot.id,
              nickname: mySnapshot.nickname,
              skin: mySnapshot.skin,
              isBot: false,
              score: mySnapshot.score,
              isAlive: true,
              angle: mySnapshot.angle,
              isBoosting: mySnapshot.isBoosting,
              segments: mySnapshot.segments.map((seg: any) => ({ x: seg.x, y: seg.y })),
              width: mySnapshot.width
            };
            this.snakes.set(this.myUserId, myLocalSnake);
            if (myLocalSnake.segments.length > 0) {
              this.cameraX = myLocalSnake.segments[0].x;
              this.cameraY = myLocalSnake.segments[0].y;
            }
          } else {
            myLocalSnake.score = mySnapshot.score;
            myLocalSnake.isAlive = mySnapshot.isAlive;
            myLocalSnake.width = mySnapshot.width;

            if (mySnapshot.segments.length > 0 && myLocalSnake.segments.length > 0) {
              const sHead = mySnapshot.segments[0];
              const lHead = myLocalSnake.segments[0];
              const errX = sHead.x - lHead.x;
              const errY = sHead.y - lHead.y;
              if (errX * errX + errY * errY > 300 * 300) {
                myLocalSnake.segments = mySnapshot.segments.map((seg: any) => ({ x: seg.x, y: seg.y }));
                this.predictionErrorX = 0;
                this.predictionErrorY = 0;
              } else {
                this.predictionErrorX = errX;
                this.predictionErrorY = errY;
              }
            }
          }
        }
      }

      if (state.kills && state.kills[this.myUserId] !== undefined) {
        this.killsCount = state.kills[this.myUserId];
        this.callbacks.onKillsUpdate(this.killsCount);
      }
    });

    this.socket.on('player_died', (data: { userId: string; score: number; kills: number }) => {
      if (data.userId === this.myUserId) {
        this.isRunning = false;
        this.snakes.delete(this.myUserId);
        slitherAudio.playDeathSound();
        slitherAudio.stopBoostSound();
        const duration = Math.floor((Date.now() - this.startTime) / 1000);
        this.callbacks.onGameOver(Math.floor(data.score * 10), data.kills, duration);
      }
    });
  }

  private updateMultiplayerState() {
    // 1. Rebuild Spatial Hash Grid
    this.foodGrid.clear();
    for (let i = 0; i < this.foods.length; i++) {
      this.foodGrid.insert(this.foods[i]);
    }

    // 2. Client-Side Prediction for Local Player
    const myLocalSnake = this.snakes.get(this.myUserId);
    if (myLocalSnake && myLocalSnake.isAlive) {
      myLocalSnake.isBoosting = this.isBoosting && myLocalSnake.segments.length > 10;

      let diff = this.targetAngle - myLocalSnake.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      myLocalSnake.angle += diff * this.turnSpeed;

      // Soft position reconciliation error decay (blend error smoothly over time)
      if (Math.abs(this.predictionErrorX) > 0.1 || Math.abs(this.predictionErrorY) > 0.1) {
        const decay = 0.08;
        myLocalSnake.segments[0].x += this.predictionErrorX * decay;
        myLocalSnake.segments[0].y += this.predictionErrorY * decay;
        this.predictionErrorX *= (1 - decay);
        this.predictionErrorY *= (1 - decay);
      }

      this.moveSnakePhysics(myLocalSnake);
      this.checkFoodCollision(myLocalSnake);
      this.checkLocalMultiplayerCollision(myLocalSnake);

      // Frame-rate independent camera tracking
      this.cameraX += (myLocalSnake.segments[0].x - this.cameraX) * 0.12;
      this.cameraY += (myLocalSnake.segments[0].y - this.cameraY) * 0.12;

      this.targetZoom = 1.0 - Math.min(0.55, (myLocalSnake.segments.length - 15) * 0.0018);
      this.cameraZoom += (this.targetZoom - this.cameraZoom) * 0.05;

      this.callbacks.onScoreUpdate(Math.floor(myLocalSnake.score * 10));
    }

    // 3. Reconcile remote snakes with server snapshots (only when a NEW snapshot arrives)
    this.reconcileRemoteSnakesFromBuffer();

    // 4. Dead-reckon all remote snakes forward for smooth visual movement between snapshots
    for (const [id, snake] of this.snakes.entries()) {
      if (id === this.myUserId || !snake.isAlive) continue;
      this.extrapolateRemoteSnake(snake);
    }
  }

  private checkLocalMultiplayerCollision(snake: ClientSnake) {
    if (!snake.isAlive || snake.segments.length === 0) return;
    const head = snake.segments[0];

    // World boundary collision
    const distFromCenter = Math.sqrt(head.x * head.x + head.y * head.y);
    if (distFromCenter + snake.width * 0.4 >= this.worldRadius) {
      this.killSnake(snake);
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      this.callbacks.onGameOver(Math.floor(snake.score * 10), this.killsCount, duration);
      return;
    }

    // Head to body collision against all other snakes (bots & remote players)
    for (const [otherId, other] of this.snakes.entries()) {
      if (!other.isAlive || otherId === snake.id || other.segments.length === 0) continue;

      const collisionDist = (snake.width + other.width) * 0.42;
      const headRadSq = collisionDist * collisionDist;

      for (let s = 0; s < other.segments.length; s++) {
        const segB = other.segments[s];
        const dx = head.x - segB.x;
        const dy = head.y - segB.y;

        if (dx * dx + dy * dy < headRadSq) {
          this.killSnake(snake);
          const duration = Math.floor((Date.now() - this.startTime) / 1000);
          this.callbacks.onGameOver(Math.floor(snake.score * 10), this.killsCount, duration);
          return;
        }
      }
    }
  }

  /**
   * Lightweight physics extrapolation for remote snakes.
   * Moves head forward using current angle & speed, trims tail, enforces segment spacing.
   * Does NOT create food drops or modify score — those are server-authoritative.
   */
  private extrapolateRemoteSnake(snake: ClientSnake) {
    const speed = snake.isBoosting ? this.boostSpeed : this.baseSpeed;
    const head = snake.segments[0];

    let newX = head.x + Math.cos(snake.angle) * speed;
    let newY = head.y + Math.sin(snake.angle) * speed;

    // Clamp head position to boundary circle so extrapolation never steps outside worldRadius
    const distFromCenter = Math.sqrt(newX * newX + newY * newY);
    const maxRadius = Math.max(100, this.worldRadius - snake.width * 0.4);
    if (distFromCenter > maxRadius) {
      newX = (newX / distFromCenter) * maxRadius;
      newY = (newY / distFromCenter) * maxRadius;
    }

    snake.segments.unshift({
      x: newX,
      y: newY
    });

    // Boost trail particles (visual only — no food drops for remote snakes)
    if (snake.isBoosting && Math.random() < 0.3) {
      const tail = snake.segments[snake.segments.length - 1];
      this.spawnParticle(tail.x, tail.y, this.getSkinColor(snake.skin), 2, 5);
    }

    const targetLength = Math.floor(snake.score);
    while (snake.segments.length > targetLength) {
      snake.segments.pop();
    }

    const spacing = 6.0 + Math.min(6.0, snake.width * 0.08);
    for (let i = 1; i < snake.segments.length; i++) {
      const prev = snake.segments[i - 1];
      const curr = snake.segments[i];
      const dx = prev.x - curr.x;
      const dy = prev.y - curr.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > spacing) {
        const ratio = spacing / dist;
        curr.x = prev.x - dx * ratio;
        curr.y = prev.y - dy * ratio;
      }
    }

    snake.width = 20 + Math.min(45, Math.pow(snake.segments.length, 0.35) * 3);
  }

  /**
   * Processes ONLY newly arrived server snapshots.
   * Snaps remote snake segments to authoritative server positions and updates metadata.
   * Between snapshots, extrapolateRemoteSnake() provides smooth visual movement.
   */
  private reconcileRemoteSnakesFromBuffer() {
    if (this.snapshotBuffer.length === 0) return;

    const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
    if (!latest || latest.timestamp <= this.lastProcessedSnapshotTime) return;

    // Mark this snapshot as processed so we don't re-snap on next frame
    this.lastProcessedSnapshotTime = latest.timestamp;

    const activeRemoteIds = new Set<string>();

    latest.snakes.forEach((serverSnake, id) => {
      if (id === this.myUserId || !serverSnake.isAlive) return;

      activeRemoteIds.add(id);

      let clientSnake = this.snakes.get(id);
      if (!clientSnake) {
        // New remote snake — create from server snapshot
        clientSnake = {
          id: serverSnake.id,
          nickname: serverSnake.nickname,
          skin: serverSnake.skin,
          isBot: serverSnake.isBot,
          score: serverSnake.score,
          isAlive: serverSnake.isAlive,
          angle: serverSnake.angle,
          isBoosting: serverSnake.isBoosting,
          segments: serverSnake.segments.map((seg) => ({ x: seg.x, y: seg.y })),
          width: serverSnake.width
        };
        this.snakes.set(id, clientSnake);
      } else {
        // Existing remote snake — snap to authoritative server state
        clientSnake.nickname = serverSnake.nickname;
        clientSnake.skin = serverSnake.skin;
        clientSnake.score = serverSnake.score;
        clientSnake.isAlive = serverSnake.isAlive;
        clientSnake.isBoosting = serverSnake.isBoosting;
        clientSnake.width = serverSnake.width;
        clientSnake.angle = serverSnake.angle;

        // Snap all segments to authoritative server positions
        if (serverSnake.segments.length > 0) {
          clientSnake.segments = serverSnake.segments.map((seg) => ({ x: seg.x, y: seg.y }));
        }
      }
    });

    // Remove snakes that are no longer in the server snapshot
    for (const [id] of this.snakes.entries()) {
      if (id !== this.myUserId && !activeRemoteIds.has(id)) {
        this.snakes.delete(id);
      }
    }
  }

  // ========================
  // CORE LOOP & RENDERING
  // ========================
  private gameLoop() {
    if (!this.isRunning) return;

    this.frameCount++;
    const now = Date.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    if (this.mode === 'SINGLEPLAYER') {
      this.updateSinglePlayer();
    } else {
      this.updateMultiplayerState();
    }

    this.updateParticles();
    this.render();

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  private render() {
    this.ctx.fillStyle = '#090c12';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();

    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(this.cameraZoom, this.cameraZoom);
    this.ctx.translate(-this.cameraX, -this.cameraY);

    this.drawBackgroundPattern();
    this.drawWorldBorder();
    this.drawFoods();
    this.drawParticles();
    this.drawSnakes();

    this.ctx.restore();

    this.drawMinimap();

    if (this.showDebugOverlay) {
      this.drawDebugOverlay();
    }
  }

  private drawBackgroundPattern() {
    if (!this.backgroundPatternCanvas) return;

    const pattern = this.ctx.createPattern(this.backgroundPatternCanvas, 'repeat');
    if (!pattern) return;

    const left = this.cameraX - (this.canvas.width / 2) / this.cameraZoom;
    const right = this.cameraX + (this.canvas.width / 2) / this.cameraZoom;
    const top = this.cameraY - (this.canvas.height / 2) / this.cameraZoom;
    const bottom = this.cameraY + (this.canvas.height / 2) / this.cameraZoom;

    this.ctx.save();
    this.ctx.fillStyle = pattern;
    this.ctx.fillRect(left, top, right - left, bottom - top);
    this.ctx.restore();
  }

  private drawWorldBorder() {
    this.ctx.save();
    this.ctx.strokeStyle = '#ff2a5f';
    this.ctx.lineWidth = 18;
    this.ctx.shadowColor = '#ff0033';
    this.ctx.shadowBlur = 25;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.worldRadius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawFoods() {
    const left = this.cameraX - (this.canvas.width / 2) / this.cameraZoom - 30;
    const right = this.cameraX + (this.canvas.width / 2) / this.cameraZoom + 30;
    const top = this.cameraY - (this.canvas.height / 2) / this.cameraZoom - 30;
    const bottom = this.cameraY + (this.canvas.height / 2) / this.cameraZoom + 30;

    const nowSec = Date.now() * 0.003;

    this.foods.forEach((food) => {
      if (food.x < left || food.x > right || food.y < top || food.y > bottom) {
        return;
      }

      const pulse = 1.0 + Math.sin(nowSec + food.pulseOffset) * 0.12;
      const floatY = Math.cos(nowSec * 0.7 + food.pulseOffset) * 2;

      const cached = this.foodSpriteCache.get(`${food.color}_${food.size}`);
      if (cached) {
        const width = cached.width * pulse;
        const height = cached.height * pulse;
        this.ctx.drawImage(cached, food.x - width / 2, food.y + floatY - height / 2, width, height);
      } else {
        this.ctx.save();
        this.ctx.fillStyle = food.color;
        this.ctx.beginPath();
        this.ctx.arc(food.x, food.y + floatY, food.size * pulse, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    });
  }

  private drawParticles() {
    for (let i = 0; i < this.activeParticles.length; i++) {
      const p = this.activeParticles[i];
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  private drawSnakes() {
    const left = this.cameraX - (this.canvas.width / 2) / this.cameraZoom - 100;
    const right = this.cameraX + (this.canvas.width / 2) / this.cameraZoom + 100;
    const top = this.cameraY - (this.canvas.height / 2) / this.cameraZoom - 100;
    const bottom = this.cameraY + (this.canvas.height / 2) / this.cameraZoom + 100;

    const sortedSnakes = Array.from(this.snakes.values()).sort((a, b) => {
      if (a.id === this.myUserId) return 1;
      if (b.id === this.myUserId) return -1;
      return a.segments.length - b.segments.length;
    });

    sortedSnakes.forEach((snake) => {
      if (!snake.isAlive || snake.segments.length === 0) return;

      this.ctx.save();

      if (snake.isBoosting) {
        this.ctx.shadowBlur = 22;
        this.ctx.shadowColor = this.getSkinColor(snake.skin);
      }

      for (let i = snake.segments.length - 1; i >= 0; i--) {
        const seg = snake.segments[i];

        if (seg.x < left || seg.x > right || seg.y < top || seg.y > bottom) {
          continue;
        }

        const progress = i / snake.segments.length;
        const width = snake.width * (1.0 - progress * 0.38);
        const radius = width / 2;

        const segColor = this.getBodyColor(snake.skin, i);

        this.ctx.fillStyle = segColor;
        this.ctx.beginPath();
        this.ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        this.ctx.beginPath();
        this.ctx.arc(seg.x - radius * 0.25, seg.y - radius * 0.25, radius * 0.45, 0, Math.PI * 2);
        this.ctx.fill();
      }

      const head = snake.segments[0];
      const headRadius = snake.width * 0.52;

      this.ctx.fillStyle = this.getBodyColor(snake.skin, 0);
      this.ctx.beginPath();
      this.ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
      this.ctx.fill();

      const eyeAngleOffset = 0.58;
      const eyeDist = snake.width * 0.36;
      const eyeRadius = snake.width * 0.24;
      const pupilRadius = eyeRadius * 0.52;

      const leftEyeX = head.x + Math.cos(snake.angle - eyeAngleOffset) * eyeDist;
      const leftEyeY = head.y + Math.sin(snake.angle - eyeAngleOffset) * eyeDist;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(leftEyeX, leftEyeY, eyeRadius, 0, Math.PI * 2);
      this.ctx.fill();

      const pupilLeftX = leftEyeX + Math.cos(snake.angle) * (eyeRadius - pupilRadius - 1);
      const pupilLeftY = leftEyeY + Math.sin(snake.angle) * (eyeRadius - pupilRadius - 1);
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(pupilLeftX, pupilLeftY, pupilRadius, 0, Math.PI * 2);
      this.ctx.fill();

      const rightEyeX = head.x + Math.cos(snake.angle + eyeAngleOffset) * eyeDist;
      const rightEyeY = head.y + Math.sin(snake.angle + eyeAngleOffset) * eyeDist;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(rightEyeX, rightEyeY, eyeRadius, 0, Math.PI * 2);
      this.ctx.fill();

      const pupilRightX = rightEyeX + Math.cos(snake.angle) * (eyeRadius - pupilRadius - 1);
      const pupilRightY = rightEyeY + Math.sin(snake.angle) * (eyeRadius - pupilRadius - 1);
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(pupilRightX, pupilRightY, pupilRadius, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();

      this.ctx.save();
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      this.ctx.font = `bold ${Math.max(10, Math.min(14, 12 / this.cameraZoom))}px "Inter", "Outfit", sans-serif`;
      this.ctx.textAlign = 'center';
      const cleanName = snake.nickname.replace(/\s*\[bot\]/i, '');
      const displayName = snake.isBot ? `${cleanName} [BOT]` : cleanName;
      this.ctx.fillText(displayName, head.x, head.y - snake.width - 6);
      this.ctx.restore();
    });
  }

  private getSkinColor(skin: SlitherSkin): string {
    switch (skin) {
      case 'RED': return '#ef4444';
      case 'BLUE': return '#3b82f6';
      case 'YELLOW': return '#f59e0b';
      case 'RAINBOW': return '#ec4899';
      case 'GLOW': return '#10b981';
      default: return '#14b8a6';
    }
  }

  private getBodyColor(skin: SlitherSkin, index: number): string {
    if (skin === 'RAINBOW') {
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'];
      return colors[(index + Math.floor(Date.now() / 150)) % colors.length];
    }

    const baseColor = this.getSkinColor(skin);
    if (index % 2 === 0) return baseColor;

    switch (skin) {
      case 'RED': return '#dc2626';
      case 'BLUE': return '#2563eb';
      case 'YELLOW': return '#d97706';
      case 'GLOW': return '#059669';
      default: return '#0d9488';
    }
  }

  private drawMinimap() {
    const size = 150;
    const margin = 20;
    const x = this.canvas.width - size - margin;
    const y = this.canvas.height - size - margin;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(10, 14, 23, 0.65)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.strokeStyle = 'rgba(255, 42, 95, 0.4)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(x + size / 2, y + size / 2, size / 2 - 4, 0, Math.PI * 2);
    this.ctx.stroke();

    const scale = (size / 2 - 6) / this.worldRadius;

    this.snakes.forEach((snake) => {
      if (!snake.isAlive || snake.segments.length === 0) return;
      const head = snake.segments[0];
      const dotX = x + size / 2 + head.x * scale;
      const dotY = y + size / 2 + head.y * scale;

      this.ctx.fillStyle = snake.id === this.myUserId ? '#ffffff' : this.getSkinColor(snake.skin);
      this.ctx.beginPath();
      const dotSize = snake.id === this.myUserId ? 5 : 2.5;
      this.ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  private drawDebugOverlay() {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    this.ctx.strokeStyle = 'rgba(0, 255, 128, 0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(16, 110, 260, 215);
    this.ctx.strokeRect(16, 110, 260, 215);

    this.ctx.fillStyle = '#00ff88';
    this.ctx.font = 'bold 11px monospace';
    this.ctx.fillText(`=== SLITHER MULTIPLAYER DIAGNOSTICS ===`, 24, 128);

    const myLocalSnake = this.snakes.get(this.myUserId);
    const isSpawned = !!(myLocalSnake && myLocalSnake.isAlive);
    const headPos = myLocalSnake && myLocalSnake.segments.length > 0 ? `${myLocalSnake.segments[0].x.toFixed(0)}, ${myLocalSnake.segments[0].y.toFixed(0)}` : 'N/A';

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '10px monospace';
    this.ctx.fillText(`FPS: ${this.fps} (${(1000 / Math.max(1, this.fps)).toFixed(1)}ms)`, 24, 146);
    this.ctx.fillText(`Mode: ${this.mode}`, 24, 162);
    this.ctx.fillText(`WS Socket: ${this.socket && this.socket.connected ? 'CONNECTED' : 'OFFLINE'}`, 24, 178);
    this.ctx.fillText(`Player Spawned: ${isSpawned ? 'YES' : 'NO (Waiting)'}`, 24, 194);
    this.ctx.fillText(`Head Pos: ${headPos}`, 24, 210);
    this.ctx.fillText(`Ping: ${this.ping}ms | Jitter: ${this.jitter}ms`, 24, 226);
    this.ctx.fillText(`Snapshot Buffer: ${this.snapshotBuffer.length} pkts`, 24, 242);
    this.ctx.fillText(`Snakes Count: ${this.snakes.size}`, 24, 258);
    this.ctx.fillText(`Foods Count: ${this.foods.length}`, 24, 274);
    this.ctx.fillText(`Particles: ${this.activeParticles.length}`, 24, 290);
    this.ctx.fillText(`Press F3 to toggle this debug menu`, 24, 310);

    this.ctx.restore();
  }

  public getLeaderboard(): { nickname: string; score: number }[] {
    if (this.mode === 'MULTIPLAYER' && this.serverLeaderboard.length > 0) {
      return this.serverLeaderboard;
    }
    return Array.from(this.snakes.values())
      .filter((s) => s.isAlive)
      .map((s) => ({
        nickname: s.nickname,
        score: Math.floor(s.score * 10)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
}
