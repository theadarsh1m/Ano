const path = require('path');
const fs = require('fs');
const BaseGameEngine = require('../engine/BaseGameEngine');
const { TurnManager } = require('./TurnManager');
const { getRandomCharacter } = require('./CharacterPool');
const RAPIER = require('@dimforge/rapier2d-compat');

const PHYSICS_SCALE = 0.01;
const PLATFORM_Y = 500;
const PLATFORM_WIDTH = 400;
const PLATFORM_HEIGHT = 20;
const SPAWN_Y = 50;
const STABILITY_LINEAR_THRESHOLD = 0.05;
const STABILITY_ANGULAR_THRESHOLD = 0.02;
const ELIMINATION_Y = 700;
const MIN_X = -200;
const MAX_X = 1000;

class AniGravityEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'ANIGRAVITY');
    this.turnNumber = 0;
    this.activePlayerId = null;
    this.phase = 'INIT';
    this.droppedCharacters = [];
    this.world = null;
    this.physicsBodies = new Map();
    this.characterHistory = [];
    this.currentCharacter = null;
    this.simulating = false;
  }

  async startGame() {
    await RAPIER.init();
    const gravity = { x: 0.0, y: 9.81 };
    this.world = new RAPIER.World(gravity);

    // Create Platform
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(400 * PHYSICS_SCALE, PLATFORM_Y * PHYSICS_SCALE);
    const groundBody = this.world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid((PLATFORM_WIDTH / 2) * PHYSICS_SCALE, (PLATFORM_HEIGHT / 2) * PHYSICS_SCALE);
    groundColliderDesc.setFriction(1.0);
    this.world.createCollider(groundColliderDesc, groundBody);

    const playersList = Array.from(this.players.values());
    this.turnManager = new TurnManager(playersList, 30);
    
    this.activePlayerId = this.turnManager.start(
      (sec) => this.emitPublicEvent('TURN_TICK', { secondsRemaining: sec }),
      (pid) => this.handlePlayerAction(pid, 'timeout', null)
    );

    this.status = 'PLAYING';
    this.phase = 'DROP';
    this.nextCharacter();

    this.emitPublicEvent('GAME_START', this.serializeState());
  }

  nextCharacter() {
    this.currentCharacter = getRandomCharacter(this.characterHistory);
    this.characterHistory.push(this.currentCharacter.id);
    if (this.characterHistory.length > 5) this.characterHistory.shift();
  }

  handlePlayerAction(playerId, action, data) {
    if (this.status !== 'PLAYING') return { success: false, error: 'Game not active' };
    if (playerId !== this.activePlayerId && action !== 'timeout') return { success: false, error: 'Not your turn' };
    if (this.simulating) return { success: false, error: 'Simulation in progress' };

    if (action === 'drop' || action === 'timeout') {
      let dropX = 400;
      let dropAngle = 0;
      if (action === 'drop' && data) {
        dropX = data.x !== undefined ? data.x : 400;
        dropAngle = data.angle !== undefined ? data.angle : 0;
      }
      
      this.turnManager.clearTurnTimer();
      this.phase = 'SIMULATING';
      this.emitPublicEvent('DROP_START', { playerId, x: dropX, angle: dropAngle });

      const colliderFile = path.basename(this.currentCharacter.colliderFile);
      const colliderPath = path.join(process.cwd(), 'public/games/anigravity/colliders', colliderFile);
      let colliderData = [];
      try {
        colliderData = JSON.parse(fs.readFileSync(colliderPath, 'utf8'));
      } catch (e) {
        console.error('Error loading collider', e);
      }

      const rbDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(dropX * PHYSICS_SCALE, SPAWN_Y * PHYSICS_SCALE)
        .setRotation(dropAngle)
        .setLinearDamping(this.currentCharacter.physics.linearDamping)
        .setAngularDamping(this.currentCharacter.physics.angularDamping);
        
      const body = this.world.createRigidBody(rbDesc);
      
      let collidersAttached = 0;
      if (colliderData && colliderData.colliders && Array.isArray(colliderData.colliders)) {
        for (const polygon of colliderData.colliders) {
          const vertices = [];
          for (const pt of polygon) {
            vertices.push(
              pt.x * this.currentCharacter.renderScale * PHYSICS_SCALE,
              pt.y * this.currentCharacter.renderScale * PHYSICS_SCALE
            );
          }
          const collDesc = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
          if (collDesc) {
            collDesc.setDensity(this.currentCharacter.physics.density);
            collDesc.setFriction(this.currentCharacter.physics.friction);
            collDesc.setRestitution(this.currentCharacter.physics.restitution);
            this.world.createCollider(collDesc, body);
            collidersAttached++;
          }
        }
      }
      
      if (collidersAttached === 0) {
        const fallbackDesc = RAPIER.ColliderDesc.cuboid(20 * PHYSICS_SCALE, 20 * PHYSICS_SCALE);
        this.world.createCollider(fallbackDesc, body);
      }

      const dropId = Date.now().toString() + '_' + Math.random().toString(36).substring(7);
      const dropObj = {
        id: dropId,
        characterId: this.currentCharacter.id,
        playerId,
        dropX,
        dropAngle,
        turnNumber: this.turnNumber,
        x: dropX,
        y: SPAWN_Y,
        angle: dropAngle,
        body,
        eliminated: false
      };
      
      this.droppedCharacters.push(dropObj);
      this.physicsBodies.set(dropId, body);
      
      this.simulating = true;
      
      const simEndDelay = 2200;
      setTimeout(() => {
        this.runSimulationBatch(() => {
          this.finalizeDrop(playerId);
        });
      }, simEndDelay);
      
      return { success: true, forceStateSync: false };
    }
    
    if (action === 'move') {
      this.emitPublicEvent('PLAYER_MOVE', { playerId, x: data.x });
      return { success: true };
    }
    
    if (action === 'rotate') {
      this.emitPublicEvent('PLAYER_ROTATE', { playerId, angle: data.angle });
      return { success: true };
    }

    return { success: false, error: 'Unknown action' };
  }
  
  runSimulationBatch(onComplete) {
    let steps = 0;
    const batch = () => {
      for (let i = 0; i < 60; i++) {
        this.world.step();
        steps++;
      }
      
      let stable = true;
      for (const [id, body] of this.physicsBodies.entries()) {
        const linVel = body.linvel();
        const angVel = body.angvel();
        if (Math.abs(linVel.x) > STABILITY_LINEAR_THRESHOLD || 
            Math.abs(linVel.y) > STABILITY_LINEAR_THRESHOLD || 
            Math.abs(angVel) > STABILITY_ANGULAR_THRESHOLD) {
          stable = false;
          break;
        }
      }
      
      if (stable || steps > 600) {
        onComplete();
      } else {
        setImmediate(batch);
      }
    };
    batch();
  }
  
  finalizeDrop(playerId) {
    let eliminateCurrent = false;
    for (const drop of this.droppedCharacters) {
      if (drop.eliminated) continue;
      
      const pos = drop.body.translation();
      const x = pos.x / PHYSICS_SCALE;
      const y = pos.y / PHYSICS_SCALE;
      
      drop.x = x;
      drop.y = y;
      drop.angle = drop.body.rotation();
      
      if (y > ELIMINATION_Y || x < MIN_X || x > MAX_X) {
        drop.eliminated = true;
        this.turnManager.eliminatePlayer(drop.playerId);
        this.emitPublicEvent('PLAYER_ELIMINATED', { playerId: drop.playerId, reason: 'Drop fell off platform' });
        if (drop.playerId === playerId) {
          eliminateCurrent = true;
        }
      }
    }
    
    this.simulating = false;
    
    if (this.turnManager.isGameOver()) {
      this.status = 'FINISHED';
      this.phase = 'END';
      this.emitPublicEvent('GAME_OVER', { winnerId: this.turnManager.getWinner() });
    } else {
      this.turnNumber++;
      this.nextCharacter();
      this.activePlayerId = this.turnManager.nextTurn();
      this.phase = 'DROP';
      this.emitPublicEvent('NEXT_TURN', {
        currentPlayerId: this.activePlayerId,
        currentCharacter: this.currentCharacter
      });
    }
    
    this.emitPublicEvent('STATE_SYNC', this.serializeState());
  }

  removePlayer(userId) {
    const wasActive = this.activePlayerId === userId;
    const removed = super.removePlayer(userId);
    
    if (removed && this.status === 'PLAYING') {
      if (this.turnManager) {
        this.turnManager.eliminatePlayer(userId);
        if (this.turnManager.isGameOver()) {
          this.status = 'FINISHED';
          this.phase = 'END';
          this.turnManager.clearTurnTimer();
          this.emitPublicEvent('GAME_OVER', { winnerId: this.turnManager.getWinner() });
          this.emitPublicEvent('STATE_SYNC', this.serializeState());
        } else if (wasActive && !this.simulating) {
          this.turnNumber++;
          this.nextCharacter();
          this.activePlayerId = this.turnManager.nextTurn();
          this.phase = 'DROP';
          this.emitPublicEvent('NEXT_TURN', {
            currentPlayerId: this.activePlayerId,
            currentCharacter: this.currentCharacter
          });
          this.emitPublicEvent('STATE_SYNC', this.serializeState());
        }
      }
    }
    return removed;
  }

  serializeState(privatePlayerId) {
    let nextPid = null;
    let tOrder = [];
    let activeP = [];
    let elimP = [];
    let tRemaining = 0;
    let winner = null;
    
    if (this.turnManager) {
      nextPid = this.turnManager.getNextPlayerId();
      tOrder = this.turnManager.getTurnOrder();
      activeP = this.turnManager.players.filter(p => !p.isEliminated).map(p => p.id);
      elimP = this.turnManager.players.filter(p => p.isEliminated).map(p => p.id);
      tRemaining = this.turnManager.getSecondsRemaining();
      winner = this.turnManager.getWinner();
    }
    
    return {
      gameId: this.gameId,
      gameType: 'ANIGRAVITY',
      status: this.status,
      players: Array.from(this.players.values()),
      turnNumber: this.turnNumber,
      currentPlayerId: this.activePlayerId,
      nextPlayerId: nextPid,
      turnOrder: tOrder,
      activePlayers: activeP,
      eliminatedPlayers: elimP,
      currentCharacterId: this.currentCharacter ? this.currentCharacter.id : null,
      droppedCharacters: this.droppedCharacters.map(d => ({
        id: d.id,
        characterId: d.characterId,
        playerId: d.playerId,
        dropX: d.dropX,
        dropAngle: d.dropAngle,
        turnNumber: d.turnNumber,
        x: d.body ? d.body.translation().x / PHYSICS_SCALE : d.x,
        y: d.body ? d.body.translation().y / PHYSICS_SCALE : d.y,
        angle: d.body ? d.body.rotation() : d.angle,
        eliminated: d.eliminated
      })),
      phase: this.phase,
      turnTimeRemaining: tRemaining,
      winnerId: winner
    };
  }
}

module.exports = AniGravityEngine;
