export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  life: number;     // Remaining life in seconds
  maxLife: number;  // Initial life in seconds
}

export class ParticleSystem {
  private particles: Particle[] = [];

  public spawnBurst(x: number, y: number, color: string, count: number = 30) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 200; // pixels per second
      const maxLife = 0.4 + Math.random() * 0.5; // seconds

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1.0,
        size: 3 + Math.random() * 5,
        life: maxLife,
        maxLife,
      });
    }
  }

  public update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      // Apply slight air resistance
      p.vx *= 0.95;
      p.vy *= 0.95;
      
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      // Draw as small stars/diamonds/circles
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  public clear() {
    this.particles = [];
  }
}
