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
        isAnonymous: true,
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
        data: { lastSeen: new Date(), isOnline: false },
      });
    } catch (err) {
      // User might not exist yet if they never fully joined
      console.log(`Could not update lastSeen for user ${userId}`);
    }
  },

  /**
   * Update a user's online status.
   */
  async setOnlineStatus(userId, isOnline) {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: { 
          isOnline,
          ...(isOnline ? {} : { lastSeen: new Date() }) 
        },
      });
    } catch (err) {
      console.log(`Could not update online status for user ${userId}`);
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

  /**
   * Check if a nickname is available (case-insensitive).
   */
  async checkNicknameAvailability(nickname) {
    if (!nickname || nickname.trim().length === 0) return false;
    
    const existing = await prisma.user.findFirst({
      where: {
        nickname: {
          equals: nickname.trim(),
          mode: 'insensitive',
        },
      },
    });
    
    return !existing;
  },

  /**
   * Find or create a user from Google Profile
   */
  async findOrCreateGoogleUser(googleProfile) {
    const googleUserId = `google_${googleProfile.sub}`;
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: googleUserId },
          { googleId: googleProfile.sub },
          { email: googleProfile.email },
        ]
      },
    });

    let isNewUser = false;

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: googleUserId,
          googleId: googleProfile.sub,
          email: googleProfile.email,
          nickname: googleProfile.name || 'Google User',
          avatar: googleProfile.picture,
          isAnonymous: false,
        },
      });
      isNewUser = true;
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleProfile.sub,
          email: googleProfile.email,
          isAnonymous: false,
          avatar: googleProfile.picture || user.avatar,
        },
      });
    }

    return { ...user, isNewUser };
  },

  /**
   * Upgrade an existing Guest user to a Google user
   */
  async upgradeGuestToGoogle(guestId, googleProfile) {
    const existingUser = await prisma.user.findUnique({
      where: { email: googleProfile.email },
    });

    if (existingUser && existingUser.id !== guestId) {
      throw new Error("Email is already connected to another account.");
    }

    const guest = await prisma.user.findUnique({ where: { id: guestId } });
    if (!guest || !guest.isAnonymous) {
      throw new Error("Invalid guest account.");
    }

    const user = await prisma.user.update({
      where: { id: guestId },
      data: {
        email: googleProfile.email,
        googleId: googleProfile.sub,
        avatar: googleProfile.picture || guest.avatar,
        nickname: googleProfile.name || guest.nickname,
        isAnonymous: false,
      },
    });

    return user;
  },
};

module.exports = userService;
