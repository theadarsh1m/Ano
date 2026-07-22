import { Particle, TextPopup } from './types';

export class ParticleSystem {
  public particles: Particle[] = [];
  public textPopups: TextPopup[] = [];
  private nextPopupId = 1;

  public reset(): void {
    this.particles = [];
    this.textPopups = [];
  }

  /**
   * Spawn feather particles when bird flaps wings / jumps
   */
  public addJumpParticles(x: number, y: number, color: string): void {
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI * 0.4 + (Math.random() - 0.5) * 0.8;
      const speed = 1.5 + Math.random() * 2.5;
      this.particles.push({
        x,
        y: y + 5,
        vx: -Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 1,
        size: 3 + Math.random() * 3,
        color,
        alpha: 0.9,
        life: 0,
        maxLife: 20 + Math.random() * 10
      });
    }
  }

  /**
   * Spawn explosion fragments when bird hits pipe or ground
   */
  public addExplosionParticles(x: number, y: number, primaryColor: string): void {
    const colors = [primaryColor, '#FFD700', '#FF4500', '#FFFFFF', '#FFA500'];
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        life: 0,
        maxLife: 30 + Math.random() * 20
      });
    }
  }

  /**
   * Spawn floating +1 score animation
   */
  public addScorePopup(x: number, y: number, text: string = '+1', color: string = '#FFD700'): void {
    this.textPopups.push({
      id: `popup_${this.nextPopupId++}`,
      text,
      x,
      y,
      alpha: 1.0,
      scale: 1.2,
      color
    });
  }

  /**
   * Update particle positions and fade states
   */
  public update(): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // mild gravity on particles
      p.life++;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // Update text popups
    for (let i = this.textPopups.length - 1; i >= 0; i--) {
      const popup = this.textPopups[i];
      popup.y -= 1.2;
      popup.alpha -= 0.025;
      if (popup.scale > 1.0) {
        popup.scale -= 0.02;
      }

      if (popup.alpha <= 0) {
        this.textPopups.splice(i, 1);
      }
    }
  }
}
