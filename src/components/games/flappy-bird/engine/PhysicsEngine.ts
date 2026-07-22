import { BirdState } from './types';

export const FLAPPY_CONFIG = {
  // Physics (Relaxed & Easy Flappy Bird Tuning)
  GRAVITY: 0.30,
  JUMP_VELOCITY: -5.8,
  TERMINAL_VELOCITY: 7.5,
  BIRD_RADIUS: 14,
  COLLISION_PADDING: 5.0,
  ROTATION_SMOOTHING: 0.18,

  // Canvas Boundaries
  CANVAS_WIDTH: 480,
  CANVAS_HEIGHT: 640,
  GROUND_HEIGHT: 75,
  BIRD_X: 110,

  // Pipes & Obstacles
  PIPE_WIDTH: 62,
  PIPE_SPACING: 265,
  BASE_GAP: 158,
  MIN_GAP: 135,
  BASE_SPEED: 1.75,
  MIN_TOP_HEIGHT: 65
};

export class PhysicsEngine {
  public static readonly GRAVITY = FLAPPY_CONFIG.GRAVITY;
  public static readonly JUMP_VELOCITY = FLAPPY_CONFIG.JUMP_VELOCITY;
  public static readonly TERMINAL_VELOCITY = FLAPPY_CONFIG.TERMINAL_VELOCITY;
  public static readonly BIRD_RADIUS = FLAPPY_CONFIG.BIRD_RADIUS;
  public static readonly BIRD_X = FLAPPY_CONFIG.BIRD_X;
  public static readonly CANVAS_WIDTH = FLAPPY_CONFIG.CANVAS_WIDTH;
  public static readonly CANVAS_HEIGHT = FLAPPY_CONFIG.CANVAS_HEIGHT;
  public static readonly GROUND_HEIGHT = FLAPPY_CONFIG.GROUND_HEIGHT;

  /**
   * Apply physics step to a bird
   */
  public static updateBird(bird: BirdState, deltaRatio: number = 1.0): void {
    const maxY = FLAPPY_CONFIG.CANVAS_HEIGHT - FLAPPY_CONFIG.GROUND_HEIGHT - FLAPPY_CONFIG.BIRD_RADIUS;
    
    // If dead and already on ground, stop updating
    if (!bird.isAlive && bird.y >= maxY) return;

    // Apply soft gravity
    bird.vy += FLAPPY_CONFIG.GRAVITY * deltaRatio;
    if (bird.vy > FLAPPY_CONFIG.TERMINAL_VELOCITY) {
      bird.vy = FLAPPY_CONFIG.TERMINAL_VELOCITY;
    }

    // Update position
    bird.y += bird.vy * deltaRatio;

    // Smooth rotation: tilt down if dead
    const targetRotation = bird.isAlive
      ? Math.min(Math.PI / 2.3, Math.max(-Math.PI / 7, bird.vy * 0.09))
      : Math.PI / 2;
    bird.rotation += (targetRotation - bird.rotation) * FLAPPY_CONFIG.ROTATION_SMOOTHING;

    // Ceiling boundary check
    if (bird.y < FLAPPY_CONFIG.BIRD_RADIUS) {
      bird.y = FLAPPY_CONFIG.BIRD_RADIUS;
      bird.vy = 0;
    }

    // Ground boundary check
    if (bird.y >= maxY) {
      bird.y = maxY;
      bird.isAlive = false;
      bird.vy = 0;
    }
  }

  /**
   * Make bird jump with exact single-press response
   */
  public static jump(bird: BirdState): boolean {
    if (!bird.isAlive) return false;
    bird.vy = FLAPPY_CONFIG.JUMP_VELOCITY;
    return true;
  }
}
