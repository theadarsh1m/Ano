import { PipeState } from './types';
import { SeedRandom } from './SeedRandom';
import { FLAPPY_CONFIG, PhysicsEngine } from './PhysicsEngine';

export class PipeGenerator {
  private rng: SeedRandom;
  private nextPipeId = 1;

  public static readonly PIPE_WIDTH = FLAPPY_CONFIG.PIPE_WIDTH;
  public static readonly BASE_GAP = FLAPPY_CONFIG.BASE_GAP;
  public static readonly MIN_GAP = FLAPPY_CONFIG.MIN_GAP;
  public static readonly PIPE_SPACING = FLAPPY_CONFIG.PIPE_SPACING;
  public static readonly BASE_SPEED = FLAPPY_CONFIG.BASE_SPEED;

  constructor(seed: number) {
    this.rng = new SeedRandom(seed);
  }

  public reset(seed: number): void {
    this.rng = new SeedRandom(seed);
    this.nextPipeId = 1;
  }

  /**
   * Calculate current pipe speed based on game score with smooth, gentle progression
   */
  public getSpeed(score: number): number {
    const speedBoost = Math.min(0.3, Math.floor(score / 15) * 0.04);
    return PipeGenerator.BASE_SPEED + speedBoost;
  }

  /**
   * Calculate current gap height based on game score
   */
  public getGap(score: number): number {
    const shrink = Math.min(18, Math.floor(score / 12) * 2);
    return Math.max(PipeGenerator.MIN_GAP, PipeGenerator.BASE_GAP - shrink);
  }

  /**
   * Spawn a new pipe using seeded PRNG and safe screen bounds
   */
  public spawnPipe(x: number, score: number): PipeState {
    const gap = this.getGap(score);
    const minTopHeight = FLAPPY_CONFIG.MIN_TOP_HEIGHT;
    const playAreaHeight = PhysicsEngine.CANVAS_HEIGHT - PhysicsEngine.GROUND_HEIGHT;
    const maxTopHeight = playAreaHeight - gap - FLAPPY_CONFIG.MIN_TOP_HEIGHT;

    const topHeight = Math.floor(this.rng.nextRange(minTopHeight, maxTopHeight));
    const bottomHeight = playAreaHeight - (topHeight + gap);

    const pipe: PipeState = {
      id: this.nextPipeId++,
      x,
      topHeight,
      bottomHeight,
      bottomY: topHeight + gap,
      gap,
      width: PipeGenerator.PIPE_WIDTH,
      passedBy: new Set()
    };

    return pipe;
  }

  /**
   * Initialize initial set of pipes off to the right
   */
  public generateInitialPipes(count: number = 4): PipeState[] {
    const pipes: PipeState[] = [];
    const startX = PhysicsEngine.CANVAS_WIDTH + 140;
    for (let i = 0; i < count; i++) {
      const x = startX + i * PipeGenerator.PIPE_SPACING;
      pipes.push(this.spawnPipe(x, 0));
    }
    return pipes;
  }

  /**
   * Move pipes and spawn new ones seamlessly
   */
  public updatePipes(pipes: PipeState[], speed: number, maxScore: number): PipeState[] {
    const updated: PipeState[] = [];

    for (const pipe of pipes) {
      pipe.x -= speed;
      if (pipe.x + pipe.width > -50) {
        updated.push(pipe);
      }
    }

    if (updated.length > 0) {
      const lastPipe = updated[updated.length - 1];
      if (lastPipe.x <= PhysicsEngine.CANVAS_WIDTH + 140 - PipeGenerator.PIPE_SPACING) {
        const newX = lastPipe.x + PipeGenerator.PIPE_SPACING;
        updated.push(this.spawnPipe(newX, maxScore));
      }
    }

    return updated;
  }
}
