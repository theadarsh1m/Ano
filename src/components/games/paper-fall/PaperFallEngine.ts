// ═══════════════════════════════════════════════════════════
// PaperFall — Client-Side Game Engine
// Deterministic simulation with seeded RNG for multiplayer sync
// ═══════════════════════════════════════════════════════════

import {
  type GameMode,
  type GameState,
  type PaperFallWord,
  type BombFragment,
  type GameFx,
  type Difficulty,
  type WpmSample,
  type MatchDuration,
  DIFFICULTY_CONFIGS,
  CAMPAIGN_LEVELS,
} from './types';

import wordsJson from '../../../../words.json';

// ── Word Pool (Integrated with words.json) ────────────────
const EXTRACTED_WORDS: string[] = [];
if (wordsJson && typeof wordsJson === 'object' && 'categories' in wordsJson) {
  const cats = (wordsJson as { categories: Record<string, string[]> }).categories;
  for (const list of Object.values(cats)) {
    if (Array.isArray(list)) {
      for (const w of list) {
        if (typeof w === 'string' && w.trim().length >= 3 && !w.includes(' ')) {
          EXTRACTED_WORDS.push(w.trim().toLowerCase());
        }
      }
    }
  }
}

const FALLBACK_WORDS = [
  "oak","tide","rust","moth","wren","fern","plum","jolt","kiln","husk",
  "ant","dew","fog","gem","ivy","jam","keg","lip","map","net",
  "hello","spark","lunar","glass","drift","flint","amber","cliff","brisk","nomad",
  "vault","quilt","prism","storm","cedar","novel","quiet","blaze","ember","zesty",
  "flame","grove","pearl","swirl","charm","dizzy","froze","glyph","hymns","jazzy",
  "gravity","cascade","lantern","thunder","harvest","monsoon","quantum",
  "bramble","orbital","pelican","sandbox","vertigo","whisper","juniper","kestrel",
  "mariner","compass","furnace","glacier","typhoon","kingdom","blossom",
  "elephant","marigold","sapphire","obsidian","keyboard","velocity","twilight",
  "cinnamon","umbrella","zeppelin","flamingo","blueprint","cartwheel","yardstick",
  "parachute","dandelion","hurricane","metronome","lighthouse","wavelength",
  "avalanche","butterfly","crocodile","dragonfly","evergreen","fireworks",
];

const WORDS = Array.from(new Set([...EXTRACTED_WORDS, ...FALLBACK_WORDS]));

// ── Seeded RNG ───────────────────────────────────────────
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Engine Class ─────────────────────────────────────────
export class PaperFallEngine {
  state: GameState;
  fx: GameFx;
  difficulty: Difficulty;
  isMultiplayer: boolean;
  matchDuration: number; // seconds, 0 = infinite (solo)
  mode: GameMode;

  private uid = 1;
  private fragUid = 10000;

  // Callbacks
  onScoreUpdate?: (score: number) => void;
  onLevelUp?: (level: number) => void;
  onWordTyped?: (wordText: string, score: number) => void;
  onGameOver?: (finalScore: number, stats: {
    wpm: number;
    accuracy: number;
    wordsTyped: number;
    errors: number;
    level: number;
    wpmHistory: WpmSample[];
    timeSurvived: number;
    victory?: boolean;
  }) => void;
  onBombExplode?: (wordId: number, x: number, y: number) => void;
  onProgressUpdate?: (data: {
    score: number;
    wpm: number;
    accuracy: number;
    level: number;
    wordsTyped: number;
  }) => void;

  constructor() {
    this.mode = 'SURVIVAL';
    this.difficulty = 'MEDIUM';
    this.isMultiplayer = false;
    this.matchDuration = 0;
    this.state = this.newGameState();
    this.fx = this.newFx();
  }

  private newFx(): GameFx {
    return {
      balls: [], chips: [], sparks: [], smoke: [],
      flashes: [], pops: [], shake: 0, timeScale: 1,
    };
  }

  newGameState(seed?: number): GameState {
    const s = seed ?? (Date.now() & 0x7fffffff);
    return {
      phase: 'idle',
      seed: s,
      rand: mulberry32(s),
      t: 0,
      spawnIn: 0.5,
      words: [],
      fragments: [],
      locked: null,
      score: 0,
      cleared: 0,
      combo: 0,
      typed: 0,
      missed: 0,
      level: 1,
      speed: 1,
      culprit: '',
      dieClock: 0,
      wpmHistory: [],
      lastWpmSample: 0,
      matchTimeRemaining: this.matchDuration > 0 ? this.matchDuration : undefined,
      matchDuration: this.matchDuration > 0 ? this.matchDuration : undefined,
      matchStartTime: Date.now(),
      mode: this.mode,
      difficulty: this.difficulty,
      wordsSpawnedThisLevel: 0,
    };
  }

