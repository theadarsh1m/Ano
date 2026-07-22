export type GameMode = 'SINGLEPLAYER' | 'MULTIPLAYER';

export type GameStatus = 'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export type GameState = GameStatus;

export type ThemeType = 'DAY' | 'NIGHT' | 'SUNSET' | 'CYBERPUNK';

export type BirdSkin = 'CLASSIC' | 'PHOENIX' | 'ROBO' | 'BLUEJAY' | 'EAGLE' | 'BAT';

export type WeatherType = 'NONE' | 'RAIN' | 'SNOW' | 'FOG';

export type PipeStyle = 'CLASSIC' | 'NEON' | 'BAMBOO' | 'LAVA' | 'GOLDEN';

export interface BirdState {
  id: string;
  nickname: string;
  avatar?: string | null;
  x: number;
  y: number;
  vy: number;
  rotation: number;
  score: number;
  pipesPassed: number;
  timeSurvivedSeconds: number;
  isAlive: boolean;
  isHost?: boolean;
  color: string;
  skin?: BirdSkin;
  wingFrame?: number;
  wingTimer?: number;
}

export interface PipeState {
  id: number | string;
  x: number;
  topHeight: number; // Height of top pipe
  bottomHeight: number; // Height of bottom pipe
  bottomY: number;
  gap: number;
  width: number;
  passedBy: Set<string>; // Set of bird IDs that passed this pipe
  passed?: boolean;
  style?: PipeStyle;
}

export type Pipe = PipeState;

export interface BackgroundCloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length?: number;
  size?: number;
  alpha: number;
}

export interface TextPopup {
  id: string;
  text: string;
  x: number;
  y: number;
  alpha: number;
  scale: number;
  color: string;
}

export interface ThemeConfig {
  name: string;
  skyGradient: [string, string, string];
  groundColor: string;
  groundPatternColor: string;
  pipeColor: string;
  pipeBorder: string;
  pipeCapColor: string;
  cloudColor: string;
  buildingColor: string;
  accentColor: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface MatchHistoryEntry {
  id: string;
  date: string;
  mode: 'SINGLEPLAYER' | 'MULTIPLAYER';
  score: number;
  rank?: number;
  timeSurvivedSeconds: number;
  playersCount?: number;
}

export interface SinglePlayerStats {
  highScore: number;
  gamesPlayed: number;
  pipesPassed: number;
  timeSurvivedSeconds: number;
  averageScore?: number;
  coins: number;
  xp: number;
  unlockedAchievements: string[];
}

export interface MultiplayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  highScore: number;
  pipesPassed: number;
  timeSurvivedSeconds: number;
  longestSurvivalSeconds?: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  avatar?: string | null;
  highScore: number;
  totalPlayTimeSeconds: number;
  lastPlayed: string;
  wins?: number;
  mode?: string;
}

export type RoomStatus = 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';

export type PlayerStatus = 'WAITING' | 'READY' | 'PLAYING' | 'DEAD' | 'SPECTATING' | 'RETURNED_TO_LOBBY' | 'DISCONNECTED';

export interface FlappyRoomPlayer {
  userId: string;
  nickname: string;
  avatar?: string | null;
  isReady: boolean;
  isHost: boolean;
  score: number;
  isAlive: boolean;
  status: PlayerStatus;
  rank?: number;
}

export interface FlappyRoomState {
  id: string;
  hostId: string;
  gameType?: string;
  status: RoomStatus;
  players: FlappyRoomPlayer[];
  seed: number;
  startTime: number | null;
  countdownValue?: number | null;
  results?: Array<{ userId: string; rank: number; score: number; timeSurvived: number }>;
}
