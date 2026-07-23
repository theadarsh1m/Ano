export type GravityDirection = 1 | -1; // 1 = DOWN, -1 = UP

export interface GameConfig {
  gravityStrength: number;     // gravity acceleration rate (pixels/sec^2)
  platformWidth: number;       // platform width (px)
  platformHeight: number;      // platform height (px)
  charSize: number;            // character radius/size (px)
  bounceAmount: number;        // restitution coefficient (0 to 1)
  friction: number;            // horizontal friction coefficient (0 to 1)
  winScore: number;            // score needed to win the match
  roundDelay: number;          // delay before starting a round (sec)
  respawnDelay: number;        // delay after death before next round (sec)
  playerColors: string[];      // list of player colors (hex codes)
  playerKeys: string[];        // list of keyboard action trigger keys
}

export interface Player {
  id: number;                  // 0 to 3
  name: string;                // "Player 1", etc.
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  rotation: number;            // Current angle in radians
  angularVelocity: number;     // Rotation speed in radians/sec
  gravityDir: GravityDirection; // Current personal gravity direction
  isGrounded: boolean;         // True if resting on platform top/bottom
  isAlive: boolean;
  score: number;
  
  // Visual squash & stretch spring variables
  squashX: number;             // current width multiplier
  squashY: number;             // current height multiplier
  squashVx: number;            // squash velocity x
  squashVy: number;            // squash velocity y
  
  // Last key pressed timestamp (for debug/input check)
  lastFlipTime: number;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}