  get config() {
    if (this.mode === 'CAMPAIGN') {
      return CAMPAIGN_LEVELS[Math.min(9, this.state.level - 1)];
    }
    return DIFFICULTY_CONFIGS[this.difficulty];
  }

  // ── Game lifecycle ──────────────────────────────────────

  start(seed?: number, startTime?: number) {
    this.uid = 1;
    this.fragUid = 10000;
    this.state = this.newGameState(seed);
    if (startTime) {
      this.state.matchStartTime = startTime;
    }
    this.state.phase = 'play';
    this.fx = this.newFx();
  }

  pause() {
    if (this.state.phase === 'play') this.state.phase = 'paused';
  }

  resume() {
    if (this.state.phase === 'paused') this.state.phase = 'play';
  }

  // ── Word spawning ──────────────────────────────────────

  private getWordPool(): string[] {
    const cfg = this.config;
    return WORDS.filter(
      (w) => w.length >= cfg.wordLengthMin && w.length <= cfg.wordLengthMax
    );
  }

  spawn(): PaperFallWord | null {
    const S = this.state;
    const cfg = this.config;
    const pool = this.getWordPool();
    if (!pool.length) return null;

    if (this.mode === 'CAMPAIGN') {
      const cConfig = cfg as typeof CAMPAIGN_LEVELS[0];
      if ((S.wordsSpawnedThisLevel ?? 0) >= cConfig.wordsToClear) {
        return null;
      }
    }

    // Avoid duplicate starting letters on screen
    const busy = new Set(
      S.words.filter((w) => !w.doomed && w.typed === 0).map((w) => w.text[0])
    );
    let text = pool[Math.floor(S.rand() * pool.length)];
    for (let i = 0; i < 16 && (busy.has(text[0]) || S.words.some((w) => w.text === text)); i++) {
      text = pool[Math.floor(S.rand() * pool.length)];
    }

    const isBomb = cfg.bombWordChance > 0 && S.rand() < cfg.bombWordChance;
    const bombTimer = isBomb
      ? cfg.bombTimerRange[0] + S.rand() * (cfg.bombTimerRange[1] - cfg.bombTimerRange[0])
      : 0;

    const w: PaperFallWord = {
      id: this.uid++,
      text,
      typed: 0,
      doomed: false,
      dead: false,
      x: 0.5,
      y: -0.07,
      vy: (0.058 + S.rand() * 0.022) * S.speed * cfg.fallSpeedMult,
      phase: S.rand() * 6.283,
      swing: 0.5 + S.rand(),
      tilt: (S.rand() - 0.5) * 0.14,
      hit: 0,
      isBomb,
      bombTimer: isBomb ? bombTimer : undefined,
      bombExploded: false,
      bombFlash: 0,
    };

    // Spread words horizontally
    let best = 0.5, bestGap = -1;
    for (let i = 0; i < 10; i++) {
      const cand = 0.08 + S.rand() * 0.84;
      let gap = 1;
      for (const o of S.words) if (o.y < 0.45) gap = Math.min(gap, Math.abs(o.x - cand));
      if (gap > bestGap) { bestGap = gap; best = cand; }
      if (gap > 0.22) break;
    }
    w.x = best;
    S.words.push(w);
    if (this.mode === 'CAMPAIGN') {
      S.wordsSpawnedThisLevel = (S.wordsSpawnedThisLevel ?? 0) + 1;
    }
    return w;
  }

  // ── Bomb explosion ─────────────────────────────────────

