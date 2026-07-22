import { BirdSkin, BirdState, GameMode, GameStatus, PipeState, PipeStyle, ThemeType, WeatherType } from './types';
import { PhysicsEngine } from './PhysicsEngine';
import { PipeGenerator } from './PipeGenerator';
import { CollisionEngine } from './CollisionEngine';
import { ParticleSystem } from './ParticleSystem';
import { AudioEngine } from './AudioEngine';
import { CanvasRenderer } from './CanvasRenderer';

export interface FlappyCoreCallbacks {
  onScoreUpdate?: (score: number) => void;
  onJump?: (birdId: string, y: number, vy: number) => void;
  onBirdDeath?: (bird: BirdState, rank?: number) => void;
  onGameOver?: (finalScore: number, timeSurvived: number) => void;
  onStatusChange?: (status: GameStatus) => void;
  onCountdownTick?: (val: number) => void;
}

export class FlappyCore {
  public mode: GameMode = 'SINGLEPLAYER';
  public status: GameStatus = 'IDLE';
  public theme: ThemeType = 'DAY';
  public skin: BirdSkin = 'CLASSIC';
  public weather: WeatherType = 'NONE';
  public pipeStyle: PipeStyle = 'CLASSIC';

  public localBirdId: string = 'player_local';
  public birds: Map<string, BirdState> = new Map();
  public pipes: PipeState[] = [];

  public particleSystem = new ParticleSystem();
  public audioEngine = new AudioEngine();
  public renderer = new CanvasRenderer();
  public pipeGenerator: PipeGenerator;

  private animFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private countdownTimer: NodeJS.Timeout | null = null;
  public countdownValue: number | null = null;

  public currentSeed: number = 12345;
  public startTime: number = 0;

  private callbacks: FlappyCoreCallbacks;

  constructor(callbacks: FlappyCoreCallbacks = {}) {
    this.callbacks = callbacks;
    this.pipeGenerator = new PipeGenerator(this.currentSeed);
  }

  public initLocalBird(userId?: string, nickname?: string, avatar?: string | null): BirdState {
    if (userId) {
      this.localBirdId = userId;
    }
    const localBird: BirdState = {
      id: this.localBirdId,
      nickname: nickname || 'Player',
      avatar,
      x: PhysicsEngine.BIRD_X,
      y: PhysicsEngine.CANVAS_HEIGHT / 2 - 40,
      vy: 0,
      rotation: 0,
      score: 0,
      pipesPassed: 0,
      timeSurvivedSeconds: 0,
      isAlive: true,
      color: '#FFD700',
      skin: this.skin
    };

    this.birds.set(this.localBirdId, localBird);
    return localBird;
  }

  public setOpponentBirds(opponents: { id: string; nickname: string; color?: string }[]): void {
    const colors = ['#4cc9f0', '#f72585', '#7209b7', '#4361ee', '#e76f51', '#2a9d8f'];
    let idx = 0;

    for (const opp of opponents) {
      if (opp.id === this.localBirdId) continue;
      this.birds.set(opp.id, {
        id: opp.id,
        nickname: opp.nickname,
        x: PhysicsEngine.BIRD_X,
        y: PhysicsEngine.CANVAS_HEIGHT / 2 - 40,
        vy: 0,
        rotation: 0,
        score: 0,
        pipesPassed: 0,
        timeSurvivedSeconds: 0,
        isAlive: true,
        color: opp.color || colors[idx++ % colors.length]
      });
    }
  }

  /**
   * Update remote opponent position on jump or sync event
   */
  public updateRemoteBird(birdId: string, y: number, vy: number, score?: number, isAlive?: boolean): void {
    const b = this.birds.get(birdId);
    if (!b) return;

    if (y > 0) b.y = y;
    if (vy !== 0 || b.isAlive) b.vy = vy;
    if (score !== undefined) b.score = score;

    if (isAlive !== undefined) {
      const wasAlive = b.isAlive;
      b.isAlive = isAlive;
      if (wasAlive && !isAlive) {
        this.particleSystem.addExplosionParticles(b.x, b.y, b.color);
      }
    }

    if (b.isAlive && vy < 0) {
      this.particleSystem.addJumpParticles(b.x, b.y, b.color);
    }
  }

  public clearOpponentBirds(): void {
    const local = this.birds.get(this.localBirdId);
    this.birds.clear();
    if (local) {
      this.birds.set(this.localBirdId, local);
    }
  }

  /**
   * Start a new game match
   */
  public startMatch(seed: number = Math.floor(Math.random() * 1000000)): void {
    this.currentSeed = seed;
    this.pipeGenerator.reset(seed);
    this.particleSystem.reset();

    if (this.mode === 'SINGLEPLAYER') {
      this.clearOpponentBirds();
    }

    // Reset Birds
    for (const bird of this.birds.values()) {
      bird.x = PhysicsEngine.BIRD_X;
      bird.y = PhysicsEngine.CANVAS_HEIGHT / 2 - 40;
      bird.vy = 0;
      bird.rotation = 0;
      bird.score = 0;
      bird.pipesPassed = 0;
      bird.timeSurvivedSeconds = 0;
      bird.isAlive = true;
    }

    // Generate initial pipe layout
    this.pipes = this.pipeGenerator.generateInitialPipes();

    // Start Countdown 3..2..1..GO
    this.startCountdown();
  }

