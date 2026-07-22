import { FLAPPY_CONFIG } from '../config';
import { BackgroundCloud, BirdState, GameState, Pipe } from './types';

export interface EngineCallbacks {
  onScoreUpdate?: (score: number) => void;
  onGameStateChange?: (state: GameState) => void;
  onGameOver?: (finalScore: number, playTimeSeconds: number) => void;
}

export class FlappyEngine {
  public state: GameState = 'IDLE';
  public score: number = 0;
  public highScore: number = 0;
  public playTimeMs: number = 0;

  public bird: BirdState;
  public pipes: Pipe[] = [];
  public clouds: BackgroundCloud[] = [];
  public groundOffset: number = 0;

  private animFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private callbacks: EngineCallbacks;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private renderCallback: (() => void) | null = null;

  constructor(callbacks: EngineCallbacks = {}) {
    this.callbacks = callbacks;
    this.bird = this.createInitialBird();
    this.initClouds();
  }

  private createInitialBird(): BirdState {
    return {
      id: 'player_local',
      nickname: 'Player',
      x: FLAPPY_CONFIG.birdX,
      y: (FLAPPY_CONFIG.canvasHeight - FLAPPY_CONFIG.groundHeight) / 2,
      vy: 0,
      rotation: 0,
      score: 0,
      pipesPassed: 0,
      timeSurvivedSeconds: 0,
      isAlive: true,
      color: '#FFD700',
      wingFrame: 0,
      wingTimer: 0
    };
  }

  private initClouds(): void {
    this.clouds = [
      { x: 50, y: 80, scale: 1.2, speed: 0.4 },
      { x: 220, y: 140, scale: 0.8, speed: 0.3 },
      { x: 380, y: 60, scale: 1.0, speed: 0.5 }
    ];
  }

  public setRenderCallback(fn: () => void): void {
    this.renderCallback = fn;
  }

  public start(): void {
    this.score = 0;
    this.playTimeMs = 0;
    this.bird = this.createInitialBird();
    this.pipes = this.generateInitialPipes();
    this.setGameState('PLAYING');
    if (this.callbacks.onScoreUpdate) {
      this.callbacks.onScoreUpdate(0);
    }
    // Perform immediate flap on game start for instant responsiveness
    this.flap();
  }

  public pause(): void {
    if (this.state === 'PLAYING') {
      this.setGameState('PAUSED');
    }
  }

  public resume(): void {
    if (this.state === 'PAUSED') {
      this.setGameState('PLAYING');
      this.lastTimestamp = performance.now();
    }
  }

  public reset(): void {
    this.score = 0;
    this.playTimeMs = 0;
    this.bird = this.createInitialBird();
    this.pipes = [];
    this.setGameState('IDLE');
    if (this.callbacks.onScoreUpdate) {
      this.callbacks.onScoreUpdate(0);
    }
  }

  public flap(): void {
    if (this.state === 'IDLE' || this.state === 'GAMEOVER') {
      this.start();
      return;
    }

    if (this.state !== 'PLAYING') return;

    this.bird.vy = FLAPPY_CONFIG.flapForce;
    this.bird.rotation = FLAPPY_CONFIG.maxUpwardRotation;
    this.bird.wingFrame = ((this.bird.wingFrame || 0) + 1) % 3;
  }

  private setGameState(newState: GameState): void {
    this.state = newState;
    if (this.callbacks.onGameStateChange) {
      this.callbacks.onGameStateChange(newState);
    }
  }

  private generateInitialPipes(): Pipe[] {
    const firstX = FLAPPY_CONFIG.canvasWidth + 100;
    const initialPipes: Pipe[] = [];

    for (let i = 0; i < 3; i++) {
      const x = firstX + i * FLAPPY_CONFIG.pipeSpacing;
      initialPipes.push(this.createPipeAt(x, `pipe_${Date.now()}_${i}`));
    }

    return initialPipes;
  }

  private createPipeAt(x: number, id: string): Pipe {
    const playableHeight = FLAPPY_CONFIG.canvasHeight - FLAPPY_CONFIG.groundHeight;
    const minTop = FLAPPY_CONFIG.minPipeHeight;
    const maxTop = playableHeight - FLAPPY_CONFIG.pipeGap - FLAPPY_CONFIG.minPipeHeight;
    const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
    const bottomY = topHeight + FLAPPY_CONFIG.pipeGap;
    const bottomHeight = Math.max(0, playableHeight - bottomY);

    return {
      id,
      x,
      topHeight,
      bottomHeight,
      bottomY,
      gap: FLAPPY_CONFIG.pipeGap,
      width: FLAPPY_CONFIG.pipeWidth,
      passedBy: new Set(),
      passed: false
    };
  }

