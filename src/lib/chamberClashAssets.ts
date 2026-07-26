export const CHAMBER_CLASH_ASSET_VERSION = 'v1';

export const CHAMBER_CLASH_ASSETS = {
  environment: "/chamber-clash/3d/environment.glb",
  characterUpper: "/chamber-clash/3d/character-upper.glb",
  shotgun: "/chamber-clash/3d/shotgun-clean.glb",
  items: "/chamber-clash/3d/items-clean.glb",
  fpArms: "/chamber-clash/3d/fp-arms.glb",
} as const;

export type ChamberClashAssetKey = keyof typeof CHAMBER_CLASH_ASSETS;
