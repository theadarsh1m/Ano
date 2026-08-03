import { Container, Graphics } from 'pixi.js';

interface Particle {
  graphics: Graphics;
  vx: number;
  vy: number;
  alpha: number;
  life: number;
  maxLife: number;
  scaleSpeed: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private container: Container | null = null;
  private particlePool: Graphics[] = [];

  constructor(stageContainer: Container | null) {
    this.container = stageContainer;
  }

  /**
   * Spawns a dust cloud effect at landing point.
   */
  public spawnDustEffect(x: number, y: number) {
    if (!this.container) return;

    const count = 10;
    for (let i = 0; i < count; i++) {
      const graphics = this.getGraphics();
      graphics.clear();
      
      // Grayish-white dust particle
      graphics.circle(0, 0, Math.random() * 4 + 2).fill(0xdddddd);
      graphics.position.set(x, y);
      graphics.alpha = 0.8;
      
      this.container.addChild(graphics);

      // Random speed vector outwards/upwards
      const angle = Math.random() * Math.PI - Math.PI; // Upward semi-circle
      const speed = Math.random() * 2 + 1;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 1; // Bias upwards

      const maxLife = Math.random() * 30 + 20;

      this.particles.push({
        graphics,
        vx,
        vy,
        alpha: 0.8,
        life: maxLife,
        maxLife,
        scaleSpeed: -0.02
      });
    }
  }

  /**
   * Spawns flashy impact particles.
   */
  public spawnImpactEffect(x: number, y: number, intensity: number = 1.0) {
    if (!this.container) return;

    const count = Math.floor(15 * intensity);
    const colors = [0xFFEB3B, 0xFF9800, 0xFF5722, 0xE91E63]; // Sparks!

    for (let i = 0; i < count; i++) {
      const graphics = this.getGraphics();
      graphics.clear();

      const color = colors[Math.floor(Math.random() * colors.length)];
      graphics.circle(0, 0, Math.random() * 3 + 1).fill(color);
      graphics.position.set(x, y);
      graphics.alpha = 1.0;

      this.container.addChild(graphics);

      // Fast random velocity
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 4 + 2) * intensity;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const maxLife = Math.random() * 20 + 15;

      this.particles.push({
        graphics,
        vx,
        vy,
        alpha: 1.0,
        life: maxLife,
        maxLife,
        scaleSpeed: -0.04
      });
    }
  }

  public update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= 1;

      // Apply simple velocity physics
      p.graphics.position.x += p.vx;
      p.graphics.position.y += p.vy;
      
      // Gravity drag
      p.vy += 0.05;

      // Fade out
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.graphics.alpha = p.alpha;

      // Shrink
      const newScale = Math.max(0.1, p.graphics.scale.x + p.scaleSpeed);
      p.graphics.scale.set(newScale);

      if (p.life <= 0 || p.alpha <= 0 || newScale <= 0.1) {
        // Return to pool and recycle
        if (this.container) {
          this.container.removeChild(p.graphics);
        }
        this.particlePool.push(p.graphics);
        this.particles.splice(i, 1);
      }
    }
  }

  private getGraphics(): Graphics {
    if (this.particlePool.length > 0) {
      return this.particlePool.pop()!;
    }
    return new Graphics();
  }

  public destroy() {
    this.particles.forEach((p) => {
      if (this.container) {
        this.container.removeChild(p.graphics);
      }
    });
    this.particles = [];
    this.particlePool = [];
    this.container = null;
  }
}
