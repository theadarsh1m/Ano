import { PhysicsEngine } from './PhysicsEngine';
import { Renderer } from './Renderer';
import { Camera } from './Camera';
import { ParticleSystem } from '../systems/ParticleSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { CharacterDefinition, ColliderData } from '@/types/anigravity/character';
import { SPAWN_Y, PHYSICS_SCALE } from '../data/constants';
import { CHARACTER_DEFINITIONS } from '../data/characters';

export class GameEngine {
  private physics: PhysicsEngine;
  private renderer: Renderer;
  private camera: Camera;
  private particles: ParticleSystem | null = null;
  private audio: AudioSystem;
  
  private isRunning: boolean = false;
  private isDestroyed: boolean = false;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;

  // Active placing character (kinematic preview)
  private activeCharId: string | null = null;
  private activeCharX: number = 400;
  private activeCharAngle: number = 0;
  private activeCharDef: CharacterDefinition | null = null;
  private activeColliderData: ColliderData | null = null;

  // Track all characters
  private characterIds: string[] = [];
  private pendingCharacterIds = new Set<string>();
  private wasStable: boolean = true;

  constructor() {
    this.physics = new PhysicsEngine();
    this.renderer = new Renderer();
    this.camera = new Camera();
    this.audio = new AudioSystem();
  }

  public async init(container: HTMLElement): Promise<void> {
    await this.physics.init();
    if (this.isDestroyed) return;

    await this.renderer.init(container);
    if (this.isDestroyed) return;
    
    this.particles = new ParticleSystem(this.renderer.getWorldContainer());
    this.audio.init();

    this.isRunning = true;
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }

