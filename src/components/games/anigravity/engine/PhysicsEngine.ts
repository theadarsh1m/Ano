import type RAPIER_TYPE from '@dimforge/rapier2d-compat';
import { ColliderData, PhysicsProfile, ColliderVertex } from '@/types/anigravity/character';
import {
  PHYSICS_SCALE,
  GRAVITY,
  PLATFORM_Y,
  PLATFORM_WIDTH,
  PLATFORM_HEIGHT,
  STABILITY_LINEAR_THRESHOLD,
  STABILITY_ANGULAR_THRESHOLD
} from '../data/constants';

let rapierInitPromise: Promise<void> | null = null;

export class PhysicsEngine {
  private rapier: typeof RAPIER_TYPE | null = null;
  private world: RAPIER_TYPE.World | null = null;
  private platformBody: RAPIER_TYPE.RigidBody | null = null;
  private bodiesMap = new Map<string, RAPIER_TYPE.RigidBody>(); // key: id -> Body

  /**
   * Initializes the Rapier WASM module client-side.
   */
  public async init(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    // Dynamic import to prevent next.js SSR from compiling WASM on server
    const RAPIER = await import('@dimforge/rapier2d-compat');
    if (!rapierInitPromise) {
      rapierInitPromise = RAPIER.init();
    }
    await rapierInitPromise;
    
    this.rapier = RAPIER;
    this.world = new RAPIER.World(GRAVITY);
    this.bodiesMap.clear();

    this.createPlatform();
  }

  private createPlatform() {
    if (!this.world || !this.rapier) return;

    const platformX = 400 * PHYSICS_SCALE; // Center platform horizontally
    const platformY = PLATFORM_Y * PHYSICS_SCALE;
    const halfWidth = (PLATFORM_WIDTH / 2) * PHYSICS_SCALE;
    const halfHeight = (PLATFORM_HEIGHT / 2) * PHYSICS_SCALE;

    const bodyDesc = this.rapier.RigidBodyDesc.fixed()
      .setTranslation(platformX, platformY);
    this.platformBody = this.world.createRigidBody(bodyDesc);

    const colliderDesc = this.rapier.ColliderDesc.cuboid(halfWidth, halfHeight)
      .setFriction(1.0)
      .setRestitution(0.0);
    this.world.createCollider(colliderDesc, this.platformBody);
  }

  /**
   * Creates a dynamic body with compound convex colliders from JSON.
   */
  public createCharacterBody(
    id: string,
    colliderData: ColliderData,
    x: number,
    y: number,
    angle: number,
    scale: number, // renderScale
    physics: PhysicsProfile
  ): RAPIER_TYPE.RigidBody | null {
    if (!this.world || !this.rapier) return null;

    const spawnX = x * PHYSICS_SCALE;
    const spawnY = y * PHYSICS_SCALE;

    // Create dynamic body
    const bodyDesc = this.rapier.RigidBodyDesc.dynamic()
      .setTranslation(spawnX, spawnY)
      .setRotation(angle)
      .setCcdEnabled(true);
    
    const rigidBody = this.world.createRigidBody(bodyDesc);
    rigidBody.setLinearDamping(physics.linearDamping);
    rigidBody.setAngularDamping(physics.angularDamping);

    let collidersAttached = 0;

    // Attach each convex sub-polygon
    for (const polygon of colliderData.colliders) {
      // Flatten vertices and scale to physics units
      const flatVerts = new Float32Array(
        polygon.flatMap((v: ColliderVertex) => [
          v.x * scale * PHYSICS_SCALE,
          v.y * scale * PHYSICS_SCALE
        ])
      );

      const colliderDesc = this.rapier.ColliderDesc.convexHull(flatVerts);
      if (colliderDesc) {
        colliderDesc
          .setDensity(physics.density)
          .setFriction(physics.friction)
          .setRestitution(physics.restitution)
          .setActiveEvents(this.rapier.ActiveEvents.COLLISION_EVENTS);

        this.world.createCollider(colliderDesc, rigidBody);
        collidersAttached++;
      }
    }

    if (collidersAttached > 0) {
      this.bodiesMap.set(id, rigidBody);
      return rigidBody;
    } else {
      this.world.removeRigidBody(rigidBody);
      return null;
    }
  }

  public step(dt: number) {
    if (!this.world) return;
    this.world.step();
  }

  /**
   * Check if all dynamic bodies are below stability speed thresholds.
   */
  public isStable(): boolean {
    if (this.bodiesMap.size === 0) return true;

    for (const body of this.bodiesMap.values()) {
      const linvel = body.linvel();
      const angvel = body.angvel();
      const speed = Math.sqrt(linvel.x * linvel.x + linvel.y * linvel.y);

      if (speed > STABILITY_LINEAR_THRESHOLD || Math.abs(angvel) > STABILITY_ANGULAR_THRESHOLD) {
        return false;
      }
    }
    return true;
  }

  public getBodyPosition(id: string): { x: number; y: number } | null {
    const body = this.bodiesMap.get(id);
    if (!body) return null;
    const pos = body.translation();
    return {
      x: pos.x / PHYSICS_SCALE,
      y: pos.y / PHYSICS_SCALE
    };
  }

  public getBodyRotation(id: string): number | null {
    const body = this.bodiesMap.get(id);
    if (!body) return null;
    return body.rotation();
  }

  public syncBodyState(id: string, x: number, y: number, angle: number) {
    const body = this.bodiesMap.get(id);
    if (body) {
      body.setTranslation({ x: x * PHYSICS_SCALE, y: y * PHYSICS_SCALE }, true);
      body.setRotation(angle, true);
      // Zero out velocity to settle the object at its authoritative server state
      body.setLinvel({ x: 0, y: 0 }, true);
      body.setAngvel(0, true);
    }
  }

  public removeBody(id: string) {
    const body = this.bodiesMap.get(id);
    if (body && this.world) {
      this.world.removeRigidBody(body);
      this.bodiesMap.delete(id);
    }
  }

  public getAllBodyPositions(): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    for (const body of this.bodiesMap.values()) {
      const pos = body.translation();
      positions.push({
        x: pos.x / PHYSICS_SCALE,
        y: pos.y / PHYSICS_SCALE
      });
    }
    return positions;
  }

  public destroy() {
    this.world = null;
    this.rapier = null;
    this.bodiesMap.clear();
  }
}
