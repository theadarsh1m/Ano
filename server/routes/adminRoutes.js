const express = require('express');
const prisma = require('../db');

// Factory: accepts in-memory Maps from the main server
module.exports = function createAdminRoutes(onlineUsersMap, roomsMap, activeGamesMap) {
  const router = express.Router();

// Admin Authentication Middleware
async function verifyAdmin(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(403).json({ error: 'Access denied: User ID required.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isBanned: true }
    });

    if (!user || user.isBanned || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied: Unauthorized.' });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    console.error('Admin Auth Error:', err);
    res.status(500).json({ error: 'Internal server error during admin validation.' });
  }
}

// Log admin action helper
async function logAction(adminEmail, action, target, req) {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    await prisma.auditLog.create({
      data: {
        adminEmail,
        action,
        target,
        ipAddress
      }
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// Apply middleware
router.use(verifyAdmin);

// ──── DASHBOARD OVERVIEW ────
router.get('/dashboard', async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    // Use live in-memory Maps instead of stale DB flags
    const onlineUsers = onlineUsersMap ? onlineUsersMap.size : 0;
    const activeRooms = roomsMap ? roomsMap.size : 0;

    const today = new Date();
    today.setHours(0,0,0,0);
    const gamesPlayedToday = await prisma.gameSession.count({
      where: {
        status: 'FINISHED',
        createdAt: { gte: today }
      }
    });

    const reviewsPending = await prisma.review.count({ where: { isRead: false } });
    const bugReports = await prisma.bugReport.count({ where: { NOT: { status: 'CLOSED' } } });
    const openUserReports = await prisma.userReport.count({ where: { status: 'OPEN' } });

    // Use Prisma aggregate for efficiency
    const ratingAgg = await prisma.review.aggregate({ _avg: { stars: true }, _count: true });
    const averageRating = ratingAgg._count > 0 && ratingAgg._avg.stars
      ? Number(ratingAgg._avg.stars.toFixed(1))
      : 0;

    res.json({
      totalUsers,
      onlineUsers,
      activeRooms,
      gamesPlayedToday,
      reviewsPending,
      bugReports,
      openUserReports,
      averageRating
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── USERS MANAGEMENT ────
router.get('/users', async (req, res) => {
  try {
    const { search, filter } = req.query;
    let where = {};

    if (search) {
      where.OR = [
        { nickname: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filter === 'banned') {
      where.isBanned = true;
    } else if (filter === 'admin') {
      where.role = 'SUPER_ADMIN';
    } else if (filter === 'online') {
      if (onlineUsersMap) {
        where.id = { in: Array.from(onlineUsersMap.keys()) };
      } else {
        where.isOnline = true;
      }
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nickname: true,
        email: true,
        avatar: true,
        createdAt: true,
        lastSeen: true,
        role: true,
        isBanned: true,
        _count: {
          select: { gameStats: true }
        }
      }
    });

    res.json(users.map(u => ({
      ...u,
      gamesPlayed: u._count.gameStats
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/ban', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({
      where: { id },
      data: { isBanned: true }
    });
    await logAction(req.adminUser.email, 'Banned user', `User: ${user.nickname} (${id})`, req);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/unban', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({
      where: { id },
      data: { isBanned: false }
    });
    await logAction(req.adminUser.email, 'Unbanned user', `User: ${user.nickname} (${id})`, req);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.delete({ where: { id } });
    await logAction(req.adminUser.email, 'Deleted user account', `User: ${user.nickname} (${id})`, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── RATINGS & REVIEWS ────
router.get('/reviews', async (req, res) => {
  try {
    const { stars, category, search } = req.query;
    let where = {};

    if (stars) {
      where.stars = parseInt(stars);
    }
    if (category) {
      where.category = category;
    }
    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { nickname: true, email: true, avatar: true }
        }
      }
    });

    // Compute stats
    const allReviews = await prisma.review.findMany({ select: { stars: true } });
    const total = allReviews.length;
    const average = total > 0 ? Number((allReviews.reduce((acc, c) => acc + c.stars, 0) / total).toFixed(1)) : 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allReviews.forEach(r => {
      distribution[r.stars] = (distribution[r.stars] || 0) + 1;
    });

    res.json({ reviews, stats: { total, average, distribution } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reviews/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.review.update({ where: { id }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reviews/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.review.update({ where: { id }, data: { isArchived: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.review.delete({ where: { id } });
    await logAction(req.adminUser.email, 'Deleted review', `Review ID: ${id}`, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── BUG REPORTS ────
router.get('/bugs', async (req, res) => {
  try {
    const bugs = await prisma.bugReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { nickname: true, email: true } }
      }
    });
    res.json(bugs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bugs/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // OPEN, INVESTIGATING, IN_PROGRESS, FIXED, CLOSED
    const bug = await prisma.bugReport.update({
      where: { id },
      data: { status }
    });
    await logAction(req.adminUser.email, 'Updated bug report status', `Bug ID: ${id} ➔ ${status}`, req);
    res.json({ success: true, bug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── USER REPORTS ────
router.get('/reports', async (req, res) => {
  try {
    const reports = await prisma.userReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { nickname: true, email: true } },
        reported: { select: { nickname: true, email: true, isBanned: true } }
      }
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reports/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { actionType, reportedUserId } = req.body; // WARN, MUTE, BAN, CLOSE

    if (actionType === 'BAN') {
      await prisma.user.update({
        where: { id: reportedUserId },
        data: { isBanned: true }
      });
      await logAction(req.adminUser.email, 'Moderation: Banned user via report', `Report ID: ${id}, User ID: ${reportedUserId}`, req);
    } else {
      await logAction(req.adminUser.email, `Moderation: ${actionType}`, `Report ID: ${id}`, req);
    }

    const report = await prisma.userReport.update({
      where: { id },
      data: { status: 'CLOSED' }
    });

    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── GAME CONFIGURATION ────
router.get('/games', async (req, res) => {
  try {
    const configs = await prisma.gameConfig.findMany();
    // Default configs for all GameType if not initialized
    const GameType = ['BLUFF', 'MEMORY_MATCH', 'DOTS_AND_BOXES', 'COLOR_WARS', 'SCRIBBLE', 'INK_DECEPTION', 'CHAMBER_CLASH'];
    const results = [];

    for (const type of GameType) {
      let conf = configs.find(c => c.id === type);
      if (!conf) {
        conf = await prisma.gameConfig.create({
          data: { id: type, isEnabled: true, isFeatured: false, isMaintenance: false }
        });
      }
      
      // Compute metrics
      const totalMatches = await prisma.gameResult.count({
        where: { gameSession: { gameType: type } }
      });
      const matchDurations = await prisma.gameResult.findMany({
        where: { gameSession: { gameType: type } },
        select: { durationSeconds: true }
      });
      const avgDuration = matchDurations.length > 0
        ? Math.round(matchDurations.reduce((acc, c) => acc + c.durationSeconds, 0) / matchDurations.length)
        : 0;

      results.push({
        id: conf.id,
        isEnabled: conf.isEnabled,
        isFeatured: conf.isFeatured,
        isMaintenance: conf.isMaintenance,
        totalMatches,
        avgDurationSeconds: avgDuration,
        activePlayers: activeGamesMap ? Array.from(activeGamesMap.values()).filter(g => g.gameType === type).reduce((sum, g) => sum + (g.players ? g.players.length : 0), 0) : 0,
        winRates: {}
      });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/games/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { isEnabled, isFeatured, isMaintenance } = req.body;
    
    const config = await prisma.gameConfig.update({
      where: { id },
      data: {
        ...(isEnabled !== undefined && { isEnabled }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(isMaintenance !== undefined && { isMaintenance }),
      }
    });

    await logAction(req.adminUser.email, 'Updated game configuration', `Game: ${id} ➔ ${JSON.stringify(req.body)}`, req);
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── ANNOUNCEMENTS ────
router.get('/announcements', async (req, res) => {
  try {
    const ann = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(ann);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/announcements', async (req, res) => {
  try {
    const { title, description, color, icon, expiryDate } = req.body;
    const ann = await prisma.announcement.create({
      data: {
        title,
        description,
        color,
        icon,
        expiryDate: expiryDate ? new Date(expiryDate) : null
      }
    });
    await logAction(req.adminUser.email, 'Published global announcement', `Title: ${title}`, req);
    res.json({ success: true, announcement: ann });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.announcement.delete({ where: { id } });
    await logAction(req.adminUser.email, 'Removed global announcement', `ID: ${id}`, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── REWARDS ────
router.post('/rewards/grant', async (req, res) => {
  try {
    const { rewardType, value, recipientType, selectedUserIds } = req.body; // COINS, TITLE, COSMETIC
    const message = `You have been granted a reward by Admin: ${rewardType === 'COINS' ? `${value} coins` : `${rewardType} (${value})`}`;

    if (recipientType === 'ALL') {
      const users = await prisma.user.findMany({ select: { id: true } });
      const notifications = users.map(u => ({
        recipientId: u.id,
        senderId: req.adminUser.id,
        type: 'REWARD',
        title: '👑 Admin Reward Granted!',
        message
      }));
      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }
      await logAction(req.adminUser.email, 'Granted rewards to all users', `${rewardType}: ${value}`, req);
    } else if (selectedUserIds && selectedUserIds.trim().length > 0) {
      const ids = selectedUserIds.split(',').map(s => s.trim()).filter(Boolean);
      const notifications = ids.map(id => ({
        recipientId: id,
        senderId: req.adminUser.id,
        type: 'REWARD',
        title: '👑 Admin Reward Granted!',
        message
      }));
      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }
      await logAction(req.adminUser.email, `Granted rewards to ${ids.length} users`, `${rewardType}: ${value}`, req);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── AUDIT LOGS ────
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── ANALYTICS DATA ────
router.get('/analytics', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { createdAt: true } });
    const sessions = await prisma.gameSession.findMany({ select: { createdAt: true, status: true } });
    const reviews = await prisma.review.findMany({ select: { createdAt: true } });

    res.json({
      usersGrowth: users.map(u => u.createdAt.getTime()),
      matchesGrowth: sessions.map(s => s.createdAt.getTime()),
      reviewsTrends: reviews.map(r => r.createdAt.getTime())
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── SITE SETTINGS (Persistent) ────
router.get('/settings', async (req, res) => {
  try {
    let config = await prisma.siteConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      config = await prisma.siteConfig.create({
        data: { id: 'default' }
      });
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { registrationOpen, googleLoginEnabled, maintenanceMode, ratingsEnabled } = req.body;
    const config = await prisma.siteConfig.upsert({
      where: { id: 'default' },
      update: {
        ...(registrationOpen !== undefined && { registrationOpen }),
        ...(googleLoginEnabled !== undefined && { googleLoginEnabled }),
        ...(maintenanceMode !== undefined && { maintenanceMode }),
        ...(ratingsEnabled !== undefined && { ratingsEnabled }),
      },
      create: {
        id: 'default',
        registrationOpen: registrationOpen ?? true,
        googleLoginEnabled: googleLoginEnabled ?? true,
        maintenanceMode: maintenanceMode ?? false,
        ratingsEnabled: ratingsEnabled ?? true,
      }
    });
    await logAction(req.adminUser.email, 'Updated site settings', JSON.stringify(req.body), req);
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  return router;
}; // end createAdminRoutes
