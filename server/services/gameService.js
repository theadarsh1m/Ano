const prisma = require('../db');

class GameService {
  /**
   * Update or create a user's game stat
   * @param {string} userId 
   * @param {string} gameType 
   * @param {number} score 
   * @param {number} playTimeSeconds 
   */
  async updateGameStat(userId, gameType, score, playTimeSeconds) {
    let stat = await prisma.gameStat.findUnique({
      where: {
        userId_gameType: {
          userId,
          gameType
        }
      }
    });

    if (stat) {
      stat = await prisma.gameStat.update({
        where: { id: stat.id },
        data: {
          highScore: Math.max(stat.highScore, score),
          totalPlayTimeSeconds: stat.totalPlayTimeSeconds + playTimeSeconds,
          lastPlayed: new Date()
        }
      });
    } else {
      stat = await prisma.gameStat.create({
        data: {
          userId,
          gameType,
          highScore: score,
          totalPlayTimeSeconds: playTimeSeconds,
          lastPlayed: new Date()
        }
      });
    }

    return stat;
  }

  /**
   * Get all stats for a user
   * @param {string} userId 
   */
  async getUserStats(userId) {
    return prisma.gameStat.findMany({
      where: { userId },
      orderBy: { lastPlayed: 'desc' }
    });
  }
}

module.exports = new GameService();
