import { BirdSkin, BirdState, PipeState, PipeStyle, ThemeConfig, ThemeType, WeatherParticle, WeatherType } from './types';
import { PhysicsEngine } from './PhysicsEngine';
import { ParticleSystem } from './ParticleSystem';

export class CanvasRenderer {
  public static readonly THEMES: Record<ThemeType, ThemeConfig> = {
    DAY: {
      name: 'Daytime',
      skyGradient: ['#4facfe', '#00f2fe', '#70c5ce'],
      groundColor: '#ded895',
      groundPatternColor: '#73bf2e',
      pipeColor: '#73bf2e',
      pipeBorder: '#558022',
      pipeCapColor: '#80d238',
      cloudColor: 'rgba(255, 255, 255, 0.75)',
      buildingColor: 'rgba(255, 255, 255, 0.15)',
      accentColor: '#FFD700'
    },
    NIGHT: {
      name: 'Nighttime',
      skyGradient: ['#0b132b', '#1c2541', '#3a506b'],
      groundColor: '#2b2d42',
      groundPatternColor: '#4895ef',
      pipeColor: '#3a0ca3',
      pipeBorder: '#4cc9f0',
      pipeCapColor: '#4361ee',
      cloudColor: 'rgba(255, 255, 255, 0.25)',
      buildingColor: 'rgba(28, 37, 65, 0.6)',
      accentColor: '#4cc9f0'
    },
    SUNSET: {
      name: 'Sunset Glow',
      skyGradient: ['#2b1055', '#7597de', '#ff7e5f'],
      groundColor: '#d4a373',
      groundPatternColor: '#e76f51',
      pipeColor: '#e76f51',
      pipeBorder: '#9b2226',
      pipeCapColor: '#f4a261',
      cloudColor: 'rgba(255, 200, 180, 0.5)',
      buildingColor: 'rgba(75, 40, 90, 0.4)',
      accentColor: '#f4a261'
    },
    CYBERPUNK: {
      name: 'Cyberpunk Neon',
      skyGradient: ['#03071e', '#0d0221', '#0f0826'],
      groundColor: '#12092b',
      groundPatternColor: '#ff007f',
      pipeColor: '#00f5d4',
      pipeBorder: '#ff007f',
      pipeCapColor: '#7b2cbf',
      cloudColor: 'rgba(255, 0, 127, 0.2)',
      buildingColor: 'rgba(0, 245, 212, 0.1)',
      accentColor: '#00f5d4'
    }
  };

  private bgOffset = 0;
  private wingFrame = 0;
  private wingTimer = 0;

  // Weather System State
  private weatherParticles: WeatherParticle[] = [];
  private weatherInitialized = false;