  private explodeBomb(word: PaperFallWord) {
    const S = this.state;
    word.bombExploded = true;
    word.doomed = true;

    if (S.locked === word.id) {
      S.locked = null;
    }

    // Create a fragment for each untyped letter
    const remainingChars = word.text.slice(word.typed);
    for (let i = 0; i < remainingChars.length; i++) {
      const angle = (Math.PI * 2 * i) / remainingChars.length + (S.rand() - 0.5) * 0.5;
      const speed = 0.15 + S.rand() * 0.25;
      const frag: BombFragment = {
        id: this.fragUid++,
        char: remainingChars[i],
        x: word.x + (S.rand() - 0.5) * 0.02,
        y: word.y + (S.rand() - 0.5) * 0.02,
        vx: Math.cos(angle) * speed * 0.3,
        vy: -0.08 - S.rand() * 0.12, // initial upward burst
        vy0: -0.08 - S.rand() * 0.12,
        typed: false,
        dead: false,
        rot: S.rand() * 6.283,
        vr: (S.rand() - 0.5) * 8,
        bw: 0,
        bh: 0,
        life: 8 + S.rand() * 4, // fragments last a while
      };
      S.fragments.push(frag);
    }

    // Signal for visual explosion
    this.onBombExplode?.(word.id, word.x, word.y);
    word.dead = true;
  }

  // ── Input handling ─────────────────────────────────────

  handleChar(raw: string): number | false {
    const ch = raw.toLowerCase();
    if (!/^[a-z]$/.test(ch)) return false;

    const S = this.state;
    if (S.phase === 'idle' || S.phase === 'over') return false;
    if (S.phase !== 'play') return false;

    // Try to match a bomb fragment first (they're urgent)
    const frag = S.fragments.find((f) => !f.typed && !f.dead && f.char.toLowerCase() === ch);
    if (frag && S.locked === null) {
      frag.typed = true;
      frag.dead = true;
      S.typed++;
      S.combo++;
      S.cleared++;
      const gain = Math.round(15 * (1 + Math.min(S.combo, 30) * 0.04));
      S.score += gain;
      this.onScoreUpdate?.(Math.round(S.score));
      return frag.id;
    }

    // Regular word matching
    let w: PaperFallWord | undefined = S.locked != null
      ? S.words.find((v) => v.id === S.locked)
      : undefined;

    if (!w) {
      const cands = S.words.filter(
        (v) => !v.doomed && v.typed === 0 && v.text[0] === ch
      );
      if (!cands.length) {
        // Check fragments
        if (frag) {
          frag.typed = true;
          frag.dead = true;
          S.typed++;
          S.combo++;
          return frag.id;
        }
        this.whiff();
        return false;
      }
      w = cands.reduce((a, b) => (b.y > a.y ? b : a)); // lowest = most urgent
      S.locked = w.id;
    }

    if (w.text[w.typed] !== ch) {
      this.whiff();
      return false;
    }

    w.typed++;
    w.hit = 1;
    S.typed++;
    S.combo++;

    const done = w.typed === w.text.length;
    if (done) {
      w.doomed = true;
      S.locked = null;
      S.cleared++;
      const mult = 1 + Math.min(S.combo, 30) * 0.04;
      const gain = Math.round((20 + w.text.length * 13) * mult * (1 + S.level * 0.08));
      S.score += gain;
      this.onScoreUpdate?.(Math.round(S.score));
      this.onWordTyped?.(w.text, gain);
      return w.id;
    } else {
      // Hits nudge word up slightly
      w.y = Math.max(-0.06, w.y - 0.005);
    }

    return w.id;
  }

  private whiff() {
    this.state.missed++;
    this.state.combo = 0;
  }

  // ── Simulation step ────────────────────────────────────

