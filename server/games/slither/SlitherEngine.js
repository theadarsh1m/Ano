const BaseGameEngine = require('../engine/BaseGameEngine');

class SpatialHashGrid {
  constructor(cellSize = 120) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  getKey(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx}:${cy}`;
  }

  insert(item) {
    const key = this.getKey(item.x, item.y);
    let cell = this.grid.get(key);
    if (!cell) {
      cell = [];
      this.grid.set(key, cell);
    }
    cell.push(item);
  }

  query(x, y, radius) {
    const results = [];
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.grid.get(`${cx}:${cy}`);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }
}

class SlitherEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'SLITHER');
    this.status = 'LOBBY';

    // Physics configs
    this.worldRadius = 3000;
    this.baseSpeed = 3.6;
    this.boostSpeed = 7.0;
    this.turnSpeed = 0.085;
    this.segmentSpacing = 6;

    // Entity maps & Spatial Grid
    this.snakes = new Map();
    this.foods = [];
    this.foodGrid = new SpatialHashGrid(120);
    this.kills = new Map();

    this.updateInterval = null;
    this.tickRate = 30; // 30Hz physics tick
  }

  getSafeSpawnPosition() {
    let x = 0;
    let y = 0;
    let attempts = 0;

    while (attempts < 20) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (this.worldRadius - 400);
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

      if (isSafe) return { x, y };
      attempts++;
    }

    return { x, y };
  }

  startGame() {
    this.status = 'PLAYING';

    this.players.forEach((p, id) => {
      const pos = this.getSafeSpawnPosition();
      this.snakes.set(id, this.createSnake(id, p.nickname, 'CLASSIC', false, pos.x, pos.y));
      this.kills.set(id, 0);
    });

    this.privateReplenishBots();

    for (let i = 0; i < 1000; i++) {
      this.spawnRandomFood();
    }

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

  privateReplenishBots() {
    const totalDesired = 50;
    const currentTotal = this.snakes.size;
    const needed = totalDesired - currentTotal;

    for (let i = 0; i < needed; i++) {
      const id = `bot_${Math.floor(Math.random() * 1000000)}`;
      const pos = this.getSafeSpawnPosition();

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
    const length = isBot ? 18 + Math.floor(Math.random() * 35) : 18;
    const startAngle = Math.random() * Math.PI * 2;
    const spacing = 6.5;

    for (let i = 0; i < length; i++) {
      segments.push({
        x: x - Math.cos(startAngle) * (i * spacing),
        y: y - Math.sin(startAngle) * (i * spacing)
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
      width: 20 + Math.min(45, Math.pow(length, 0.35) * 3)
    };
  }

  spawnRandomFood() {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.worldRadius;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;

    const colors = ['#FF0055', '#00FF66', '#0066FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FF9900'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const sizes = [4, 6, 8, 10, 14];
    const val = 1 + Math.floor(Math.random() * 4);
    const size = sizes[Math.min(sizes.length - 1, val - 1)];

    this.foods.push({
      id: `food_${Math.random().toString(36).substring(2, 9)}`,
      x,
      y,
      size,
      color,
      value: val
    });
  }

  tick() {
    if (this.status !== 'PLAYING') return;

    // 1. Food replenishment
    while (this.foods.length < 800) {
      this.spawnRandomFood();
    }

    // Rebuild Spatial Grid for food
    this.foodGrid.clear();
    for (let i = 0; i < this.foods.length; i++) {
      this.foodGrid.insert(this.foods[i]);
    }

    // 2. Bots replenishment - maintain constant 50 snakes
    if (this.snakes.size < 50) {
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

    // 4. Collision checking (Head to Body & World Boundary)
    this.snakes.forEach((snakeA, idA) => {
      if (!snakeA.isAlive) return;
      const headA = snakeA.segments[0];

      // Wall boundary collision (snake dies if head edge touches boundary wall)
      const distFromCenter = Math.sqrt(headA.x * headA.x + headA.y * headA.y);
      if (distFromCenter + snakeA.width * 0.4 >= this.worldRadius) {
        this.killSnake(snakeA);
        return;
      }

      // Head to body collision against all other snakes
      this.snakes.forEach((snakeB, idB) => {
        if (!snakeB.isAlive || idA === idB) return;

        const collisionDist = (snakeA.width + snakeB.width) * 0.42;
        const headRadSq = collisionDist * collisionDist;

        for (let s = 0; s < snakeB.segments.length; s++) {
          const segB = snakeB.segments[s];
          const dx = headA.x - segB.x;
          const dy = headA.y - segB.y;

          if (dx * dx + dy * dy < headRadSq) {
            this.killSnake(snakeA);

            if (!snakeB.isBot) {
              const currentKills = this.kills.get(idB) || 0;
              this.kills.set(idB, currentKills + 1);
            }
            return;
          }
        }
      });
    });

    this.emit('round_started');
  }

  moveSnakePhysics(snake) {
    const speed = snake.isBoosting ? this.boostSpeed : this.baseSpeed;
    const head = snake.segments[0];

    const nextHeadX = head.x + Math.cos(snake.angle) * speed;
    const nextHeadY = head.y + Math.sin(snake.angle) * speed;

    snake.segments.unshift({ x: nextHeadX, y: nextHeadY });

    if (snake.isBoosting) {
      if (Math.random() < 0.18 && snake.segments.length > 12) {
        const lastSeg = snake.segments.pop();
        this.foods.push({
          id: `food_${Math.random().toString(36).substring(2, 9)}`,
          x: lastSeg.x + (Math.random() * 16 - 8),
          y: lastSeg.y + (Math.random() * 16 - 8),
          size: 8,
          color: '#00FFFF',
          value: 3
        });
        snake.score = snake.segments.length;
      }
    }

    const targetLength = Math.floor(snake.score);
    while (snake.segments.length > targetLength) {
      snake.segments.pop();
    }

    const spacing = 6.0 + Math.min(6.0, snake.width * 0.08);
    for (let i = 1; i < snake.segments.length; i++) {
      const prev = snake.segments[i - 1];
      const curr = snake.segments[i];
      const dx = prev.x - curr.x;
      const dy = prev.y - curr.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > spacing) {
        const ratio = spacing / dist;
        curr.x = prev.x - dx * ratio;
        curr.y = prev.y - dy * ratio;
      }
    }

    snake.width = 20 + Math.min(45, Math.pow(snake.segments.length, 0.35) * 3);
  }

  checkFoodCollision(snake) {
    const head = snake.segments[0];
    const headRad = snake.width / 2;

    const nearbyFoods = this.foodGrid.query(head.x, head.y, headRad + 70);

    for (let i = 0; i < nearbyFoods.length; i++) {
      const food = nearbyFoods[i];
      const dx = head.x - food.x;
      const dy = head.y - food.y;
      const distSq = dx * dx + dy * dy;

      const attractDist = headRad + 55;
      if (distSq < attractDist * attractDist) {
        food.x += (head.x - food.x) * 0.28;
        food.y += (head.y - food.y) * 0.28;
      }

      const eatDist = headRad + food.size * 0.6;
      if (distSq < eatDist * eatDist) {
        snake.score += food.value * 0.18;
        const index = this.foods.indexOf(food);
        if (index !== -1) {
          this.foods.splice(index, 1);
        }
      }
    }
  }

  killSnake(snake) {
    snake.isAlive = false;

    for (let i = 0; i < snake.segments.length; i += 2) {
      const seg = snake.segments[i];
      const colors = ['#FF0055', '#00FF66', '#0066FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FF9900'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const sizes = [6, 8, 10, 14];

      this.foods.push({
        id: `food_${Math.random().toString(36).substring(2, 9)}`,
        x: seg.x + (Math.random() * 30 - 15),
        y: seg.y + (Math.random() * 30 - 15),
        size: sizes[Math.floor(Math.random() * sizes.length)],
        color,
        value: 2 + Math.floor(Math.random() * 3)
      });
    }

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

    // Boundary check - turn smoothly inward when approaching wall
    const dist = Math.sqrt(head.x * head.x + head.y * head.y);
    if (dist > this.worldRadius - 350) {
      const targetAngle = Math.atan2(-head.y, -head.x);
      let diff = targetAngle - bot.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      bot.angle += diff * 0.25;
      bot.isBoosting = false;
      return;
    }

    // Evasion check
    let isAvoiding = false;
    const detectRadius = bot.width * 2.8 + 45;
    const detectRadSq = detectRadius * detectRadius;

    this.snakes.forEach((other, otherId) => {
      if (!other.isAlive || isAvoiding) return;

      for (let s = 0; s < other.segments.length; s += 2) {
        if (otherId === bot.id && s < 5) continue;

        const seg = other.segments[s];
        const dx = head.x - seg.x;
        const dy = head.y - seg.y;

        if (dx * dx + dy * dy < detectRadSq) {
          isAvoiding = true;
          const steerAngle = Math.atan2(dy, dx);
          let diff = steerAngle - bot.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          bot.angle += diff * 0.2;
          if (Math.random() < 0.08 && bot.segments.length > 15) {
            bot.isBoosting = true;
            setTimeout(() => { bot.isBoosting = false; }, 600);
          }
          return;
        }
      }
    });

    if (isAvoiding) return;

    // Search food using spatial hash grid
    const nearbyFoods = this.foodGrid.query(head.x, head.y, 350);
    let nearestFood = null;
    let nearestDistSq = Infinity;

    for (let i = 0; i < nearbyFoods.length; i++) {
      const food = nearbyFoods[i];
      const dx = food.x - head.x;
      const dy = food.y - head.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < nearestDistSq) {
        nearestFood = food;
        nearestDistSq = dSq;
      }
    }

    if (nearestFood) {
      const foodAngle = Math.atan2(nearestFood.y - head.y, nearestFood.x - head.x);
      let diff = foodAngle - bot.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      bot.angle += diff * 0.09;
    } else if (Math.random() < 0.04) {
      bot.angle += (Math.random() - 0.5) * 1.2;
    }
  }

  handlePlayerAction(userId, action, data) {
    if (this.status !== 'PLAYING') return { success: false, error: 'Match not running.' };

    const snake = this.snakes.get(userId);

    if (action === 'angle_update' && snake && snake.isAlive) {
      snake.angle = data.angle;
      return { success: true, forceStateSync: false };
    }

    if (action === 'boost_update' && snake && snake.isAlive) {
      snake.isBoosting = data.isBoosting && snake.segments.length > 10;
      return { success: true, forceStateSync: false };
    }

    if (action === 'respawn') {
      const pos = this.getSafeSpawnPosition();
      const existingPlayer = this.players.get(userId);
      const nickname = (data && data.nickname) || (existingPlayer && existingPlayer.nickname) || 'Player';
      const skin = (data && data.skin) || 'CLASSIC';

      this.snakes.set(userId, this.createSnake(userId, nickname, skin, false, pos.x, pos.y));
      this.kills.set(userId, 0);
      return { success: true };
    }

    return { success: false, error: 'Invalid action.' };
  }

  serializeState(privatePlayerId) {
    const snakesArr = [];
    let mySnake = null;

    if (privatePlayerId) {
      mySnake = this.snakes.get(privatePlayerId);
    }

    const filterCenter = mySnake && mySnake.isAlive && mySnake.segments.length > 0
      ? mySnake.segments[0]
      : { x: 0, y: 0 };

    const filterRadius = 1400;

    this.snakes.forEach((snake) => {
      if (!snake.isAlive || snake.segments.length === 0) return;
      const head = snake.segments[0];

      if (snake.id === privatePlayerId) {
        snakesArr.push(snake);
        return;
      }

      const dx = head.x - filterCenter.x;
      const dy = head.y - filterCenter.y;
      if (dx * dx + dy * dy < filterRadius * filterRadius) {
        snakesArr.push(snake);
      }
    });

    const foodsFiltered = this.foods.filter((food) => {
      const dx = food.x - filterCenter.x;
      const dy = food.y - filterCenter.y;
      return dx * dx + dy * dy < filterRadius * filterRadius;
    });

    const leaderboard = Array.from(this.snakes.values())
      .filter((s) => s.isAlive)
      .map((s) => ({
        id: s.id,
        nickname: s.nickname,
        score: Math.floor(s.score * 10),
        isBot: s.isBot
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const killsObj = {};
    this.kills.forEach((v, k) => { killsObj[k] = v; });

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      worldRadius: this.worldRadius,
      snakes: snakesArr,
      foods: foodsFiltered,
      leaderboard,
      kills: killsObj
    };
  }

  removePlayer(userId) {
    const snake = this.snakes.get(userId);
    if (snake) {
      this.killSnake(snake);
      this.snakes.delete(userId);
      this.kills.delete(userId);
      super.removePlayer(userId);
      return true;
    }
    return false;
  }
}

module.exports = SlitherEngine;