  /**
   * Main render method
   */
  public render(
    ctx: CanvasRenderingContext2D,
    themeOrEngine: ThemeType | any,
    birds?: BirdState[],
    localBirdId?: string,
    pipes?: PipeState[],
    particles?: ParticleSystem,
    status?: string,
    countdownVal?: number | null,
    weather: WeatherType = 'NONE',
    pipeStyle: PipeStyle = 'CLASSIC'
  ): void {
    if (themeOrEngine && typeof themeOrEngine === 'object' && 'bird' in themeOrEngine) {
      const engine = themeOrEngine;
      const birdState: BirdState = {
        id: 'local',
        nickname: 'Player',
        x: engine.bird.x,
        y: engine.bird.y,
        vy: engine.bird.vy,
        rotation: engine.bird.rotation,
        score: engine.score,
        pipesPassed: engine.score,
        timeSurvivedSeconds: Math.floor((engine.playTimeMs || 0) / 1000),
        isAlive: engine.state !== 'GAMEOVER',
        color: '#FFD700'
      };

      const dummyParticles = particles || new ParticleSystem();
      return this.render(
        ctx,
        'DAY',
        [birdState],
        'local',
        (engine.pipes || []) as PipeState[],
        dummyParticles,
        engine.state || 'IDLE',
        null,
        'NONE',
        'CLASSIC'
      );
    }

    const theme = (typeof themeOrEngine === 'string' ? themeOrEngine : 'DAY') as ThemeType;
    const config = CanvasRenderer.THEMES[theme] || CanvasRenderer.THEMES.DAY;
    const W = PhysicsEngine.CANVAS_WIDTH;
    const H = PhysicsEngine.CANVAS_HEIGHT;

    // 1. Draw Sky Background Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, config.skyGradient[0]);
    skyGrad.addColorStop(0.5, config.skyGradient[1]);
    skyGrad.addColorStop(1, config.skyGradient[2]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Update background scroll offset if playing
    if (status === 'PLAYING') {
      this.bgOffset = (this.bgOffset + 1.2) % W;
      this.wingTimer++;
      if (this.wingTimer % 6 === 0) {
        this.wingFrame = (this.wingFrame + 1) % 3;
      }
    }

    // 2. Draw Parallax Background (Clouds & Cityscape)
    this.drawCityscape(ctx, W, H, config);
    this.drawClouds(ctx, W, config);

    // 3. Render Weather Effects (Rain / Snow / Fog)
    this.renderWeather(ctx, W, H, weather);

    const activePipes = pipes || [];
    const activeBirds = birds || [];
    const activeParticles = particles || new ParticleSystem();

    // 4. Draw Pipes with selected Pipe Style
    for (const pipe of activePipes) {
      this.drawPipe(ctx, pipe, H, config, pipeStyle);
    }

    // 5. Draw Ground
    this.drawGround(ctx, W, H, config);

    // 6. Draw Dead/Faded Birds first (35% opacity)
    for (const bird of activeBirds) {
      if (!bird.isAlive) {
        this.drawBird(ctx, bird, this.wingFrame);
      }
    }

    // 7. Draw Alive Birds on top (100% opacity)
    for (const bird of activeBirds) {
      if (bird.isAlive) {
        this.drawBird(ctx, bird, this.wingFrame);
      }
    }

    // 8. Draw Particle Effects & Text Popups
    this.drawParticles(ctx, activeParticles);

    // 9. Draw Countdown Overlay if active
    if (status === 'COUNTDOWN' && countdownVal !== null && countdownVal !== undefined) {
      this.drawCountdown(ctx, W, H, countdownVal);
    }
  }

  private drawCityscape(ctx: CanvasRenderingContext2D, W: number, H: number, config: ThemeConfig): void {
    ctx.fillStyle = config.buildingColor;
    const groundY = H - PhysicsEngine.GROUND_HEIGHT;
    const scroll = (this.bgOffset * 0.3) % 120;

    for (let x = -scroll; x < W + 120; x += 40) {
      const h = 50 + ((x * 37) % 90);
      ctx.fillRect(x, groundY - h, 32, h);
    }
  }

  private drawClouds(ctx: CanvasRenderingContext2D, W: number, config: ThemeConfig): void {
    ctx.fillStyle = config.cloudColor;
    const scroll = (this.bgOffset * 0.5) % (W + 200);

    const clouds = [
      { x: 60 - scroll, y: 80, r: 24 },
      { x: 280 - scroll, y: 120, r: 32 },
      { x: 480 - scroll, y: 60, r: 28 },
      { x: 680 - scroll, y: 100, r: 30 }
    ];

    for (const c of clouds) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.arc(c.x + 18, c.y - 8, c.r * 0.8, 0, Math.PI * 2);
      ctx.arc(c.x + 36, c.y, c.r * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Render Weather Effects (Rain, Snow, Fog)
   */
  private renderWeather(ctx: CanvasRenderingContext2D, W: number, H: number, weather: WeatherType): void {
    if (weather === 'NONE') return;

    if (!this.weatherInitialized || this.weatherParticles.length === 0) {
      this.weatherParticles = [];
      const count = weather === 'RAIN' ? 60 : weather === 'SNOW' ? 40 : 15;
      for (let i = 0; i < count; i++) {
        this.weatherParticles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: weather === 'RAIN' ? -1.5 : weather === 'SNOW' ? (Math.random() - 0.5) * 0.8 : 0.5,
          vy: weather === 'RAIN' ? 8 + Math.random() * 4 : weather === 'SNOW' ? 1 + Math.random() * 1.5 : 0,
          length: weather === 'RAIN' ? 10 + Math.random() * 10 : 0,
          size: weather === 'SNOW' ? 2 + Math.random() * 3 : weather === 'FOG' ? 40 + Math.random() * 30 : 1,
          alpha: weather === 'RAIN' ? 0.6 : weather === 'SNOW' ? 0.8 : 0.15
        });
      }
      this.weatherInitialized = true;
    }

    ctx.save();
    for (const p of this.weatherParticles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y > H) {
        p.y = -10;
        p.x = Math.random() * W;
      }
      if (p.x < -20) p.x = W + 10;
      if (p.x > W + 20) p.x = -10;

      if (weather === 'RAIN') {
        ctx.strokeStyle = `rgba(180, 220, 255, ${p.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx, p.y + (p.length || 10));
        ctx.stroke();
      } else if (weather === 'SNOW') {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (weather === 'FOG') {
        ctx.fillStyle = `rgba(220, 230, 240, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size || 40, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Draw Pipe with Custom Pipe Styles
   */
  private drawPipe(
    ctx: CanvasRenderingContext2D,
    pipe: PipeState,
    H: number,
    config: ThemeConfig,
    style: PipeStyle = 'CLASSIC'
  ): void {
    const playAreaHeight = H - PhysicsEngine.GROUND_HEIGHT;
    const capHeight = 26;
    const capLip = 6;

    let pipeGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
    let borderColor = config.pipeBorder;
    let capColor = config.pipeCapColor;

    if (style === 'NEON') {
      pipeGrad.addColorStop(0, '#00f5d4');
      pipeGrad.addColorStop(0.5, '#7b2cbf');
      pipeGrad.addColorStop(1, '#ff007f');
      borderColor = '#ff007f';
      capColor = '#00f5d4';
    } else if (style === 'BAMBOO') {
      pipeGrad.addColorStop(0, '#386641');
      pipeGrad.addColorStop(0.4, '#6a994e');
      pipeGrad.addColorStop(0.8, '#a7c957');
      pipeGrad.addColorStop(1, '#386641');
      borderColor = '#1a3a2a';
      capColor = '#a7c957';
    } else if (style === 'LAVA') {
      pipeGrad.addColorStop(0, '#900c3f');
      pipeGrad.addColorStop(0.5, '#c70039');
      pipeGrad.addColorStop(1, '#ff5733');
      borderColor = '#581845';
      capColor = '#ffc300';
    } else if (style === 'GOLDEN') {
      pipeGrad.addColorStop(0, '#b8860b');
      pipeGrad.addColorStop(0.3, '#ffd700');
      pipeGrad.addColorStop(0.7, '#fff8dc');
      pipeGrad.addColorStop(1, '#daa520');
      borderColor = '#8b6508';
      capColor = '#ffd700';
    } else {
      pipeGrad.addColorStop(0, config.pipeBorder);
      pipeGrad.addColorStop(0.3, config.pipeColor);
      pipeGrad.addColorStop(0.7, config.pipeCapColor);
      pipeGrad.addColorStop(1, config.pipeBorder);
    }

    // --- TOP PIPE ---
    ctx.fillStyle = pipeGrad;
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight - capHeight);
    ctx.fillRect(pipe.x - capLip, pipe.topHeight - capHeight, pipe.width + capLip * 2, capHeight);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(pipe.x - capLip, pipe.topHeight - capHeight, pipe.width + capLip * 2, capHeight);

    // --- BOTTOM PIPE ---
    const botHeight = pipe.bottomHeight ?? (playAreaHeight - (pipe.bottomY ?? (pipe.topHeight + (pipe.gap || 145))));
    const botY = playAreaHeight - botHeight;
    ctx.fillStyle = pipeGrad;
    ctx.fillRect(pipe.x, botY + capHeight, pipe.width, botHeight - capHeight);
    ctx.fillRect(pipe.x - capLip, botY, pipe.width + capLip * 2, capHeight);
    ctx.strokeRect(pipe.x - capLip, botY, pipe.width + capLip * 2, capHeight);
  }

  private drawGround(ctx: CanvasRenderingContext2D, W: number, H: number, config: ThemeConfig): void {
    const groundY = H - PhysicsEngine.GROUND_HEIGHT;

    ctx.fillStyle = config.groundColor;
    ctx.fillRect(0, groundY, W, PhysicsEngine.GROUND_HEIGHT);

    ctx.fillStyle = config.groundPatternColor;
    ctx.fillRect(0, groundY, W, 14);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    const stripeWidth = 16;
    const scroll = this.bgOffset % (stripeWidth * 2);

    for (let x = -scroll; x < W + stripeWidth * 2; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x + stripeWidth, groundY);
      ctx.lineTo(x, groundY + 14);
      ctx.fill();
    }
  }

  /**
   * Render Bird with Custom Bird Skins
   */
  private drawBird(ctx: CanvasRenderingContext2D, bird: BirdState, wingFrame: number): void {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    // Opacity is strictly based on THAT bird's individual state!
    if (!bird.isAlive) {
      ctx.globalAlpha = 0.35;
    } else {
      ctx.globalAlpha = 1.0;
    }

    const r = PhysicsEngine.BIRD_RADIUS;
    const skin: BirdSkin = bird.skin || 'CLASSIC';

    // Bird Skin Body Gradient & Colors
    let primaryColor = bird.color || '#FFD700';
    let secondaryColor = '#FF8C00';
    let eyeColor = '#FFF';

    if (skin === 'PHOENIX') {
      primaryColor = '#ff4500';
      secondaryColor = '#ffd700';
    } else if (skin === 'ROBO') {
      primaryColor = '#00e5ff';
      secondaryColor = '#37474f';
      eyeColor = '#00e5ff';
    } else if (skin === 'BLUEJAY') {
      primaryColor = '#1e88e5';
      secondaryColor = '#90caf9';
    } else if (skin === 'EAGLE') {
      primaryColor = '#4e342e';
      secondaryColor = '#ffffff';
    } else if (skin === 'BAT') {
      primaryColor = '#212121';
      secondaryColor = '#424242';
      eyeColor = '#ff1744';
    }

    // Bird Body Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.arc(2, 2, r, 0, Math.PI * 2);
    ctx.fill();

    // Bird Body Gradient
    const birdGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, r);
    birdGrad.addColorStop(0, '#FFF');
    birdGrad.addColorStop(0.4, primaryColor);
    birdGrad.addColorStop(1, secondaryColor);

    ctx.fillStyle = birdGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bird Eye
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(r * 0.4, -r * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin === 'ROBO' ? '#000' : '#000';
    ctx.beginPath();
    ctx.arc(r * 0.55, -r * 0.3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Bird Beak
    ctx.fillStyle = skin === 'BAT' ? '#424242' : '#FF4500';
    ctx.beginPath();
    ctx.moveTo(r * 0.6, -2);
    ctx.lineTo(r * 1.3, 2);
    ctx.lineTo(r * 0.6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wing Animation
    const wingOffsetY = [-6, 0, 6][wingFrame] || 0;
    ctx.fillStyle = secondaryColor;
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, wingOffsetY, 7, 4, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Draw Overhead Nickname Badge
    if (bird.nickname) {
      ctx.save();
      ctx.globalAlpha = bird.isAlive ? 0.85 : 0.35;
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#FFF';
      ctx.textAlign = 'center';

      const displayName = bird.isAlive ? bird.nickname : `${bird.nickname} (DEAD)`;
      const textWidth = ctx.measureText(displayName).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(bird.x - textWidth / 2 - 6, bird.y - 32, textWidth + 12, 16, 8);
      ctx.fill();

      ctx.fillStyle = bird.isAlive ? (bird.color || '#4cc9f0') : '#aaaaaa';
      ctx.fillText(displayName, bird.x, bird.y - 20);
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, particleSystem: ParticleSystem): void {
    for (const p of particleSystem.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const popup of particleSystem.textPopups) {
      ctx.save();
      ctx.globalAlpha = popup.alpha;
      ctx.font = `black ${Math.round(20 * popup.scale)}px sans-serif`;
      ctx.fillStyle = popup.color;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(popup.text, popup.x, popup.y);
      ctx.fillText(popup.text, popup.x, popup.y);
      ctx.restore();
    }
  }

  private drawCountdown(ctx: CanvasRenderingContext2D, W: number, H: number, val: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, W, H);

    ctx.font = '900 72px sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;

    const text = val === 0 ? 'GO!' : val.toString();
    ctx.strokeText(text, W / 2, H / 2 - 20);
    ctx.fillText(text, W / 2, H / 2 - 20);
    ctx.restore();
  }
}
