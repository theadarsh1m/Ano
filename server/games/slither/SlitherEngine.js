const BaseGameEngine = require('../engine/BaseGameEngine');

class SlitherEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'SLITHER');
    this.status = 'LOBBY'; // 'LOBBY' | 'PLAYING' | 'FINISHED'
    
    // Physics configs
    this.worldRadius = 3000;
    this.baseSpeed = 3.5;
    this.boostSpeed = 6.5;
    this.turnSpeed = 0.08;
    this.segmentSpacing = 6;
    
    // Entity lists
    this.snakes = new Map(); // userId -> snake state
    this.foods = [];
    this.kills = new Map(); // userId -> number
    
    this.updateInterval = null;
    this.tickRate = 30; // 30 ticks per second
  }

  getSafeSpawnPosition() {
    let x = 0;
    let y = 0;
    let attempts = 0;
    
    while (attempts < 15) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (this.worldRadius - 300);
      x = Math.cos(angle) * dist;
      y = Math.sin(angle) * dist;
      
      let isSafe = true;
      for (const other of this.snakes.values()) {
        if (!other.isAlive || other.segments.length === 0) continue;
        const head = other.segments[0];
        const dx = x - head.x;
        const dy = y - head.y;
        if (dx * dx + dy * dy < 800 * 800) {
          isSafe = false;
          break;
        }
      }
      
      if (isSafe) {
        return { x, y };
      }
      attempts++;
    }
    
    return { x, y };
  }

  startGame() {
    this.status = 'PLAYING';
    
    // Initialize user snakes
    this.players.forEach((p, id) => {
      const pos = this.getSafeSpawnPosition();
      this.snakes.set(id, this.createSnake(id, p.nickname, 'CLASSIC', false, pos.x, pos.y));
      this.kills.set(id, 0);
    });

    // Populate initial AI Bots (total 50 snakes in the world)
    this.replenishBots();

    // Populate initial food (2500 items for rich density)
    for (let i = 0; i < 2500; i++) {
      this.spawnRandomFood();
    }

    // Start physics tick loop
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.updateInterval = setInterval(() => {
      this.tick();
    }, 1000 / this.tickRate);

    this.emit('game_started', {
      gameId: this.gameId,
      status: this.status,
      startTime: Date.now()
    });

    return { status: this.status, startTime: Date.now() };
  }

  getBotSpawnPosition() {
    const humanPlayers = Array.from(this.snakes.values()).filter(s => !s.isBot && s.isAlive && s.segments.length > 0);
    if (humanPlayers.length > 0 && Math.random() < 0.65) {
      const targetHuman = humanPlayers[Math.floor(Math.random() * humanPlayers.length)];
      const head = targetHuman.segments[0];
      const angle = Math.random() * Math.PI * 2;
      const dist = 400 + Math.random() * 900;
      const bx = head.x + Math.cos(angle) * dist;
      const by = head.y + Math.sin(angle) * dist;
      const d = Math.sqrt(bx * bx + by * by);
      if (d < this.worldRadius - 200) {
        return { x: bx, y: by };
      }
    }
    return this.getSafeSpawnPosition();
  }

  privateReplenishBots() {
    const activeBots = Array.from(this.snakes.values()).filter(s => s.isBot && s.isAlive);
    const needed = 25 - activeBots.length;
    
    for (let i = 0; i < needed; i++) {
      const id = `bot_${Math.floor(Math.random() * 1000000)}_${Date.now()}`;
      const pos = this.getBotSpawnPosition();
      
      const skins = ['CLASSIC', 'RED', 'BLUE', 'YELLOW', 'RAINBOW', 'GLOW'];
      const skin = skins[Math.floor(Math.random() * skins.length)];
      
      const botNames = ['Noodle', 'Wormy', 'Slinky', 'Cobrette', 'Boa', 'Python', 'Kaa', 'Basilisk', 'Viper', 'Adder', 'Copperhead', 'Mamba', 'Anaconda', 'Garter', 'Sidewinder', 'Asp', 'Serpent', 'Naga', 'Wiggle', 'Curly'];
      const name = botNames[Math.floor(Math.random() * botNames.length)] + ` [Bot]`;
      
      this.snakes.set(id, this.createSnake(id, name, skin, true, pos.x, pos.y));
    }
  }

  replenishBots() {
    this.privateReplenishBots();
  }

  createSnake(id, nickname, skin, isBot, x, y) {
    const segments = [];
    const length = isBot ? 15 + Math.floor(Math.random() * 20) : 15;
    const startAngle = Math.random() * Math.PI * 2;
    
    for (let i = 0; i < length; i++) {
      segments.push({
        x: x - Math.cos(startAngle) * (i * this.segmentSpacing),
        y: y - Math.sin(startAngle) * (i * this.segmentSpacing)
      });
    }

    return {
      id,
      nickname,
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

  spawnRandomFood() {
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

  tick() {
    if (this.status !== 'PLAYING') return;

    // 1. Food replenishment (keep 2000 food items active)
    while (this.foods.length < 2000) {
      this.spawnRandomFood();
    }

    // 2. Bots replenishment (keep 25 active AI bots in the world)
    const activeBotsCount = Array.from(this.snakes.values()).filter(s => s.isBot && s.isAlive).length;
    if (activeBotsCount < 25) {
      this.replenishBots();
    }

    // 3. Update physics for all snakes
    this.snakes.forEach((snake) => {
      if (!snake.isAlive) return;

      if (snake.isBot) {
        this.updateBotAI(snake);
      }

      this.moveSnakePhysics(snake);
      this.checkFoodCollision(snake);
    });

    // 4. Collision checking (Head-to-body)
    this.snakes.forEach((snakeA, idA) => {
      if (!snakeA.isAlive) return;
      const headA = snakeA.segments[0];

      // Wall boundary
      const distFromCenter = Math.sqrt(headA.x * headA.x + headA.y * headA.y);
      if (distFromCenter >= this.worldRadius) {
        this.killSnake(snakeA);
        return;
      }

      // Check against all other snakes' bodies
      this.snakes.forEach((snakeB, idB) => {
        if (!snakeB.isAlive || idA === idB) return;

        const collisionDist = (snakeA.width + snakeB.width) / 2;

        for (let s = 0; s < snakeB.segments.length; s++) {
          const segB = snakeB.segments[s];
          const dx = headA.x - segB.x;
          const dy = headA.y - segB.y;
          const dSq = dx * dx + dy * dy;

          if (dSq < collisionDist * collisionDist) {
            this.killSnake(snakeA);
            
            // Increment killer's stats
            if (!snakeB.isBot) {
              const currentKills = this.kills.get(idB) || 0;
              this.kills.set(idB, currentKills + 1);
            }
            return;
          }
        }
      });
    });

    // 5. Broadcast snapshot
    this.emit('round_started'); // Triggers state broadcasting in GameSocket
  }

  moveSnakePhysics(snake) {
    if (snake.isBoosting && (snake.score < 10 || snake.segments.length < 10)) {
      snake.isBoosting = false;
    }

    const speed = snake.isBoosting ? this.boostSpeed : this.baseSpeed;
    const head = snake.segments[0];

    const nextHeadX = head.x + Math.cos(snake.angle) * speed;
    const nextHeadY = head.y + Math.sin(snake.angle) * speed;

    snake.segments.unshift({ x: nextHeadX, y: nextHeadY });

    if (snake.isBoosting) {
      snake.score = Math.max(10, snake.score - 0.20);

      if (Math.random() < 0.20 && snake.segments.length > 10) {
        const lastSeg = snake.segments[snake.segments.length - 1] || head;
        this.foods.push({
          id: `food_${Math.random().toString(36).substr(2, 9)}`,
          x: lastSeg.x + (Math.random() * 16 - 8),
          y: lastSeg.y + (Math.random() * 16 - 8),
          size: 5.5,
          color: '#00FFFF',
          value: 4.0
        });
      }
    }

    const targetLength = Math.max(10, Math.floor(snake.score));
    while (snake.segments.length > targetLength) {
      snake.segments.pop();
    }

    // Spacing update
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

    snake.width = 22 + Math.min(38, snake.segments.length * 0.1);
  }

  checkFoodCollision(snake) {
    const head = snake.segments[0];
    const headRad = snake.width / 2;

    for (let i = this.foods.length - 1; i >= 0; i--) {
      const food = this.foods[i];
      const dx = head.x - food.x;
      const dy = head.y - food.y;
      const distSq = dx * dx + dy * dy;

      // Attract food
      const attractDist = headRad + 60;
      if (distSq < attractDist * attractDist) {
        food.attractedTo = snake.id;
        food.x += (head.x - food.x) * 0.3;
        food.y += (head.y - food.y) * 0.3;
      }

      // Eat food
      const eatDist = headRad + food.size;
      if (distSq < eatDist * eatDist) {
        snake.score += food.value * 0.15;
        this.foods.splice(i, 1);
      }
    }
  }

  killSnake(snake) {
    snake.isAlive = false;

    // Explode segments into food
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

    // Trigger client death event
    if (!snake.isBot) {
      const killsCount = this.kills.get(snake.id) || 0;
      this.emitPrivateEvent(snake.id, 'player_died', {
        userId: snake.id,
        score: snake.score,
        kills: killsCount
      });
    } else {
      this.snakes.delete(snake.id);
    }
  }

  updateBotAI(bot) {
    const head = bot.segments[0];

    // Avoid border
    const dist = Math.sqrt(head.x * head.x + head.y * head.y);
    if (dist > this.worldRadius - 200) {
      bot.angle = Math.atan2(-head.y, -head.x);
      return;
    }

    // Avoid other snakes
    let isAvoiding = false;
    this.snakes.forEach((other, otherId) => {
      if (!other.isAlive || isAvoiding || otherId === bot.id) return;

      const detectRadius = bot.width * 2.5 + 40;

      for (let s = 0; s < other.segments.length; s++) {
        const seg = other.segments[s];
        const dx = head.x - seg.x;
        const dy = head.y - seg.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < detectRadius * detectRadius) {
          isAvoiding = true;
          bot.angle += (Math.atan2(dy, dx) - bot.angle) * 0.15;
          if (Math.random() < 0.05 && bot.segments.length > 15) {
            bot.isBoosting = true;
            setTimeout(() => { bot.isBoosting = false; }, 800);
          }
          return;
        }
      }
    });

    if (isAvoiding) return;

    // Search food
    let nearestFood = null;
    let nearestDistSq = Infinity;
    const searchDist = 300;

    for (let i = 0; i < this.foods.length; i++) {
      const food = this.foods[i];
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
    } else if (Math.random() < 0.05) {
      bot.angle += (Math.random() - 0.5) * 1.5;
    }
  }

  handlePlayerAction(userId, action, data) {
    if (this.status !== 'PLAYING') return { success: false, error: 'Match not running.' };

    const snake = this.snakes.get(userId);

    if (action === 'angle_update' && snake && snake.isAlive) {
      snake.angle = data.angle;
      return { success: true };
    }

    if (action === 'boost_update' && snake && snake.isAlive) {
      snake.isBoosting = data.isBoosting && snake.segments.length > 10;
      return { success: true };
    }

    if (action === 'respawn') {
      const pos = this.getSafeSpawnPosition();
      const nickname = data.nickname || 'Player';
      const skin = data.skin || 'CLASSIC';

      this.snakes.set(userId, this.createSnake(userId, nickname, skin, false, pos.x, pos.y));
      this.kills.set(userId, 0);
      return { success: true };
    }

    return { success: false, error: 'Invalid action.' };
  }

  serializeState(privatePlayerId) {
    const snakesArr = [];
    this.snakes.forEach((snake) => {
      if (snake.isAlive && snake.segments.length > 0) {
        snakesArr.push(snake);
      }
    });

    const killsObj = {};
    this.kills.forEach((v, k) => { killsObj[k] = v; });

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      worldRadius: this.worldRadius,
      snakes: snakesArr,
      foods: this.foods,
      kills: killsObj
    };
  }

  removePlayer(userId) {
    const snake = this.snakes.get(userId);
    if (snake) {
      this.killSnake(snake);
      this.snakes.delete(userId);
      this.kills.delete(userId);
    }
    if (this.players.has(userId)) {
      this.players.delete(userId);
      return true;
    }
    return false;
  }
}

module.exports = SlitherEngine;
