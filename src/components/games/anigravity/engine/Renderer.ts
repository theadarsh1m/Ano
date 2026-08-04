import { Application, Container, Sprite, Graphics, Assets } from 'pixi.js';
import {
  PLATFORM_Y,
  PLATFORM_WIDTH,
  PLATFORM_HEIGHT,
  PLATFORM_COLOR,
  BG_COLOR
} from '../data/constants';
import { CHARACTER_DEFINITIONS } from '../data/characters';

export class Renderer {
  private app: Application | null = null;
  private worldContainer: Container | null = null;
  private platformGraphics: Graphics | null = null;
  private spritesMap = new Map<string, Sprite>(); // key: id -> PixiJS Sprite

  public async init(container: HTMLElement): Promise<void> {
    if (typeof window === 'undefined') return;

    this.app = new Application();
    await this.app.init({
      width: 800,
      height: 600,
      backgroundColor: BG_COLOR,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.app.canvas.style.display = 'block';
    container.appendChild(this.app.canvas);

    // Create a container to represent the zoomable/movable game world
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    this.createPlatform();

    // Sprites will be loaded dynamically on demand when spawned to prevent network choking.
  }

  private createPlatform() {
    if (!this.worldContainer) return;

    this.platformGraphics = new Graphics()
      .rect(
        400 - PLATFORM_WIDTH / 2,
        PLATFORM_Y - PLATFORM_HEIGHT / 2,
        PLATFORM_WIDTH,
        PLATFORM_HEIGHT
      )
      .fill(PLATFORM_COLOR);

    this.worldContainer.addChild(this.platformGraphics);
  }

  /**
   * Adds a sprite to the world.
   */
  public async addCharacterSprite(
    id: string,
    spritePath: string,
    x: number,
    y: number,
    scale: number,
    angle: number
  ): Promise<Sprite | null> {
    if (!this.worldContainer) return null;

    try {
      // Ensure path is absolute with origin to avoid client resolution issues
      const absolutePath = typeof window !== 'undefined' 
        ? window.location.origin + spritePath 
        : spritePath;

      // PixiJS v8 Assets loading
      console.log(`[Renderer] Loading texture: ${absolutePath}`);
      const texture = await Assets.load(absolutePath);
      console.log(`[Renderer] Texture loaded successfully: ${spritePath} (${texture.width}x${texture.height}px)`);

      const sprite = new Sprite(texture);
      
      sprite.anchor.set(0.5); // Center anchor matching our physics origin
      sprite.scale.set(scale);
      sprite.position.set(x, y);
      sprite.rotation = angle;

      this.worldContainer.addChild(sprite);
      this.spritesMap.set(id, sprite);

      return sprite;
    } catch (e) {
      console.error('[Renderer] Error loading sprite texture:', spritePath, e);
      return null;
    }
  }

  public updateCharacterSprite(id: string, x: number, y: number, rotation: number) {
    const sprite = this.spritesMap.get(id);
    if (sprite) {
      sprite.position.set(x, y);
      sprite.rotation = rotation;
    }
  }

  public removeCharacterSprite(id: string) {
    const sprite = this.spritesMap.get(id);
    if (sprite && this.worldContainer) {
      this.worldContainer.removeChild(sprite);
      this.spritesMap.delete(id);
    }
  }

  public setPreviewAlpha(id: string, alpha: number) {
    const sprite = this.spritesMap.get(id);
    if (sprite) {
      sprite.alpha = alpha;
    }
  }

  public getWorldContainer(): Container | null {
    return this.worldContainer;
  }

  public getApp(): Application | null {
    return this.app;
  }

  public resize(width: number, height: number) {
    if (this.app) {
      this.app.renderer.resize(width, height);
    }
  }

  public destroy() {
    this.spritesMap.forEach((sprite) => {
      if (this.worldContainer) {
        this.worldContainer.removeChild(sprite);
      }
    });
    this.spritesMap.clear();

    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
    this.worldContainer = null;
    this.platformGraphics = null;
  }
}
