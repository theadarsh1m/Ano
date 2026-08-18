// ═══════════════════════════════════════════════════════════
// PaperFall — Type Definitions
// ═══════════════════════════════════════════════════════════

export type GameMode = 'SURVIVAL' | 'CAMPAIGN';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type MatchDuration = 60 | 180 | 300 | 600; // 1min, 3min, 5min, 10min (seconds)
export type PaperFallPhase = 'idle' | 'play' | 'paused' | 'dying' | 'over';

export interface CharMetrics {
  ch: string;
  x: number;
  w: number;
}

export interface PaperFallWord {
  id: number;
  text: string;
  typed: number;
  doomed: boolean;
  dead: boolean;
  x: number;       // 0..1 fraction
  y: number;       // 0..1 fraction
  vy: number;      // fall speed (fraction/sec)
  phase: number;   // oscillation phase
  swing: number;   // swing amplitude
  tilt: number;    // rotation offset
  hit: number;     // hit flash timer
  // Measured properties (set after measure())
  tw?: number;     // text width px
  chars?: CharMetrics[];
  bw?: number;     // box width px
  bh?: number;     // box height px
  // Bomb word properties
  isBomb?: boolean;
  bombTimer?: number;      // time until explosion (seconds)
  bombExploded?: boolean;  // has this bomb already detonated
  bombFlash?: number;      // visual pulse timer
}

export interface BombFragment {
  id: number;
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vy0: number;     // initial vertical velocity after explosion
  typed: boolean;
  dead: boolean;
  rot: number;
  vr: number;
  bw: number;
  bh: number;
  life: number;
  // For rendering
  tw?: number;
  charW?: number;
}

export interface DifficultyConfig {
  label: string;
  wordLengthMin: number;
  wordLengthMax: number;
  fallSpeedMult: number;
  maxWords: number;
  spawnInterval: number;  // base seconds between spawns
  bombWordChance: number; // 0..1
  speedIncrease: number;  // per-level multiplier
  bombTimerRange: [number, number]; // seconds before bomb explodes [min, max]
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  EASY: {
    label: 'Easy',
    wordLengthMin: 3,
    wordLengthMax: 5,
    fallSpeedMult: 0.6,
    maxWords: 4,
    spawnInterval: 3.0,
    bombWordChance: 0,
    speedIncrease: 0.008,
    bombTimerRange: [0, 0],
  },
  MEDIUM: {
    label: 'Medium',
    wordLengthMin: 4,
    wordLengthMax: 7,
    fallSpeedMult: 1.0,
    maxWords: 6,
    spawnInterval: 2.2,
    bombWordChance: 0,
    speedIncrease: 0.011,
    bombTimerRange: [0, 0],
  },
  HARD: {
    label: 'Hard',
    wordLengthMin: 5,
    wordLengthMax: 10,
    fallSpeedMult: 1.4,
    maxWords: 8,
    spawnInterval: 1.5,
    bombWordChance: 0.20,
    speedIncrease: 0.015,
    bombTimerRange: [2.5, 5.0],
  },
};

export interface CampaignLevelConfig extends DifficultyConfig {
  wordsToClear: number;
}

export const CAMPAIGN_LEVELS: CampaignLevelConfig[] = [
  { label: 'Level 1', wordLengthMin: 3, wordLengthMax: 5, fallSpeedMult: 0.5, maxWords: 3, spawnInterval: 3.5, bombWordChance: 0, speedIncrease: 0, bombTimerRange: [0, 0], wordsToClear: 10 },
  { label: 'Level 2', wordLengthMin: 3, wordLengthMax: 6, fallSpeedMult: 0.6, maxWords: 4, spawnInterval: 3.0, bombWordChance: 0, speedIncrease: 0, bombTimerRange: [0, 0], wordsToClear: 12 },
  { label: 'Level 3', wordLengthMin: 4, wordLengthMax: 7, fallSpeedMult: 0.7, maxWords: 5, spawnInterval: 2.5, bombWordChance: 0, speedIncrease: 0, bombTimerRange: [0, 0], wordsToClear: 15 },
  { label: 'Level 4', wordLengthMin: 4, wordLengthMax: 8, fallSpeedMult: 0.8, maxWords: 5, spawnInterval: 2.2, bombWordChance: 0.05, speedIncrease: 0, bombTimerRange: [4.0, 6.0], wordsToClear: 18 },
  { label: 'Level 5', wordLengthMin: 4, wordLengthMax: 8, fallSpeedMult: 0.9, maxWords: 6, spawnInterval: 2.0, bombWordChance: 0.10, speedIncrease: 0, bombTimerRange: [3.5, 5.5], wordsToClear: 20 },
  { label: 'Level 6', wordLengthMin: 5, wordLengthMax: 9, fallSpeedMult: 1.0, maxWords: 6, spawnInterval: 1.8, bombWordChance: 0.15, speedIncrease: 0, bombTimerRange: [3.0, 5.0], wordsToClear: 22 },
  { label: 'Level 7', wordLengthMin: 5, wordLengthMax: 10, fallSpeedMult: 1.1, maxWords: 7, spawnInterval: 1.6, bombWordChance: 0.20, speedIncrease: 0, bombTimerRange: [2.5, 4.5], wordsToClear: 25 },
  { label: 'Level 8', wordLengthMin: 6, wordLengthMax: 10, fallSpeedMult: 1.25, maxWords: 7, spawnInterval: 1.4, bombWordChance: 0.25, speedIncrease: 0, bombTimerRange: [2.0, 4.0], wordsToClear: 28 },
  { label: 'Level 9', wordLengthMin: 6, wordLengthMax: 11, fallSpeedMult: 1.4, maxWords: 8, spawnInterval: 1.2, bombWordChance: 0.30, speedIncrease: 0, bombTimerRange: [2.0, 3.5], wordsToClear: 32 },
  { label: 'Level 10', wordLengthMin: 7, wordLengthMax: 12, fallSpeedMult: 1.6, maxWords: 10, spawnInterval: 1.0, bombWordChance: 0.40, speedIncrease: 0, bombTimerRange: [1.5, 3.0], wordsToClear: 35 },
];