  private gameLoop = (timestamp: number) => {
    if (!this.isRunning) return;

    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Step physics
    this.physics.step(Math.min(dt, 0.1));

    // Synchronize physics positions to PixiJS sprites
    for (const id of this.characterIds) {
      if (id === this.activeCharId) continue; // Skip preview character

      const pos = this.physics.getBodyPosition(id);
      const rot = this.physics.getBodyRotation(id);
      
      if (pos !== null && rot !== null) {
        this.renderer.updateCharacterSprite(id, pos.x, pos.y, rot);
      }
    }

    // Update particle effects
    if (this.particles) {
      this.particles.update(dt);
    }

    // Check transition to stable (settled landing thump)
    const isStableNow = this.physics.isStable();
    if (isStableNow && !this.wasStable) {
      this.audio.playLand();
      
      // Spawn dust at bottom of the most recent character
      if (this.characterIds.length > 0) {
        const lastId = this.characterIds[this.characterIds.length - 1];
        const pos = this.physics.getBodyPosition(lastId);
        if (pos) {
          this.particles?.spawnDustEffect(pos.x, pos.y + 40);
        }
      }
    }
    this.wasStable = isStableNow;

    // Update auto-zoom camera tracking all bodies
    const positions = this.physics.getAllBodyPositions();
    if (this.activeCharId) {
      positions.push({ x: this.activeCharX, y: SPAWN_Y });
    }
    this.camera.update(this.renderer.getWorldContainer(), positions);

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  /**
   * Spawn a new block in preview mode at the top.
   */
  public async spawnPreviewCharacter(
    definition: CharacterDefinition,
    colliderData: ColliderData
  ) {
    // Clean up any existing active preview sprite to avoid leaks
    if (this.activeCharId) {
      this.renderer.removeCharacterSprite(this.activeCharId);
    }

    this.activeCharDef = definition;
    this.activeColliderData = colliderData;
    this.activeCharId = `active_${Date.now()}`;
    this.activeCharX = 400;
    this.activeCharAngle = 0;

    await this.renderer.addCharacterSprite(
      this.activeCharId,
      definition.spriteFile,
      this.activeCharX,
      SPAWN_Y,
      definition.renderScale,
      this.activeCharAngle
    );

    this.renderer.setPreviewAlpha(this.activeCharId, 0.6); // Semi-transparent preview
  }

  public movePreviewCharacter(x: number) {
    if (!this.activeCharId) return;
    this.activeCharX = Math.max(100, Math.min(700, x));
    this.renderer.updateCharacterSprite(
      this.activeCharId,
      this.activeCharX,
      SPAWN_Y,
      this.activeCharAngle
    );
  }

  public rotatePreviewCharacter(angle: number) {
    if (!this.activeCharId) return;
    this.activeCharAngle = angle;
    this.renderer.updateCharacterSprite(
      this.activeCharId,
      this.activeCharX,
      SPAWN_Y,
      this.activeCharAngle
    );
  }

  public dropCharacter(turnNumber: number): { x: number; angle: number } | null {
    if (!this.activeCharId || !this.activeCharDef || !this.activeColliderData) return null;

    const charId = `char_${turnNumber}_${this.activeCharDef.id}`;
    const x = this.activeCharX;
    const angle = this.activeCharAngle;

    this.audio.playDrop();

    // Create the physics body
    const body = this.physics.createCharacterBody(
      charId,
      this.activeColliderData,
      x,
      SPAWN_Y,
      angle,
      this.activeCharDef.renderScale,
      this.activeCharDef.physics
    );

    if (body) {
      // Remove temporary preview sprite, add real dynamic sprite
      this.renderer.removeCharacterSprite(this.activeCharId);
      
      this.renderer.addCharacterSprite(
        charId,
        this.activeCharDef.spriteFile,
        x,
        SPAWN_Y,
        this.activeCharDef.renderScale,
        angle
      );

      this.characterIds.push(charId);
      
      // Spawn flashy impact spark particles
      this.particles?.spawnImpactEffect(x, SPAWN_Y + 30, 0.8);
      this.wasStable = false; // Mark world unstable to detect next landing thump
    }

    // Reset active preview state
    this.activeCharId = null;
    this.activeCharDef = null;
    this.activeColliderData = null;

    return { x, angle };
  }

  /**
   * Spawn a character that was dropped by another player.
   */
  public async spawnDroppedCharacter(
    definition: CharacterDefinition,
    colliderData: ColliderData,
    x: number,
    angle: number,
    turnNumber: number
  ) {
    const charId = `char_${turnNumber}_${definition.id}`;

    // Prevent duplicate spawning if already loaded/loading
    if (this.characterIds.includes(charId) || this.pendingCharacterIds.has(charId)) return;
    this.pendingCharacterIds.add(charId);

    // Play drop sound locally
    this.audio.playDrop();

    const body = this.physics.createCharacterBody(
      charId,
      colliderData,
      x,
      SPAWN_Y,
      angle,
      definition.renderScale,
      definition.physics
    );

    if (body) {
      try {
        await this.renderer.addCharacterSprite(
          charId,
          definition.spriteFile,
          x,
          SPAWN_Y,
          definition.renderScale,
          angle
        );
        this.characterIds.push(charId);
        this.particles?.spawnImpactEffect(x, SPAWN_Y + 30, 0.8);
        this.wasStable = false;
      } catch (err) {
        console.error('[GameEngine] Error rendering dropped sprite:', err);
      }
    }
    this.pendingCharacterIds.delete(charId);
  }

  public async syncPositions(droppedList: { characterId: string; turnNumber: number; x?: number; y?: number; angle?: number }[]) {
    // Sync final positions and spawn any missing bodies (e.g. for late joiners or missed events)
    for (const char of droppedList) {
      if (char.x === undefined || char.y === undefined || char.angle === undefined) continue;
      const charId = `char_${char.turnNumber}_${char.characterId}`;
      
      if (!this.characterIds.includes(charId)) {
        if (this.pendingCharacterIds.has(charId)) continue;
        this.pendingCharacterIds.add(charId);

        const definition = CHARACTER_DEFINITIONS.find((c) => c.id === char.characterId);
        if (definition) {
          try {
            const absoluteUrl = window.location.origin + definition.colliderFile;
            const res = await fetch(absoluteUrl);
            const colliderData = await res.json();
            
            // Double check inside lock/fetch resolver to avoid race condition
            if (this.characterIds.includes(charId)) {
              this.pendingCharacterIds.delete(charId);
              continue;
            }

            const body = this.physics.createCharacterBody(
              charId,
              colliderData,
              char.x,
              char.y,
              char.angle,
              definition.renderScale,
              definition.physics
            );
            
            if (body) {
              // Zero out local velocities to match stabilized server state
              body.setLinvel({ x: 0, y: 0 }, true);
              body.setAngvel(0, true);
              
              await this.renderer.addCharacterSprite(
                charId,
                definition.spriteFile,
                char.x,
                char.y,
                definition.renderScale,
                char.angle
              );
              this.characterIds.push(charId);
            }
          } catch (e) {
            console.error('[GameEngine] Error sync-spawning missing character:', e);
          } finally {
            this.pendingCharacterIds.delete(charId);
          }
        } else {
          this.pendingCharacterIds.delete(charId);
        }
      } else {
        // Sync both physics body state and renderer representation
        this.physics.syncBodyState(charId, char.x, char.y, char.angle);
        this.renderer.updateCharacterSprite(charId, char.x, char.y, char.angle);
      }
    }
  }

  public isStable(): boolean {
    return this.physics.isStable();
  }

  public playEliminationSound() {
    this.audio.playElimination();
  }

  public playVictorySound() {
    this.audio.playVictory();
  }

  public playClickSound() {
    this.audio.playClick();
  }

  public destroy() {
    this.isDestroyed = true;
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.physics.destroy();
    this.renderer.destroy();
    if (this.particles) {
      this.particles.destroy();
      this.particles = null;
    }
    this.characterIds = [];
  }
}
