import { BirdState, PipeState } from './types';
import { FLAPPY_CONFIG, PhysicsEngine } from './PhysicsEngine';

export class CollisionEngine {
  /**
   * Check collision between a bird and all active pipes with forgiving collision padding
   */
  public static checkPipeCollisions(bird: BirdState, pipes: PipeState[]): boolean {
    if (!bird.isAlive) return false;

    // Use forgiving collision radius so near-misses feel clean and natural
    const radius = PhysicsEngine.BIRD_RADIUS - FLAPPY_CONFIG.COLLISION_PADDING;
    const birdX = bird.x;
    const birdY = bird.y;

    for (const pipe of pipes) {
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + pipe.width;

      if (birdX + radius > pipeLeft && birdX - radius < pipeRight) {
        const playAreaHeight = PhysicsEngine.CANVAS_HEIGHT - PhysicsEngine.GROUND_HEIGHT;

        // Top Pipe rectangle
        const topPipeRect = {
          left: pipeLeft,
          right: pipeRight,
          top: 0,
          bottom: pipe.topHeight
        };

        // Bottom Pipe rectangle
        const bottomPipeHeight = pipe.bottomHeight ?? (playAreaHeight - (pipe.bottomY ?? (pipe.topHeight + (pipe.gap || 145))));
        const bottomPipeRect = {
          left: pipeLeft,
          right: pipeRight,
          top: playAreaHeight - bottomPipeHeight,
          bottom: playAreaHeight
        };

        if (
          CollisionEngine.circleRectOverlap(birdX, birdY, radius, topPipeRect) ||
          CollisionEngine.circleRectOverlap(birdX, birdY, radius, bottomPipeRect)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Circle vs Rectangle overlap algorithm
   */
  private static circleRectOverlap(
    cx: number,
    cy: number,
    r: number,
    rect: { left: number; right: number; top: number; bottom: number }
  ): boolean {
    const closestX = Math.max(rect.left, Math.min(cx, rect.right));
    const closestY = Math.max(rect.top, Math.min(cy, rect.bottom));

    const distX = cx - closestX;
    const distY = cy - closestY;
    const distanceSquared = distX * distX + distY * distY;

    return distanceSquared < r * r;
  }
}
