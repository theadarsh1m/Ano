const prisma = require('../db');

class GameService {
  /**
   * Update or create a user's game stat
   * @param {string} userId 
   * @param {string} gameType 
   * @param {number} score 
   * @param {number} playTimeSeconds 
   * @param {any} extraStats 
   */
  async updateGameStat(userId, gameType, score, playTimeSeconds = 0, extraStats = undefined) {
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
          totalPlayTimeSeconds: stat.totalPlayTimeSeconds + (playTimeSeconds || 0),
          extraStats: extraStats !== undefined ? extraStats : stat.extraStats,
          lastPlayed: new Date()
        }
      });
    } else {
      stat = await prisma.gameStat.create({
        data: {
          userId,
          gameType,
          highScore: score,
          totalPlayTimeSeconds: playTimeSeconds || 0,
          extraStats: extraStats || {},
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

  /**
   * Get global leaderboard for a game type
   * @param {string} gameType 
   * @param {number} limit 
   */
  async getLeaderboard(gameType, limit = 50) {
    return prisma.gameStat.findMany({
      where: { gameType },
      orderBy: { highScore: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            nickname: true,
            avatar: true
          }
        }
      }
    });
  }
}

module.exports = new GameService();
