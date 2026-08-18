// ═══════════════════════════════════════════════════════════
// Arrow Maze — Client-Side Game Engine (Multi-cell Paths)
// Handles puzzle generation, path validation, and game logic
// ═══════════════════════════════════════════════════════════

import type {
  Arrow,
  ArrowDirection,
  LevelConfig,
  ScoreBreakdown,
  Point,
} from './types';
import { getLevelConfig, calculateLevelScore } from './types';
import { BAKED_LEVELS } from './BakedLevels';

// ── Seeded PRNG ─────────────────────────────────────────
function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) / 4294967296);
  };
}

// ── Direction Helpers ────────────────────────────────────
const DIRECTIONS: ArrowDirection[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

function getDelta(dir: ArrowDirection): [number, number] {
  switch (dir) {
    case 'UP':    return [-1, 0];
    case 'DOWN':  return [1, 0];
    case 'LEFT':  return [0, -1];
    case 'RIGHT': return [0, 1];
  }
}

// ── Engine ───────────────────────────────────────────────
export class ArrowMazeEngine {
  // Current puzzle state
  arrows: Arrow[] = [];
  gridRows: number = 0;
  gridCols: number = 0;
  currentLevel: number = 1;
  lives: number = 3;
  maxLives: number = 3;
  hintsRemaining: number = 2;
  score: number = 0;
  totalScore: number = 0;
  streak: number = 0;
  bestStreak: number = 0;
  totalArrowsCleared: number = 0;
  totalMistakes: number = 0;
  levelsCleared: number = 0;
  levelStartTime: number = 0;
  levelTimes: number[] = [];

  // Game state
  isPlaying: boolean = false;
  isLevelComplete: boolean = false;
  isGameOver: boolean = false;

  // Seed for deterministic generation
  seed: number = 0;
  private rng: () => number = () => Math.random();
  private levelSeedOffset: number = 0;

  // Callbacks
  onArrowCleared?: (arrow: Arrow) => void;
  onWrongClick?: (arrow: Arrow, blockers: Arrow[]) => void;
  onLevelComplete?: (level: number, scoreBreakdown: ScoreBreakdown) => void;
  onGameOver?: (totalScore: number, levelsCleared: number) => void;
  onLifeLost?: (livesRemaining: number) => void;
  onStateChange?: () => void;

  constructor() {}

  // ── Initialization ──────────────────────────────────────

  startLevel(level: number, seed?: number) {
    if (seed !== undefined) {
      this.seed = seed;
    }
    this.currentLevel = level;
    const config = getLevelConfig(level);
    this.lives = config.lives;
    this.maxLives = config.lives;
    this.hintsRemaining = config.hintCount;
    this.streak = 0;
    this.isLevelComplete = false;
    this.isGameOver = false;
    this.isPlaying = true;
    this.levelStartTime = Date.now();

    this.levelSeedOffset = level * 10007;
    this.rng = createRng(this.seed + this.levelSeedOffset);
    
    this.arrows = this.generatePuzzle(config);
    this.onStateChange?.();
  }

  // ── Puzzle Generation (Baked Levels) ─────────
  private generatePuzzle(config: LevelConfig): Arrow[] {
    const levelIndex = (this.currentLevel - 1) % BAKED_LEVELS.length;
    const bakedLevel = BAKED_LEVELS[levelIndex];

    this.gridRows = bakedLevel.gridRows;
    this.gridCols = bakedLevel.gridCols;

    const placed: Arrow[] = bakedLevel.arrows.map((a, i) => {
      // Reconstruct path: Head is at the end of the path array in Arrow type
      // Actually, Arrow path is [tail..., head].
      // Baked arrow has tailPositions (from head to tail tip usually, or tail tip to head).
      // Let's assume Arrow path is simply tailPositions + headPosition.
      const path: Point[] = [...a.tailPositions].reverse();
      path.push(a.headPosition);
      
      return {
        id: i,
        path: path,
        direction: a.moveDirection,
        isCleared: false,
        isAnimating: false,
        isShaking: false,
        isBlocked: false,
        clearOrder: i, 
      };
    });

    return placed;
  }

  // ── Path Checking ──────────────────────────────────────

  private isRayClear(grid: (Arrow | null)[][], rows: number, cols: number, startR: number, startC: number, dir: ArrowDirection, ignoreArrowId: number = -1): boolean {
    const [dr, dc] = getDelta(dir);
    let cr = startR + dr;
    let cc = startC + dc;
    while (cr >= 0 && cr < rows && cc >= 0 && cc < cols) {
      const occupant = grid[cr][cc];
      if (occupant !== null && occupant.id !== ignoreArrowId) {
        return false;
      }
      cr += dr;
      cc += dc;
    }
    return true;
  }

  private buildCurrentGrid(): (Arrow | null)[][] {
    const grid: (Arrow | null)[][] = Array.from({ length: this.gridRows }, () =>
      Array(this.gridCols).fill(null)
    );
    for (const arrow of this.arrows) {
      // In arrow-escape-2026, once an arrow starts moving (escaping), its occupancy is unregistered.
      if (!arrow.isCleared && !arrow.isAnimating) {
        for (const p of arrow.path) {
          grid[p.r][p.c] = arrow;
        }
      }
    }
    return grid;
  }

  /** Check if an arrow's exit path is clear (no un-cleared arrows blocking) */
  isPathClear(arrow: Arrow): boolean {
    const grid = this.buildCurrentGrid();
    const head = arrow.path[arrow.path.length - 1];
    return this.isRayClear(grid, this.gridRows, this.gridCols, head.r, head.c, arrow.direction, arrow.id);
  }

  /** Get all arrows blocking this arrow's path */
  getBlockers(arrow: Arrow): Arrow[] {
    const grid = this.buildCurrentGrid();
    const head = arrow.path[arrow.path.length - 1];
    const blockers = new Set<Arrow>();
    
    const [dr, dc] = getDelta(arrow.direction);
    let cr = head.r + dr;
    let cc = head.c + dc;
    while (cr >= 0 && cr < this.gridRows && cc >= 0 && cc < this.gridCols) {
      const occupant = grid[cr][cc];
      if (occupant !== null && occupant.id !== arrow.id) {
        blockers.add(occupant);
      }
      cr += dr;
      cc += dc;
    }
    return Array.from(blockers);
  }

  // ── Click Handling ─────────────────────────────────────

  clickArrow(arrowId: number): 'cleared' | 'blocked' | 'invalid' {
    if (!this.isPlaying || this.isLevelComplete || this.isGameOver) return 'invalid';

    const arrow = this.arrows.find(a => a.id === arrowId);
    if (!arrow || arrow.isCleared || arrow.isAnimating || arrow.isShaking) return 'invalid';

    if (this.isPathClear(arrow)) {
      // Success — arrow escapes
      arrow.isAnimating = true; // Removes it from grid occupancy immediately
      
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      this.totalArrowsCleared++;

      // Delayed clear to allow animation to finish
      setTimeout(() => {
        arrow.isCleared = true;
        arrow.isAnimating = false;
        this.onArrowCleared?.(arrow);
        this.checkLevelComplete();
        this.onStateChange?.();
      }, 500); // 500ms glide duration

      this.onStateChange?.();
      return 'cleared';
    } else {
      // Blocked — play bump animation
      const blockers = this.getBlockers(arrow);
      arrow.isShaking = true; // Serves as the "bump" trigger
      blockers.forEach(b => { b.isBlocked = true; });

      // Deduct lives
      this.totalMistakes++;
      this.streak = 0;
      this.lives = Math.max(0, this.lives - 1);
      this.onLifeLost?.(this.lives);

      if (this.lives === 0) {
        // Delay game over slightly so the bump animation plays out
        setTimeout(() => {
          this.isGameOver = true;
          this.isPlaying = false;
          // In multiplayer, 0 score / levels cleared will be overridden, but we send it locally
          this.onGameOver?.(0, this.levelsCleared); 
          this.onStateChange?.();
        }, 500);
      }

      setTimeout(() => {
        if (arrow) arrow.isShaking = false;
        blockers.forEach(b => { b.isBlocked = false; });
        this.onStateChange?.();
      }, 300); // 300ms bump duration

      this.onStateChange?.();
      return 'blocked';
    }
  }

  // ── Level Completion ───────────────────────────────────

  private checkLevelComplete() {
    const allCleared = this.arrows.every(a => a.isCleared);
    if (!allCleared) return;

    this.isLevelComplete = true;
    const timeElapsed = Date.now() - this.levelStartTime;
    this.levelTimes.push(timeElapsed);
    this.levelsCleared++;

    const arrowsInLevel = this.arrows.length;
    const scoreBreakdown = calculateLevelScore(
      this.currentLevel,
      arrowsInLevel,
      timeElapsed,
      this.bestStreak,
      this.lives,
    );

    this.score = scoreBreakdown.total;
    this.totalScore += scoreBreakdown.total;

    this.onLevelComplete?.(this.currentLevel, scoreBreakdown);
  }

  // ── Hint System ────────────────────────────────────────

  getHint(): number {
    if (this.hintsRemaining <= 0) return -1;
    for (const arrow of this.arrows) {
      if (!arrow.isCleared && !arrow.isAnimating && this.isPathClear(arrow)) {
        this.hintsRemaining--;
        return arrow.id;
      }
    }
    return -1;
  }

  hasValidMoves(): boolean {
    return this.arrows.some(a => !a.isCleared && !a.isAnimating && this.isPathClear(a));
  }

  // ── State Getters ──────────────────────────────────────

  getRemainingArrows(): number {
    return this.arrows.filter(a => !a.isCleared).length;
  }

  getProgress(): number {
    const total = this.arrows.length;
    if (total === 0) return 1;
    return (total - this.getRemainingArrows()) / total;
  }

  getAvgTimePerLevel(): number {
    if (this.levelTimes.length === 0) return 0;
    return this.levelTimes.reduce((a, b) => a + b, 0) / this.levelTimes.length;
  }

  getFastestLevel(): number {
    if (this.levelTimes.length === 0) return 0;
    return Math.min(...this.levelTimes);
  }

  // ── Reset ──────────────────────────────────────────────

  resetForNewGame() {
    this.arrows = [];
    this.totalScore = 0;
    this.totalArrowsCleared = 0;
    this.totalMistakes = 0;
    this.levelsCleared = 0;
    this.levelTimes = [];
    this.streak = 0;
    this.bestStreak = 0;
    this.isPlaying = false;
    this.isLevelComplete = false;
    this.isGameOver = false;
  }
}