  private startCountdown(): void {
    this.setStatus('COUNTDOWN');
    this.countdownValue = 3;
    if (this.callbacks.onCountdownTick) this.callbacks.onCountdownTick(3);

    if (this.countdownTimer) clearInterval(this.countdownTimer);

    this.countdownTimer = setInterval(() => {
      if (this.countdownValue === null) return;
      this.countdownValue--;
      if (this.callbacks.onCountdownTick && this.countdownValue >= 0) {
        this.callbacks.onCountdownTick(this.countdownValue);
      }

      if (this.countdownValue < 0) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownValue = null;
        this.startTime = Date.now();
        this.setStatus('PLAYING');
      }
    }, 900);
  }

  public jumpLocalBird(): void {
    if (this.status !== 'PLAYING') return;

    const bird = this.birds.get(this.localBirdId);
    if (!bird || !bird.isAlive) return;

    const jumped = PhysicsEngine.jump(bird);
    if (jumped) {
      this.audioEngine.playJump();
      this.particleSystem.addJumpParticles(bird.x, bird.y, bird.color);
      if (this.callbacks.onJump) {
        this.callbacks.onJump(bird.id, bird.y, bird.vy);
      }
    }
  }

  public setStatus(status: GameStatus): void {
    this.status = status;
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange(status);
    }
  }

  /**
   * Main 60 FPS update loop
   */
  public update(deltaTime: number): void {
    if (this.status !== 'PLAYING') {
      this.particleSystem.update();
      return;
    }

    const deltaRatio = Math.min(2.0, deltaTime / 16.666);
    const localBird = this.birds.get(this.localBirdId);

    // 1. Update Physics for all alive birds
    for (const bird of this.birds.values()) {
      if (bird.isAlive) {
        PhysicsEngine.updateBird(bird, deltaRatio);
        bird.timeSurvivedSeconds += deltaTime / 1000;
      }
    }

    // 2. Calculate highest score for pipe speed scaling
    let maxScore = 0;
    for (const bird of this.birds.values()) {
      if (bird.score > maxScore) maxScore = bird.score;
    }

    // 3. Move Pipes
    const currentSpeed = this.pipeGenerator.getSpeed(maxScore);
    this.pipes = this.pipeGenerator.updatePipes(this.pipes, currentSpeed, maxScore);

    // 4. Score Passed Check
    for (const pipe of this.pipes) {
      if (!pipe.passedBy) pipe.passedBy = new Set();
      for (const bird of this.birds.values()) {
        if (bird.isAlive && !pipe.passedBy.has(bird.id)) {
          if (bird.x > pipe.x + pipe.width) {
            pipe.passedBy.add(bird.id);
            bird.score++;
            bird.pipesPassed++;

            if (bird.id === this.localBirdId) {
              this.audioEngine.playScore();
              this.particleSystem.addScorePopup(bird.x + 30, bird.y - 10, '+1', '#FFD700');
              if (this.callbacks.onScoreUpdate) {
                this.callbacks.onScoreUpdate(bird.score);
              }
            }
          }
        }
      }
    }

    // 5. Collision Check for Local Bird
    if (localBird && localBird.isAlive) {
      const collided = CollisionEngine.checkPipeCollisions(localBird, this.pipes);
      if (collided) {
        localBird.isAlive = false;
        this.audioEngine.playHit();
        this.particleSystem.addExplosionParticles(localBird.x, localBird.y, localBird.color);

        if (this.callbacks.onBirdDeath) {
          this.callbacks.onBirdDeath(localBird);
        }
      }
    }

    // 6. Check Game Over Condition
    if (this.mode === 'SINGLEPLAYER') {
      if (localBird && !localBird.isAlive) {
        this.setStatus('GAMEOVER');
        if (this.callbacks.onGameOver) {
          this.callbacks.onGameOver(localBird.score, localBird.timeSurvivedSeconds);
        }
      }
    } else {
      // Multiplayer: Game ends when ALL birds are dead
      let aliveCount = 0;
      for (const b of this.birds.values()) {
        if (b.isAlive) aliveCount++;
      }

      if (aliveCount === 0 && (this.status as string) !== 'GAMEOVER') {
        this.setStatus('GAMEOVER');
        if (localBird && this.callbacks.onGameOver) {
          this.callbacks.onGameOver(localBird.score, localBird.timeSurvivedSeconds);
        }
      }
    }

    // 7. Update Particle System
    this.particleSystem.update();
  }

  /**
   * Start 60 FPS Canvas Animation Loop
   */
  public startLoop(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const deltaTime = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      this.update(deltaTime);

      // Render Frame
      const birdsList = Array.from(this.birds.values());
      this.renderer.render(
        ctx,
        this.theme,
        birdsList,
        this.localBirdId,
        this.pipes,
        this.particleSystem,
        this.status,
        this.countdownValue,
        this.weather,
        this.pipeStyle
      );

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.stopLoop();
    this.animFrameId = requestAnimationFrame(loop);
  }

  public stopLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public destroy(): void {
    this.stopLoop();
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}
