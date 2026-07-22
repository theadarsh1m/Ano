export const FLAPPY_CONFIG = {
  // World & Canvas Dimensions
  canvasWidth: 480,
  canvasHeight: 640,
  groundHeight: 80,

  // Bird Physics Parameters
  birdX: 110,
  birdRadius: 15,
  gravity: 0.35,
  flapForce: -6.4,
  maxFallSpeed: 8.0,
  rotationSmoothing: 0.15,
  maxUpwardRotation: -Math.PI / 6, // -30 degrees
  maxDownwardRotation: Math.PI / 2.3, // ~70 degrees

  // Pipe & Obstacle Parameters
  pipeWidth: 64,
  pipeGap: 145,
  pipeSpacing: 220,
  pipeSpeed: 2.2,
  minPipeHeight: 60,

  // Visuals & Rendering
  cloudSpeed: 0.5,
  groundSpeed: 2.2,
} as const;

export type FlappyConfig = typeof FLAPPY_CONFIG;
