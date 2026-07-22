const prisma = require('../../db');

class GamePersistenceService {
  static async createSession(sessionId, gameType) {
    try {
      return await prisma.gameSession.upsert({
        where: { id: sessionId },
        update: {
          gameType,
          status: 'WAITING',
        },
        create: {
          id: sessionId,
          gameType,
          status: 'WAITING',
        }
      });
    } catch (err) {
      console.error(`Failed to create game session ${sessionId}:`, err.message);
    }
  }

  static async saveSessionState(sessionId, gameState, status = 'PLAYING') {
    try {
      return await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          gameState,
          status
        }
      });
    } catch (err) {
      console.error(`Failed to save game state ${sessionId}:`, err.message);
    }
  }

  static async getSessionState(sessionId) {
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          players: true
        }
      });
      return session;
    } catch (err) {
      console.error(`Failed to get game session ${sessionId}:`, err.message);
      return null;
    }
  }

  static async addPlayer(sessionId, userId, nickname, role = 'PLAYER') {
    try {
      return await prisma.gamePlayer.upsert({
        where: {
          gameSessionId_userId: {
            gameSessionId: sessionId,
            userId
          }
        },
        create: {
          gameSessionId: sessionId,
          userId,
          nickname,
          role
        },
        update: {
          nickname,
          role
        }
      });
    } catch (err) {
      console.error(`Failed to add game player ${userId} to session ${sessionId}:`, err.message);
    }
  }

  static async removePlayer(sessionId, userId) {
    try {
      return await prisma.gamePlayer.delete({
        where: {
          gameSessionId_userId: {
            gameSessionId: sessionId,
            userId
          }
        }
      });
    } catch (err) {
      console.error(`Failed to remove game player ${userId} from session ${sessionId}:`, err.message);
    }
  }

  static async recordMove(sessionId, playerId, moveType, moveData) {
    try {
      return await prisma.gameMove.create({
        data: {
          gameSessionId: sessionId,
          playerId,
          moveType,
          moveData
        }
      });
    } catch (err) {
      console.error(`Failed to record game move in session ${sessionId}:`, err.message);
    }
  }

  static async recordResult(sessionId, winnerId, durationSeconds) {
    try {
      await prisma.$transaction([
        prisma.gameResult.create({
          data: {
            gameSessionId: sessionId,
            winnerId,
            durationSeconds
          }
        }),
        prisma.gameSession.update({
          where: { id: sessionId },
          data: { status: 'FINISHED' }
        })
      ]);
    } catch (err) {
      console.error(`Failed to save game result for session ${sessionId}:`, err.message);
    }
  }
}

module.exports = GamePersistenceService;
