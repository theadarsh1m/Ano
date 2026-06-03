const prisma = require('../db');

const userService = {
  /**
   * Create or update an anonymous user record.
   */
  async upsertUser(id, nickname) {
    return prisma.user.upsert({
      where: { id },
      update: {
        nickname,
        lastSeen: new Date(),
      },
      create: {
        id,
        nickname,
      },
    });
  },

  /**
   * Update a user's lastSeen timestamp.
   */
  async updateLastSeen(userId) {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: { lastSeen: new Date() },
      });
    } catch (err) {
      // User might not exist yet if they never fully joined
      console.log(`Could not update lastSeen for user ${userId}`);
    }
  },
};

module.exports = userService;