  step(dt: number) {
    const S = this.state;
    const cfg = this.config;

    if (S.phase === 'dying') {
      S.dieClock -= dt;
      if (S.dieClock <= 0) this.gameOver();
    }

    const live = S.phase === 'play';

    if (live) {
      S.t += dt;

      // Time-based match countdown
      if (S.matchTimeRemaining !== undefined) {
        S.matchTimeRemaining -= dt;
        if (S.matchTimeRemaining <= 0) {
          S.matchTimeRemaining = 0;
          this.state.phase = 'over';
          this.gameOver(true);
        }
      }

      if (this.mode === 'SURVIVAL') {
        S.level = Math.min(12, 1 + Math.floor(S.t / 24));
      } else {
        // CAMPAIGN mode level progression
        const cConfig = this.config as typeof CAMPAIGN_LEVELS[0];
        const spawnedAll = (S.wordsSpawnedThisLevel ?? 0) >= cConfig.wordsToClear;
        const screenClear = S.words.filter(w => !w.doomed && !w.dead).length === 0;

        if (spawnedAll && screenClear) {
          S.wordsSpawnedThisLevel = 0;
          if (S.level < 10) {
            S.level++;
            S.spawnIn = 2.0; // Wait 2s before spawning next level
          } else {
            // Cleared level 10! Win!
            this.state.phase = 'over';
            this.gameOver(true);
            return;
          }
        }
      }
      S.speed = 1 + S.t * cfg.speedIncrease;
      S.score += dt * (4 + S.level * 2);

      // Spawn words
      S.spawnIn -= dt;
      if (S.spawnIn <= 0 && S.words.filter(w => !w.doomed).length < cfg.maxWords) {
        this.spawn();
        S.spawnIn = Math.max(0.7, cfg.spawnInterval / S.speed) * (0.8 + S.rand() * 0.45);
      }

      // WPM sampling (every second)
      if (S.t - S.lastWpmSample >= 1.0) {
        S.lastWpmSample = S.t;
        S.wpmHistory.push({ time: Math.floor(S.t), wpm: this.getWpm() });
      }

      // Progress callback (every 0.5s for multiplayer)
      if (this.isMultiplayer && Math.floor(S.t * 2) > Math.floor((S.t - dt) * 2)) {
        this.onProgressUpdate?.({
          score: Math.round(S.score),
          wpm: this.getWpm(),
          accuracy: this.getAccuracy(),
          level: S.level,
          wordsTyped: S.cleared,
        });
      }

      // Level up callback
      const prevLevel = Math.min(12, 1 + Math.floor((S.t - dt) / 24));
      if (S.level > prevLevel) {
        this.onLevelUp?.(S.level);
      }
    }

    // Update words
    for (const w of S.words) {
      if (live) {
        w.y += w.vy * dt;
      } else if (S.phase === 'dying') {
        w.y += w.vy * dt * 0.12;
      }
      w.phase += dt * w.swing;
      w.hit = Math.max(0, w.hit - dt * 5);

      // Bomb timer countdown
      if (live && w.isBomb && !w.bombExploded && !w.doomed) {
        w.bombTimer = (w.bombTimer ?? 0) - dt;
        w.bombFlash = (w.bombFlash ?? 0) + dt;
        if (w.bombTimer! <= 0) {
          this.explodeBomb(w);
        }
      }

      // Ground collision (Any mode — word hitting ground kills you)
      // w.y >= 0.99 ensures it visually reaches the baseline
      if (live && !w.doomed && w.y >= 0.99) {
        this.crash(w);
      }
    }

    // Update bomb fragments
    for (const f of S.fragments) {
      if (f.dead) continue;
      f.vy += 0.15 * dt; // gravity
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      f.life -= dt;
      f.vx *= 0.995;

      // Fragment hits ground
      if (f.y >= 0.93) {
        f.dead = true;
        if (!f.typed) {
          if (!this.isMultiplayer) {
            // In solo, a fragment hitting ground is a miss but doesn't kill
            S.missed++;
          } else {
            S.missed++;
          }
        }
      }
      if (f.life <= 0) f.dead = true;
    }

    // Clean up dead words and fragments
    S.words = S.words.filter((w) => !w.dead);
    S.fragments = S.fragments.filter((f) => !f.dead);
  }

  private crash(w: PaperFallWord) {
    const S = this.state;
    S.phase = 'dying';
    S.dieClock = 0.85;
    S.culprit = w.text;
    S.locked = null;
    w.doomed = true;
    this.fx.timeScale = 0.32;
  }

  private gameOver(victory: boolean = false) {
    const S = this.state;
    S.phase = 'over';
    this.fx.timeScale = 1;

    this.onGameOver?.(Math.round(S.score), {
      wpm: this.getWpm(),
      accuracy: this.getAccuracy(),
      wordsTyped: S.cleared,
      errors: S.missed,
      level: S.level,
      wpmHistory: [...S.wpmHistory],
      timeSurvived: S.t,
      victory,
    });
  }

  // ── Helpers ────────────────────────────────────────────

  getWpm(): number {
    const S = this.state;
    return S.t > 2 ? Math.round((S.typed / 5) / (S.t / 60)) : 0;
  }

  getAccuracy(): number {
    const S = this.state;
    const tot = S.typed + S.missed;
    return tot ? Math.round((S.typed / tot) * 100) : 100;
  }

  getComboMultiplier(): number {
    return 1 + Math.min(this.state.combo, 30) * 0.04;
  }

  getTimeRemaining(): number | undefined {
    return this.state.matchTimeRemaining;
  }

  getProgress(): number {
    if (!this.state.matchDuration) return 0;
    const elapsed = this.state.matchDuration - (this.state.matchTimeRemaining ?? 0);
    return Math.min(1, elapsed / this.state.matchDuration);
  }
}