  public update(deltaTimeMs: number): void {
    const dt = Math.min(2.0, deltaTimeMs / 16.666);

    // Update background clouds regardless of state
    for (const cloud of this.clouds) {
      cloud.x -= cloud.speed * dt;
      if (cloud.x + 80 < 0) {
        cloud.x = FLAPPY_CONFIG.canvasWidth + 40;
        cloud.y = 40 + Math.random() * 120;
      }
    }

    if (this.state !== 'PLAYING') return;

    this.playTimeMs += deltaTimeMs;

    // 1. Update Ground offset
    this.groundOffset = (this.groundOffset + FLAPPY_CONFIG.groundSpeed * dt) % 24;

    // 2. Update Bird Physics
    this.bird.vy += FLAPPY_CONFIG.gravity * dt;
    if (this.bird.vy > FLAPPY_CONFIG.maxFallSpeed) {
      this.bird.vy = FLAPPY_CONFIG.maxFallSpeed;
    }
    this.bird.y += this.bird.vy * dt;

    // Wing flap animation
    const currentWingTimer = this.bird.wingTimer || 0;
    const currentWingFrame = this.bird.wingFrame || 0;
    this.bird.wingTimer = currentWingTimer + dt;
    if (this.bird.wingTimer >= 5) {
      this.bird.wingTimer = 0;
      this.bird.wingFrame = (currentWingFrame + 1) % 3;
    }

    // Smooth rotation interpolation
    const targetRotation = Math.min(
      FLAPPY_CONFIG.maxDownwardRotation,
      Math.max(FLAPPY_CONFIG.maxUpwardRotation, this.bird.vy * 0.08)
    );
    this.bird.rotation += (targetRotation - this.bird.rotation) * FLAPPY_CONFIG.rotationSmoothing;

    // 3. Update & Move Pipes
    for (const pipe of this.pipes) {
      pipe.x -= FLAPPY_CONFIG.pipeSpeed * dt;

      // Score check
      if (!pipe.passed && pipe.x + pipe.width < this.bird.x) {
        pipe.passed = true;
        this.score++;
        if (this.score > this.highScore) {
          this.highScore = this.score;
        }
        if (this.callbacks.onScoreUpdate) {
          this.callbacks.onScoreUpdate(this.score);
        }
      }
    }

    // Remove off-screen pipes and spawn new ones
    if (this.pipes.length > 0 && this.pipes[0].x + this.pipes[0].width < 0) {
      this.pipes.shift();
      const lastPipeX = this.pipes[this.pipes.length - 1].x;
      const newX = lastPipeX + FLAPPY_CONFIG.pipeSpacing;
      this.pipes.push(this.createPipeAt(newX, `pipe_${Date.now()}`));
    }

    // 4. Collision Check
    if (this.checkCollision()) {
      this.setGameState('GAMEOVER');
      if (this.callbacks.onGameOver) {
        const playTimeSeconds = Math.max(1, Math.floor(this.playTimeMs / 1000));
        this.callbacks.onGameOver(this.score, playTimeSeconds);
      }
    }
  }

  private checkCollision(): boolean {
    const { birdX, birdRadius, canvasHeight, groundHeight } = FLAPPY_CONFIG;
    const maxAllowedY = canvasHeight - groundHeight - birdRadius;

    // Ground collision
    if (this.bird.y >= maxAllowedY) {
      this.bird.y = maxAllowedY;
      return true;
    }

    // Ceiling collision
    if (this.bird.y - birdRadius <= 0) {
      this.bird.y = birdRadius;
      return true;
    }

    // Pipe collisions (Circle vs AABB)
    for (const pipe of this.pipes) {
      // Check if bird is horizontally aligned with pipe
      if (birdX + birdRadius > pipe.x && birdX - birdRadius < pipe.x + pipe.width) {
        // Top pipe collision
        if (this.bird.y - birdRadius < pipe.topHeight) {
          return true;
        }
        // Bottom pipe collision
        const bottomY = pipe.bottomY ?? (pipe.topHeight + (pipe.gap || FLAPPY_CONFIG.pipeGap));
        if (this.bird.y + birdRadius > bottomY) {
          return true;
        }
      }
    }

    return false;
  }

  public runLoop(timestamp: number): void {
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
    }
    const deltaTime = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    this.update(deltaTime);

    if (this.renderCallback) {
      this.renderCallback();
    }

    this.animFrameId = requestAnimationFrame((t) => this.runLoop(t));
  }

  public stopLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.lastTimestamp = 0;
  }
}
