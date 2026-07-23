import { SlitherSkin } from '@/store/useSlitherStore';

export interface ClientSnakeSegment {
  x: number;
  y: number;
}

export interface ClientSnake {
  id: string;
  nickname: string;
  skin: SlitherSkin;
  isBot: boolean;
  score: number;
  isAlive: boolean;
  angle: number;
  isBoosting: boolean;
  segments: ClientSnakeSegment[];
  width: number;
  // Interpolation targets
  targetAngle?: number;
  targetSegments?: ClientSnakeSegment[];
}

export interface ClientFood {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  value: number;
  // Eat animation attraction
  attractedTo?: string; // snake ID
  attractionProgress?: number; // 0 to 1
}

export interface SlitherEngineCallbacks {
  onScoreUpdate: (score: number) => void;
  onKillsUpdate: (kills: number) => void;
  onGameOver: (score: number, kills: number, timePlayed: number) => void;
}

export class SlitherClientEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mode: 'SINGLEPLAYER' | 'MULTIPLAYER' | 'LAN';
  private callbacks: SlitherEngineCallbacks;
  
  // Game state
  public myUserId: string;
  public nickname: string;
  public skin: SlitherSkin;
  
  // Physics parameters
  public worldRadius = 3000;
  private baseSpeed = 3.5;
  private boostSpeed = 6.5;
  private turnSpeed = 0.08;
  private segmentSpacing = 6; // distance between segments
  
  // Entities
  public snakes: Map<string, ClientSnake> = new Map();
  public foods: ClientFood[] = [];
  
  // Camera
  private cameraX = 0;
  private cameraY = 0;
  private cameraZoom = 1.0;
  
  // User input
  private mouseX = 0;
  private mouseY = 0;
  private targetAngle = 0;
  private isBoosting = false;
  private keysPressed: Set<string> = new Set();
  private botSpawnCooldown = 0;
  
  // Stats
  private killsCount = 0;
  private startTime = 0;
  private isRunning = false;
  private animationFrameId: number | null = null;
  
  // Multiplayer interpolation
  private lastSnapshotTime = 0;
  private socket: any = null;
  private gameId: string | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    mode: 'SINGLEPLAYER' | 'MULTIPLAYER' | 'LAN',
    userId: string,
    nickname: string,
    skin: SlitherSkin,
    callbacks: SlitherEngineCallbacks,
    socket?: any,
    gameId?: string | null
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.mode = mode;
    this.myUserId = userId;
    this.nickname = nickname;
    this.skin = skin;
    this.callbacks = callbacks;
    this.socket = socket;
    this.gameId = gameId || null;
    
    this.resizeCanvas();
    this.setupInput();
  }

  public start() {
    this.isRunning = true;
    this.startTime = Date.now();
    this.killsCount = 0;
    
    if (this.mode === 'SINGLEPLAYER') {
      this.initSinglePlayer();
    } else {
      this.setupMultiplayer();
    }
    
    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.cleanupInput();
    
    if (this.mode !== 'SINGLEPLAYER' && this.socket) {
      this.socket.off('game_state');
      this.socket.off('player_died');
    }
  }

  private resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private setupInput() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('touchmove', this.handleTouchMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('contextmenu', this.handleContextMenu);
  }

  private cleanupInput() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private handleResize = () => {
    this.resizeCanvas();
  };

  private handleMouseMove = (e: MouseEvent) => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    
    let hasMovementKeys = false;
    ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach((k) => {
      if (this.keysPressed.has(k)) hasMovementKeys = true;
    });
    
    if (!hasMovementKeys) {
      this.updateTargetAngle();
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      this.mouseX = e.touches[0].clientX;
      this.mouseY = e.touches[0].clientY;
      this.updateTargetAngle();
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      this.isBoosting = true;
      this.sendBoostState(true);
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      this.isBoosting = false;
      this.sendBoostState(false);
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      this.keysPressed.add(e.code);
      this.updateTargetAngleFromKeys();
    }
    if (e.code === 'Space') {
      this.isBoosting = true;
      this.sendBoostState(true);
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      this.keysPressed.delete(e.code);
      this.updateTargetAngleFromKeys();
    }
    if (e.code === 'Space') {
      this.isBoosting = false;
      this.sendBoostState(false);
    }
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private updateTargetAngleFromKeys() {
    let dx = 0;
    let dy = 0;
    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) dy -= 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) dy += 1;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) dx -= 1;
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) dx += 1;

    if (dx !== 0 || dy !== 0) {
      this.targetAngle = Math.atan2(dy, dx);
      this.sendAngle();
    }
  }

  private updateTargetAngle() {
    const dx = this.mouseX - this.canvas.width / 2;
    const dy = this.mouseY - this.canvas.height / 2;
    this.targetAngle = Math.atan2(dy, dx);
    this.sendAngle();
  }

  private sendAngle() {
    if (this.mode !== 'SINGLEPLAYER' && this.socket && this.gameId) {
      this.socket.emit('game_action', {
        gameId: this.gameId,
        userId: this.myUserId,
        action: 'angle_update',
        data: { angle: this.targetAngle }
      });
    }
  }

  private sendBoostState(boosting: boolean) {
    if (this.mode !== 'SINGLEPLAYER' && this.socket && this.gameId) {
      this.socket.emit('game_action', {
        gameId: this.gameId,
        userId: this.myUserId,
        action: 'boost_update',
        data: { isBoosting: boosting }
      });
    }
  }

  // ========================
  // SINGLE PLAYER OFFLINE SIM
  // ========================
  private initSinglePlayer() {
    // Spawn player at center (0, 0)
    this.snakes.set(this.myUserId, this.createLocalSnake(this.myUserId, this.nickname, this.skin, false, 0, 0));
    
    // Spawn only 8 AI snakes initially, far from the player
    for (let i = 0; i < 8; i++) {
      this.spawnBotSafely(i);
    }
    
    // Spawn initial 1000 food items
    for (let i = 0; i < 1000; i++) {
      this.spawnRandomFood();
    }
  }

  private spawnBotSafely(index?: number) {
    const idx = index !== undefined ? index : this.snakes.size;
    const id = `bot_${idx}_${Math.random().toString(36).substr(2, 5)}`;
    
    let bx = 0;
    let by = 0;
    const player = this.snakes.get(this.myUserId);
    const playerHead = player ? player.segments[0] : { x: 0, y: 0 };
    
    let attempts = 0;
    while (attempts < 15) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 300 + Math.random() * (this.worldRadius - 600);
      bx = Math.cos(angle) * dist;
      by = Math.sin(angle) * dist;
      
      const dx = bx - playerHead.x;
      const dy = by - playerHead.y;
      if (dx * dx + dy * dy >= 800 * 800) {
        break;
      }
      attempts++;
    }

    const skins: SlitherSkin[] = ['CLASSIC', 'RED', 'BLUE', 'YELLOW', 'RAINBOW', 'GLOW'];
    const skin = skins[Math.floor(Math.random() * skins.length)];
    
    const botNames = ['Noodle', 'Wormy', 'Slinky', 'Cobrette', 'Boa', 'Python', 'Kaa', 'Basilisk', 'Viper', 'Adder', 'Copperhead', 'Mamba', 'Anaconda', 'Garter', 'Sidewinder', 'Asp', 'Serpent', 'Naga', 'Wiggle', 'Curly'];
    const name = botNames[Math.floor(Math.random() * botNames.length)] + ` [Bot]`;

    this.snakes.set(id, this.createLocalSnake(id, name, skin, true, bx, by));
  }

  private createLocalSnake(
    id: string,
    name: string,
    skin: SlitherSkin,
    isBot: boolean,
    x: number,
    y: number
  ): ClientSnake {
    const segments: ClientSnakeSegment[] = [];
    const length = isBot ? 15 + Math.floor(Math.random() * 30) : 15;
    const startAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < length; i++) {
      segments.push({
        x: x - Math.cos(startAngle) * (i * this.segmentSpacing),
        y: y - Math.sin(startAngle) * (i * this.segmentSpacing)
      });
    }
    return {
      id,
      nickname: name,
      skin,
      isBot,
      score: length,
      isAlive: true,
      angle: startAngle,
      isBoosting: false,
      segments,
      width: 22 + Math.min(38, length * 0.1)
    };
  }

  private spawnRandomFood() {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.worldRadius;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const colors = ['#FF0055', '#00FF66', '#0066FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FF9900'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const val = 1 + Math.floor(Math.random() * 4);
    this.foods.push({
      id: `food_${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      size: 3 + val,
      color,
      value: val
    });
  }

  private updateSinglePlayer() {
    // 1. Replenish food
    while (this.foods.length < 800) {
      this.spawnRandomFood();
    }

    // 1.5. Replenish AI bots slowly
    if (this.snakes.size < 50) {
      this.botSpawnCooldown++;
      if (this.botSpawnCooldown >= 90) {
        this.botSpawnCooldown = 0;
        this.spawnBotSafely();
      }
    }

    // 2. Update local player
    const player = this.snakes.get(this.myUserId);
    if (player && player.isAlive) {
      player.isBoosting = this.isBoosting && player.segments.length > 10;
      
      // Interpolate angle towards target
      let diff = this.targetAngle - player.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      player.angle += diff * this.turnSpeed;
      
      this.moveSnakePhysics(player);
      this.checkFoodCollision(player);
      
      this.cameraX = player.segments[0].x;
      this.cameraY = player.segments[0].y;
      
      // Zoom out as snake grows
      const targetZoom = 1.0 - Math.min(0.5, (player.segments.length - 15) * 0.002);
      this.cameraZoom += (targetZoom - this.cameraZoom) * 0.05;
      
      this.callbacks.onScoreUpdate(Math.floor(player.score * 10));
    }

    // 3. Update AI Bots
    for (const [id, snake] of this.snakes.entries()) {
      if (id === this.myUserId || !snake.isAlive) continue;
      
      this.updateBotAI(snake);
      this.moveSnakePhysics(snake);
      this.checkFoodCollision(snake);
    }

    // 4. Collision Detection (Head to Body)
    for (const [idA, snakeA] of this.snakes.entries()) {
      if (!snakeA.isAlive) continue;
      const headA = snakeA.segments[0];
      
      // Wall border collision
      const distFromCenter = Math.sqrt(headA.x * headA.x + headA.y * headA.y);
      if (distFromCenter >= this.worldRadius) {
        this.killSnake(snakeA);
        continue;
      }
      
      // Head to body collision with others
      for (const [idB, snakeB] of this.snakes.entries()) {
        if (!snakeB.isAlive) continue;
        
        // Skip self collision (head cannot hit own segments in standard Slither)
        if (idA === idB) continue;
        
        // Determine thickness
        const collisionDist = (snakeA.width + snakeB.width) / 2;
        
        // Check segments of snakeB
        for (let s = 0; s < snakeB.segments.length; s++) {
          const segB = snakeB.segments[s];
          const dx = headA.x - segB.x;
          const dy = headA.y - segB.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < collisionDist * collisionDist) {
            this.killSnake(snakeA);
            if (idB === this.myUserId && snakeA.isBot) {
              this.killsCount++;
              this.callbacks.onKillsUpdate(this.killsCount);
            }
            break;
          }
        }
      }
    }
  }

  private moveSnakePhysics(snake: ClientSnake) {
    const speed = snake.isBoosting ? this.boostSpeed : this.baseSpeed;
    const head = snake.segments[0];
    
    // Calculate new head position
    const nextHeadX = head.x + Math.cos(snake.angle) * speed;
    const nextHeadY = head.y + Math.sin(snake.angle) * speed;
    
    // Unshift new head
    snake.segments.unshift({ x: nextHeadX, y: nextHeadY });
    
    // If boosting, consume points and drop food occasionally
    if (snake.isBoosting) {
      if (Math.random() < 0.15 && snake.segments.length > 10) {
        // Spawn food segment
        const lastSeg = snake.segments.pop()!;
        this.foods.push({
          id: `food_${Math.random().toString(36).substr(2, 9)}`,
          x: lastSeg.x + (Math.random() * 20 - 10),
          y: lastSeg.y + (Math.random() * 20 - 10),
          size: 6,
          color: '#00FFFF',
          value: 3
        });
        snake.score = snake.segments.length;
      }
    }
    
    // Ensure correct length spacing
    const targetLength = snake.score;
    while (snake.segments.length > targetLength) {
      snake.segments.pop();
    }
    
    // Smooth trailing follow physics
    for (let i = 1; i < snake.segments.length; i++) {
      const prev = snake.segments[i - 1];
      const curr = snake.segments[i];
      const dx = prev.x - curr.x;
      const dy = prev.y - curr.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > this.segmentSpacing) {
        const ratio = this.segmentSpacing / dist;
        curr.x = prev.x - dx * ratio;
        curr.y = prev.y - dy * ratio;
      }
    }
    
    snake.width = 10 + Math.min(20, snake.segments.length * 0.05);
  }

  private checkFoodCollision(snake: ClientSnake) {
    const head = snake.segments[0];
    const headRad = snake.width / 2;
    
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const food = this.foods[i];
      const dx = head.x - food.x;
      const dy = head.y - food.y;
      const distSq = dx * dx + dy * dy;
      
      // Magnetic food attraction (when very close)
      const attractDist = headRad + 60;
      if (distSq < attractDist * attractDist) {
        food.attractedTo = snake.id;
        if (!food.attractionProgress) food.attractionProgress = 0;
        food.attractionProgress += 0.15;
        
        // Attract food towards head
        food.x += (head.x - food.x) * 0.3;
        food.y += (head.y - food.y) * 0.3;
      }
      
      // Actual eat trigger
      const eatDist = headRad + food.size;
      if (distSq < eatDist * eatDist) {
        // Grow score
        snake.score += food.value * 0.15;
        this.foods.splice(i, 1);
      }
    }
  }

  private killSnake(snake: ClientSnake) {
    snake.isAlive = false;
    
    // Explode segments into glowing food
    for (let i = 0; i < snake.segments.length; i += 2) {
      const seg = snake.segments[i];
      const colors = ['#FF0055', '#00FF66', '#0066FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FF9900'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.foods.push({
        id: `food_${Math.random().toString(36).substr(2, 9)}`,
        x: seg.x + (Math.random() * 30 - 15),
        y: seg.y + (Math.random() * 30 - 15),
        size: 5 + Math.floor(Math.random() * 4),
        color,
        value: 2 + Math.floor(Math.random() * 3)
      });
    }
    
    // If player died, trigger GameOver
    if (snake.id === this.myUserId) {
      this.isRunning = false;
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      this.callbacks.onGameOver(Math.floor(snake.score * 10), this.killsCount, duration);
    } else {
      // Replenish bot snake
      setTimeout(() => {
        if (!this.isRunning) return;
        const newId = `bot_${Math.floor(Math.random() * 1000)}_${Math.random().toString(36).substr(2, 5)}`;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (this.worldRadius - 300);
        const bx = Math.cos(angle) * dist;
        const by = Math.sin(angle) * dist;
        const skins: SlitherSkin[] = ['CLASSIC', 'RED', 'BLUE', 'YELLOW', 'RAINBOW', 'GLOW'];
        const skin = skins[Math.floor(Math.random() * skins.length)];
        this.snakes.set(newId, this.createLocalSnake(newId, `Bot ${Math.floor(Math.random() * 100)}`, skin, true, bx, by));
      }, 3000);
      
      this.snakes.delete(snake.id);
    }
  }

  private updateBotAI(bot: ClientSnake) {
    const head = bot.segments[0];
    
    // 1. Avoid boundaries
    const dist = Math.sqrt(head.x * head.x + head.y * head.y);
    if (dist > this.worldRadius - 200) {
      // Steer back to center
      const angleToCenter = Math.atan2(-head.y, -head.x);
      bot.angle = angleToCenter;
      return;
    }
    
    // 2. Avoid other snakes' body segments
    let isAvoiding = false;
    for (const [otherId, other] of this.snakes.entries()) {
      if (!other.isAlive) continue;
      
      // Determine thickness
      const detectRadius = bot.width * 2.5 + 40;
      
      for (let s = 0; s < other.segments.length; s++) {
        const seg = other.segments[s];
        // Skip own head/neck avoidance
        if (otherId === bot.id && s < 4) continue;
        
        const dx = head.x - seg.x;
        const dy = head.y - seg.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq < detectRadius * detectRadius) {
          isAvoiding = true;
          // Steer away!
          const steerAngle = Math.atan2(dy, dx);
          bot.angle += (steerAngle - bot.angle) * 0.15;
          
          // Bots occasionally boost when panicking
          if (Math.random() < 0.05 && bot.segments.length > 15) {
            bot.isBoosting = true;
            setTimeout(() => { bot.isBoosting = false; }, 800);
          }
          break;
        }
      }
      if (isAvoiding) break;
    }
    
    if (isAvoiding) return;
    
    // 3. Search for nearby food
    let nearestFood: ClientFood | null = null;
    let nearestDistSq = Infinity;
    const searchDist = 300;
    
    for (const food of this.foods) {
      const dx = food.x - head.x;
      const dy = food.y - head.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < searchDist * searchDist && dSq < nearestDistSq) {
        nearestFood = food;
        nearestDistSq = dSq;
      }
    }
    
    if (nearestFood) {
      const foodAngle = Math.atan2(nearestFood.y - head.y, nearestFood.x - head.x);
      let diff = foodAngle - bot.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      bot.angle += diff * 0.08;
    } else {
      // 4. Wander randomly
      if (Math.random() < 0.05) {
        bot.angle += (Math.random() - 0.5) * 1.5;
      }
    }
  }

  // ========================
  // MULTIPLAYER NETWORKING & INTERPOLATION
  // ========================
  private setupMultiplayer() {
    if (!this.socket) return;
    
    this.socket.on('game_state', (state: any) => {
      this.lastSnapshotTime = Date.now();
      
      // Parse map border
      if (state.worldRadius) this.worldRadius = state.worldRadius;
      
      // Sync foods
      if (Array.isArray(state.foods)) {
        this.foods = state.foods.map((f: any) => ({
          id: f.id,
          x: f.x,
          y: f.y,
          size: f.size || 5,
          color: f.color || '#00FF66',
          value: f.value || 1,
          attractedTo: f.attractedTo || undefined,
          attractionProgress: f.attractedTo ? 0.5 : undefined
        }));
      }
      
      // Sync snakes with interpolation target positions
      if (Array.isArray(state.snakes)) {
        const receivedIds = new Set<string>();
        
        state.snakes.forEach((s: any) => {
          receivedIds.add(s.id);
          const existing = this.snakes.get(s.id);
          
          if (existing) {
            existing.nickname = s.nickname;
            existing.skin = s.skin;
            existing.isBot = s.isBot;
            existing.score = s.score;
            existing.isAlive = s.isAlive;
            existing.isBoosting = s.isBoosting;
            
            // Set targets for interpolation
            existing.targetAngle = s.angle;
            existing.targetSegments = s.segments;
          } else {
            // New snake joined the screen
            this.snakes.set(s.id, {
              id: s.id,
              nickname: s.nickname,
              skin: s.skin,
              isBot: s.isBot,
              score: s.score,
              isAlive: s.isAlive,
              angle: s.angle,
              isBoosting: s.isBoosting,
              segments: s.segments,
              width: 22 + Math.min(38, s.score * 0.1)
            });
          }
        });
        
        // Remove snakes no longer in the snapshot
        for (const [id] of this.snakes.entries()) {
          if (!receivedIds.has(id)) {
            this.snakes.delete(id);
          }
        }
      }
      
      // Sync player stats
      const mySnake = this.snakes.get(this.myUserId);
      if (mySnake) {
        this.callbacks.onScoreUpdate(Math.floor(mySnake.score * 10));
        
        // Smooth camera follow
        this.cameraX = mySnake.segments[0].x;
        this.cameraY = mySnake.segments[0].y;
        
        const targetZoom = 1.0 - Math.min(0.5, (mySnake.segments.length - 15) * 0.002);
        this.cameraZoom += (targetZoom - this.cameraZoom) * 0.05;
      }
      
      if (state.kills && state.kills[this.myUserId] !== undefined) {
        this.killsCount = state.kills[this.myUserId];
        this.callbacks.onKillsUpdate(this.killsCount);
      }
    });

    this.socket.on('player_died', (data: { userId: string; score: number; kills: number }) => {
      if (data.userId === this.myUserId) {
        this.isRunning = false;
        const duration = Math.floor((Date.now() - this.startTime) / 1000);
        this.callbacks.onGameOver(Math.floor(data.score * 10), data.kills, duration);
      }
    });
  }

  private interpolateMultiplayerState() {
    // Basic linear interpolation towards snapshot targets
    const lerpFactor = 0.15; // smooth factor
    
    for (const snake of this.snakes.values()) {
      if (!snake.isAlive) continue;
      
      // Interpolate angle
      if (snake.targetAngle !== undefined) {
        let diff = snake.targetAngle - snake.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        snake.angle += diff * lerpFactor;
      }
      
      // Interpolate segments
      if (snake.targetSegments && snake.targetSegments.length > 0) {
        // Adjust client segment length to match target length
        const targetLen = snake.targetSegments.length;
        while (snake.segments.length > targetLen) snake.segments.pop();
        while (snake.segments.length < targetLen) {
          const last = snake.segments[snake.segments.length - 1] || { x: 0, y: 0 };
          snake.segments.push({ x: last.x, y: last.y });
        }
        
        // LERP segment positions
        for (let i = 0; i < targetLen; i++) {
          const clientSeg = snake.segments[i];
          const targetSeg = snake.targetSegments[i];
          if (clientSeg && targetSeg) {
            clientSeg.x += (targetSeg.x - clientSeg.x) * lerpFactor;
            clientSeg.y += (targetSeg.y - clientSeg.y) * lerpFactor;
          }
        }
      }
      
      snake.width = 22 + Math.min(38, snake.segments.length * 0.1);
    }
  }

  // ========================
  // CORE LOOP & RENDERING
  // ========================
  private gameLoop() {
    if (!this.isRunning) return;
    
    if (this.mode === 'SINGLEPLAYER') {
      this.updateSinglePlayer();
    } else {
      this.interpolateMultiplayerState();
    }
    
    this.render();
    
    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  private render() {
    // Clear screen
    this.ctx.fillStyle = '#0a0a0c';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.save();
    
    // Apply camera transformation
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(this.cameraZoom, this.cameraZoom);
    this.ctx.translate(-this.cameraX, -this.cameraY);
    
    // 1. Draw grid background
    this.drawGrid();
    
    // 2. Draw world boundary
    this.drawWorldBorder();
    
    // 3. Draw food glowing circles
    this.drawFoods();
    
    // 4. Draw snakes (body and head)
    this.drawSnakes();
    
    this.ctx.restore();
    
    // 5. HUD components (minimap drawn relative to screen)
    this.drawMinimap();
  }

  private drawGrid() {
    const hexRadius = 45;
    const w = hexRadius * 1.5;
    const h = hexRadius * Math.sqrt(3);
    
    const left = this.cameraX - (this.canvas.width / 2) / this.cameraZoom;
    const right = this.cameraX + (this.canvas.width / 2) / this.cameraZoom;
    const top = this.cameraY - (this.canvas.height / 2) / this.cameraZoom;
    const bottom = this.cameraY + (this.canvas.height / 2) / this.cameraZoom;
    
    const startCol = Math.floor(left / w) - 1;
    const endCol = Math.ceil(right / w) + 1;
    const startRow = Math.floor(top / h) - 1;
    const endRow = Math.ceil(bottom / h) + 1;
    
    this.ctx.fillStyle = '#161a23';
    this.ctx.strokeStyle = '#0c0e14';
    this.ctx.lineWidth = 1.5;
    
    for (let col = startCol; col <= endCol; col++) {
      const cx = col * w;
      const isOdd = col % 2 !== 0;
      for (let row = startRow; row <= endRow; row++) {
        let cy = row * h;
        if (isOdd) {
          cy += h / 2;
        }
        
        const distSq = cx * cx + cy * cy;
        if (distSq > (this.worldRadius + hexRadius) * (this.worldRadius + hexRadius)) {
          continue;
        }
        
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const x = cx + Math.cos(angle) * hexRadius;
          const y = cy + Math.sin(angle) * hexRadius;
          if (i === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }
    }
  }

  private drawWorldBorder() {
    this.ctx.strokeStyle = '#ff3366';
    this.ctx.lineWidth = 15;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.worldRadius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawFoods() {
    const left = this.cameraX - (this.canvas.width / 2) / this.cameraZoom;
    const right = this.cameraX + (this.canvas.width / 2) / this.cameraZoom;
    const top = this.cameraY - (this.canvas.height / 2) / this.cameraZoom;
    const bottom = this.cameraY + (this.canvas.height / 2) / this.cameraZoom;

    this.foods.forEach((food) => {
      if (food.x < left - 20 || food.x > right + 20 || food.y < top - 20 || food.y > bottom + 20) {
        return;
      }

      this.ctx.save();
      const grad = this.ctx.createRadialGradient(food.x, food.y, 0, food.x, food.y, food.size * 2.5);
      grad.addColorStop(0, food.color);
      grad.addColorStop(0.4, food.color);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(food.x, food.y, food.size * 2.5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(food.x, food.y, food.size * 0.45, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  private drawSnakes() {
    const left = this.cameraX - (this.canvas.width / 2) / this.cameraZoom;
    const right = this.cameraX + (this.canvas.width / 2) / this.cameraZoom;
    const top = this.cameraY - (this.canvas.height / 2) / this.cameraZoom;
    const bottom = this.cameraY + (this.canvas.height / 2) / this.cameraZoom;

    // Sort snakes to draw player on top
    const sortedSnakes = Array.from(this.snakes.values()).sort((a, b) => {
      if (a.id === this.myUserId) return 1;
      if (b.id === this.myUserId) return -1;
      return a.segments.length - b.segments.length;
    });

    sortedSnakes.forEach((snake) => {
      if (!snake.isAlive || snake.segments.length === 0) return;
      
      this.ctx.save();
      
      // Apply boosting skin glow
      if (snake.isBoosting) {
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.getSkinColor(snake.skin);
      }
      
      // Draw body segments (backwards to draw head last and on top)
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      this.ctx.lineWidth = 1.8;

      for (let i = snake.segments.length - 1; i >= 0; i--) {
        const seg = snake.segments[i];
        const segColor = this.getBodyColor(snake.skin, i);
        
        // Slightly taper segments near tail
        const progress = i / snake.segments.length;
        const width = snake.width * (1.0 - progress * 0.4);
        
        // Cull segments out of viewport
        if (seg.x < left - width || seg.x > right + width || seg.y < top - width || seg.y > bottom + width) {
          continue;
        }

        this.ctx.fillStyle = segColor;
        this.ctx.beginPath();
        this.ctx.arc(seg.x, seg.y, width / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      }
      
      // Draw eyes on the head
      const head = snake.segments[0];
      const eyeOffsetAngle = 0.65; // angle of eye offset from head heading
      const eyeDist = snake.width * 0.35;
      const eyeSize = snake.width * 0.22;
      const pupilSize = eyeSize * 0.55;
      
      // Left eye
      const leftEyeX = head.x + Math.cos(snake.angle - eyeOffsetAngle) * eyeDist;
      const leftEyeY = head.y + Math.sin(snake.angle - eyeOffsetAngle) * eyeDist;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Pupil left
      const pupilLeftX = leftEyeX + Math.cos(snake.angle) * (eyeSize - pupilSize);
      const pupilLeftY = leftEyeY + Math.sin(snake.angle) * (eyeSize - pupilSize);
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(pupilLeftX, pupilLeftY, pupilSize, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Right eye
      const rightEyeX = head.x + Math.cos(snake.angle + eyeOffsetAngle) * eyeDist;
      const rightEyeY = head.y + Math.sin(snake.angle + eyeOffsetAngle) * eyeDist;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Pupil right
      const pupilRightX = rightEyeX + Math.cos(snake.angle) * (eyeSize - pupilSize);
      const pupilRightY = rightEyeY + Math.sin(snake.angle) * (eyeSize - pupilSize);
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(pupilRightX, pupilRightY, pupilSize, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.restore();
      
      // Draw nickname tag above head
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      this.ctx.font = `bold ${11 / this.cameraZoom}px sans-serif`;
      this.ctx.textAlign = 'center';
      
      // Draw bot prefix if spectator
      const text = snake.isBot ? `[BOT] ${snake.nickname}` : snake.nickname;
      this.ctx.fillText(text, head.x, head.y - snake.width - 5);
      
      this.ctx.restore();
    });
  }

  private getSkinColor(skin: SlitherSkin): string {
    switch (skin) {
      case 'RED': return '#ef4444';
      case 'BLUE': return '#3b82f6';
      case 'YELLOW': return '#f59e0b';
      case 'RAINBOW': return '#ec4899';
      case 'GLOW': return '#10b981';
      default: return '#14b8a6';
    }
  }

  private getBodyColor(skin: SlitherSkin, index: number): string {
    if (skin === 'RAINBOW') {
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'];
      return colors[(index + Math.floor(Date.now() / 150)) % colors.length];
    }
    
    const baseColor = this.getSkinColor(skin);
    // Alternate shade slightly to make segments pop
    if (index % 2 === 0) {
      return baseColor;
    }
    
    // Return a slightly darker variant
    switch (skin) {
      case 'RED': return '#b91c1c';
      case 'BLUE': return '#1d4ed8';
      case 'YELLOW': return '#b45309';
      case 'GLOW': return '#047857';
      default: return '#0f766e';
    }
  }

  private drawMinimap() {
    const size = 150;
    const margin = 20;
    const x = this.canvas.width - size - margin;
    const y = this.canvas.height - size - margin;
    
    // Draw background
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw map limit border
    this.ctx.strokeStyle = 'rgba(255, 51, 102, 0.25)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(x + size / 2, y + size / 2, size / 2 - 4, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Draw dots representing snakes
    const scale = (size / 2 - 4) / this.worldRadius;
    
    this.snakes.forEach((snake) => {
      if (!snake.isAlive || snake.segments.length === 0) return;
      const head = snake.segments[0];
      const dotX = x + size / 2 + head.x * scale;
      const dotY = y + size / 2 + head.y * scale;
      
      this.ctx.fillStyle = snake.id === this.myUserId ? '#ffffff' : this.getSkinColor(snake.skin);
      this.ctx.beginPath();
      // Draw larger dot for player
      const dotSize = snake.id === this.myUserId ? 4.5 : 2;
      this.ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
      this.ctx.fill();
    });
    
    this.ctx.restore();
  }

  public getLeaderboard(): { nickname: string; score: number }[] {
    return Array.from(this.snakes.values())
      .filter((s) => s.isAlive)
      .map((s) => ({
        nickname: s.nickname,
        score: Math.floor(s.score * 10)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
}
