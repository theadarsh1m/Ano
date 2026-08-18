// ═══════════════════════════════════════════════════════════
// Arrow Maze — Type Definitions & Level Configurations
// ═══════════════════════════════════════════════════════════

export type ArrowDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type MultiplayerMode = 'LEVELS' | 'TIMED';
export type TimedDuration = 60 | 180 | 300 | 600; // 1min, 3min, 5min, 10min
export type LevelCount = 5 | 10 | 15 | 20;

export interface Point {
  r: number;
  c: number;
}

export interface Arrow {
  id: number;
  path: Point[]; // Sequence of points from tail (index 0) to head (index length - 1)
  direction: ArrowDirection; // Direction the head is pointing
  isCleared: boolean;
  isAnimating: boolean;
  isShaking: boolean;  // wrong-click feedback
  isBlocked: boolean;  // highlighted as blocking
  clearOrder: number;  // used during generation: which step clears this arrow
}

export interface LevelConfig {
  level: number;
  gridRows: number;
  gridCols: number;
  arrowCount: number;
  lives: number;
  hintCount: number;
}

// Generate progressive level configs (50 levels)
function generateLevelConfigs(): LevelConfig[] {
  const levels: LevelConfig[] = [];
  for (let i = 1; i <= 100; i++) {
    let rows: number, cols: number, arrowCount: number;
    
    if (i <= 3) {
      // Tutorial levels: small grid, few arrows
      rows = 4;
      cols = 4;
      arrowCount = 4 + (i - 1) * 3;
    } else if (i <= 10) {
      // Easy levels
      rows = 5;
      cols = 5;
      arrowCount = 12 + (i - 3) * 2;
    } else if (i <= 20) {
      // Medium levels
      rows = 6;
      cols = 6;
      arrowCount = 20 + (i - 10) * 2;
    } else if (i <= 40) {
      // Hard levels
      rows = 7;
      cols = 7;
      arrowCount = 35 + Math.floor((i - 20) * 1.5);
    } else {
      // Expert levels (cap at 8x8 for visual clarity)
      rows = 8;
      cols = 8;
      arrowCount = 50 + (i - 40);
    }
    
    // Ensure arrow count doesn't exceed grid capacity (95% density)
    arrowCount = Math.min(arrowCount, Math.floor(rows * cols * 0.95));
    
    levels.push({
      level: i,
      gridRows: rows,
      gridCols: cols,
      arrowCount,
      lives: 3,
      hintCount: i <= 5 ? 3 : i <= 15 ? 2 : 1,
    });
  }
  return levels;
}

export const LEVEL_CONFIGS: LevelConfig[] = generateLevelConfigs();

export function getLevelConfig(level: number): LevelConfig {
  if (level <= 0) return LEVEL_CONFIGS[0];
  if (level > LEVEL_CONFIGS.length) {
    // Generate on-the-fly for levels beyond 100
    const base = LEVEL_CONFIGS[LEVEL_CONFIGS.length - 1];
    const extra = level - LEVEL_CONFIGS.length;
    return {
      level,
      gridRows: Math.min(12, base.gridRows + Math.floor(extra / 15)),
      gridCols: Math.min(12, base.gridCols + Math.floor(extra / 15)),
      arrowCount: Math.min(130, base.arrowCount + extra),
      lives: 3,
      hintCount: 1,
    };
  }
  return LEVEL_CONFIGS[level - 1];
}

// ── Scoring ─────────────────────────────────────────────

export interface ScoreBreakdown {
  arrowPoints: number;
  timeBonus: number;
  streakBonus: number;
  lifeBonus: number;
  total: number;
}

export function calculateLevelScore(
  level: number,
  arrowsCleared: number,
  timeElapsedMs: number,
  streak: number,
  livesRemaining: number,
): ScoreBreakdown {
  const arrowPoints = arrowsCleared * (10 + level * 2);
  // Time bonus: max 500 for under 5 seconds, decaying
  const timeSec = timeElapsedMs / 1000;
  const timeBonus = Math.max(0, Math.round(500 * Math.max(0, 1 - timeSec / (30 + level * 2))));
  const streakBonus = streak * 15;
  const lifeBonus = livesRemaining * 50;
  
  return {
    arrowPoints,
    timeBonus,
    streakBonus,
    lifeBonus,
    total: arrowPoints + timeBonus + streakBonus + lifeBonus,
  };
}

// ── Multiplayer Types ───────────────────────────────────

export interface ArrowMazePlayer {
  userId: string;
  nickname: string;
  avatar?: string | null;
  isReady: boolean;
  isHost: boolean;
  role?: string;
  status?: 'WAITING' | 'READY' | 'PLAYING' | 'FINISHED' | 'RETURNED_TO_LOBBY';
  score?: number;
  currentLevel?: number;
  levelsCleared?: number;
  livesRemaining?: number;
  rank?: number;
}

export interface ArrowMazeMatchStats {
  userId: string;
  nickname: string;
  avatar?: string | null;
  rank: number;
  score: number;
  levelsCleared: number;
  totalArrowsCleared: number;
  totalMistakes: number;
  avgTimePerLevel: number;    // ms
  fastestLevel: number;       // ms
  finishedAt?: number;
}

export interface ArrowMazeRoomState {
  id: string;
  hostId: string;
  gameType: 'ARROW_MAZE';
  status: 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';
  players: ArrowMazePlayer[];
  seed: number;
  startTime: number | null;
  countdownValue: number | null;
  settings: {
    multiplayerMode: MultiplayerMode;
    levelCount: LevelCount;
    timedDuration: TimedDuration;
    deadTimeLimit: number;    // seconds per level (level mode)
    maxPlayers: number;
  };
  results?: ArrowMazeMatchStats[];
}

// ── Solo Stats Types ────────────────────────────────────

export interface ArrowMazeSoloStats {
  currentLevel: number;
  highScore: number;
  totalScore: number;
  levelsCleared: number;
  totalArrowsCleared: number;
  gamesPlayed: number;
}

export interface ArrowMazeMultiStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  highScore: number;
  levelsCleared: number;
}
