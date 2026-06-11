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

  /**
   * Get a user's full profile.
   */
  async getUserProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        bio: true,
        createdAt: true,
        lastSeen: true,
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      bio: user.bio,
      createdAt: user.createdAt.getTime(),
      lastSeen: user.lastSeen.getTime(),
    };
  },

  /**
   * Update a user's profile (nickname, bio, avatar).
   */
  async updateProfile(userId, data) {
    const updateData = {};
    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        nickname: true,
        avatar: true,
        bio: true,
        createdAt: true,
        lastSeen: true,
      },
    });

    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      bio: user.bio,
      createdAt: user.createdAt.getTime(),
      lastSeen: user.lastSeen.getTime(),
    };
  },

  /**
   * Search users by nickname or ID (case-insensitive).
   */
  async searchUsers(query, limit = 20) {
    if (!query || query.trim().length === 0) return [];

    const q = query.trim();
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { nickname: { contains: q, mode: 'insensitive' } },
          { id: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        lastSeen: true,
      },
      take: limit,
      orderBy: { lastSeen: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      avatar: u.avatar,
      lastSeen: u.lastSeen.getTime(),
    }));
  },
};

module.exports = userService;
