/** Vertex point in a collider polygon */
export interface ColliderVertex {
  x: number;
  y: number;
}

/** Single convex polygon (array of vertices in CCW order) */
export type ColliderPolygon = ColliderVertex[];

/** Raw collider JSON data loaded from file */
export interface ColliderData {
  name: string;
  width: number;
  height: number;
  colliders: ColliderPolygon[];
}

/** Physics profile for a character — affects gameplay behavior */
export interface PhysicsProfile {
  density: number;      // kg/m² — heavier characters are harder to topple but may crush
  friction: number;     // 0-1 — how much grip on surfaces
  restitution: number;  // 0-1 — bounciness on impact
  linearDamping: number;
  angularDamping: number;
}

/** Complete character definition */
export interface CharacterDefinition {
  id: string;           // Unique slug: "bombardino-crocodillo"
  displayName: string;  // Human-readable: "Bombardino Crocodillo"
  spriteFile: string;   // Path: "/sprites/Bombardino-Crocodillo.png"
  colliderFile: string; // Path: "/colliders/Bombardino-Crocodillo.json"
  physics: PhysicsProfile;
  renderScale: number;  // Scale factor to normalize sprite size for gameplay
}

/** Character instance during gameplay */
export interface CharacterInstance {
  definitionId: string;
  bodyId: number;       // Rapier rigid body handle
  spriteId: string;     // PixiJS sprite identifier
  state: CharacterState;
  droppedByPlayerId: string;
  turnNumber: number;
}

export type CharacterState = 'preview' | 'dropping' | 'settling' | 'settled' | 'eliminated';
