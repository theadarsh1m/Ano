import { Container } from 'pixi.js';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  PLATFORM_Y,
  PLATFORM_WIDTH,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  CAMERA_LERP_SPEED
} from '../data/constants';

export class Camera {
  private targetZoom: number = 1.0;
  private targetX: number = 0;
  private targetY: number = 0;

  private currentZoom: number = 1.0;
  private currentX: number = 0;
  private currentY: number = 0;

  public update(worldContainer: Container | null, bodies: { x: number; y: number }[]) {
    if (!worldContainer) return;

    // Find the highest point (minimum Y) of all dynamic bodies
    let highestY = PLATFORM_Y;
    for (const body of bodies) {
      // Skip the preview body which is at Y = 50 to prevent it from pulling the camera up early
      if (body.y <= 100) continue;
      if (body.y < highestY) {
        highestY = body.y;
      }
    }

    if (highestY > 250) {
      // Keep camera centered at default view
      this.targetZoom = 1.0;
      this.targetX = 0;
      this.targetY = 0;
    } else {
      // Default bounds (include the platform area)
      let minX = 400 - PLATFORM_WIDTH / 2 - 50;
      let maxX = 400 + PLATFORM_WIDTH / 2 + 50;
      let minY = PLATFORM_Y - 50;
      let maxY = PLATFORM_Y + 50;

      // Expand bounds to cover all dynamic bodies
      if (bodies.length > 0) {
        for (const body of bodies) {
          if (body.x < minX) minX = body.x;
          if (body.x > maxX) maxX = body.x;
          if (body.y < minY) minY = body.y;
          if (body.y > maxY) maxY = body.y;
        }
      }

      const boundsWidth = maxX - minX;
      const boundsHeight = maxY - minY;

      // Calculate target zoom factor to fit bounding box with a margin (e.g. 1.3x margin)
      const padding = 120;
      const zoomX = GAME_WIDTH / (boundsWidth + padding);
      const zoomY = GAME_HEIGHT / (boundsHeight + padding);

      let zoom = Math.min(zoomX, zoomY);
      zoom = Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, zoom));

      this.targetZoom = zoom;

      // Calculate center point of current tower bounds
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + PLATFORM_Y) / 2;

      // Calculate the screen displacement offset
      this.targetX = GAME_WIDTH / 2 - centerX * zoom;
      this.targetY = GAME_HEIGHT / 2 - centerY * zoom;
    }

    // Smoothly lerp towards target values
    this.currentZoom += (this.targetZoom - this.currentZoom) * CAMERA_LERP_SPEED;
    this.currentX += (this.targetX - this.currentX) * CAMERA_LERP_SPEED;
    this.currentY += (this.targetY - this.currentY) * CAMERA_LERP_SPEED;

    // Apply transforms to PixiJS container
    worldContainer.scale.set(this.currentZoom);
    worldContainer.position.set(this.currentX, this.currentY);
  }

  public reset() {
    this.targetZoom = 1.0;
    this.targetX = 0;
    this.targetY = 0;
    this.currentZoom = 1.0;
    this.currentX = 0;
    this.currentY = 0;
  }
}