export interface WpmSample {
  time: number; // seconds since match start
  wpm: number;
}

export interface PlayerMatchStats {
  userId: string;
  nickname: string;
  avatar?: string | null;
  rank: number;
  score: number;
  wordsTyped: number;
  totalErrors: number;
  avgWpm: number;
  peakWpm: number;
  accuracy: number;         // 0..100
  levelReached: number;
  wpmTimeline: WpmSample[]; // per-second WPM history
  finishedAt?: number;      // timestamp when player finished
}

export interface PaperFallRoomState {
  id: string;
  hostId: string;
  gameType: 'PAPER_FALL';
  status: 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';
  players: PaperFallPlayer[];
  seed: number;
  startTime: number | null;
  countdownValue: number | null;
  settings: {
    mode: GameMode;
    difficulty: Difficulty;
    matchDuration: MatchDuration;
    maxPlayers: number;
  };
  results?: PlayerMatchStats[];
}

export interface PaperFallPlayer {
  userId: string;
  nickname: string;
  avatar?: string | null;
  isReady: boolean;
  isHost: boolean;
  role?: string;
  // In-match state
  status?: 'WAITING' | 'READY' | 'PLAYING' | 'FINISHED' | 'RETURNED_TO_LOBBY';
  score?: number;
  wordsTyped?: number;
  currentLevel?: number;
  wpm?: number;
  accuracy?: number;
  progress?: number; // 0..1 completion fraction
  rank?: number;
}

// FX Types for canvas rendering
export interface FxBall {
  x: number; y: number;
  target: number;
  r: number; sp: number;
  kill: boolean;
  trail: { x: number; y: number }[];
  done?: boolean;
  last?: { x: number; y: number };
}

export interface FxChip {
  x: number; y: number;
  vx: number; vy: number;
  rot: number; vr: number;
  w: number; h: number;
  col: string;
  life: number; dur: number;
}

export interface FxSpark {
  x: number; y: number;
  vx: number; vy: number;
  life: number; dur: number;
  hot: boolean;
}

export interface FxSmoke {
  x: number; y: number;
  vx: number; vy: number;
  r: number; grow: number;
  life: number; dur: number;
}

export interface FxFlash {
  x: number; y: number;
  a: number;
  life: number; dur: number;
  s: number;
}

export interface FxPop {
  x: number; y: number;
  txt: string;
  life: number; dur: number;
}

export interface GameFx {
  balls: FxBall[];
  chips: FxChip[];
  sparks: FxSpark[];
  smoke: FxSmoke[];
  flashes: FxFlash[];
  pops: FxPop[];
  shake: number;
  timeScale: number;
}

export interface GameState {
  phase: PaperFallPhase;
  seed: number;
  rand: () => number;
  t: number;
  spawnIn: number;
  words: PaperFallWord[];
  fragments: BombFragment[];
  locked: number | null;
  score: number;
  cleared: number;

  combo: number;
  typed: number;
  missed: number;
  level: number;
  speed: number;
  culprit: string;
  dieClock: number;
  // WPM tracking
  wpmHistory: WpmSample[];
  lastWpmSample: number;

  matchTimeRemaining?: number;
  matchDuration?: number;
  matchStartTime?: number;     // Absolute timestamp when match started

  mode: GameMode;
  difficulty: Difficulty;
  wordsSpawnedThisLevel?: number; // Used to track campaign level progression
}

export interface SinglePlayerStats {
  highScore: number;
  gamesPlayed: number;
  wordsTyped: number;
  timeSurvivedSeconds: number;
  averageWpm: number;
  bestWpm: number;
  averageAccuracy: number;
}

export interface MultiplayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  highScore: number;
  wordsTyped: number;
  bestWpm: number;
}

export interface MatchHistoryEntry {
  id: string;
  date: string;
  mode: 'SOLO' | 'MULTIPLAYER';
  difficulty: Difficulty;
  score: number;
  wpm: number;
  accuracy: number;
  rank?: number;
  playerCount?: number;
}
