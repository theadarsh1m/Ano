const prisma = require('../db');

const ipService = {
  /**
   * Extract real client IP address with reverse proxy support.
   */
  extractIp(req) {
    if (!req) return '127.0.0.1';

    let ip = '';

    // Check X-Forwarded-For (comma-separated list, first element is client IP)
    const xForwardedFor = req.headers ? req.headers['x-forwarded-for'] : null;
    if (xForwardedFor) {
      const ips = String(xForwardedFor).split(',');
      ip = ips[0].trim();
    }

    // Fall back to X-Real-IP or CF-Connecting-IP
    if (!ip && req.headers) {
      ip = req.headers['x-real-ip'] || req.headers['cf-connecting-ip'] || '';
    }

    // Fall back to req.ip or socket remote address
    if (!ip) {
      ip = req.ip || (req.socket ? req.socket.remoteAddress : '') || '127.0.0.1';
    }

    // Normalize IPv6-mapped IPv4 addresses (e.g. ::ffff:192.168.1.1 -> 192.168.1.1)
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }
    if (ip === '::1') {
      ip = '127.0.0.1';
    }

    return ip || '127.0.0.1';
  },

  /**
   * Parse user agent string into browser, OS, and device type.
   */
  parseUserAgent(uaString) {
    if (!uaString) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };

    const ua = uaString;
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';
    let device = 'Desktop';

    // Device
    if (/mobile/i.test(ua)) device = 'Mobile';
    else if (/tablet|ipad/i.test(ua)) device = 'Tablet';

    // OS
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    // Browser
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
    else if (/opera|opr/i.test(ua)) browser = 'Opera';

    return { browser, os, device };
  },

  /**
   * Log an IP security event.
   */
  async logIpEvent({ userId, req, ipAddress, userAgent, eventType = 'LOGIN' }) {
    try {
      const resolvedIp = ipAddress || (req ? this.extractIp(req) : '127.0.0.1');
      const resolvedUa = userAgent || (req && req.headers ? req.headers['user-agent'] : null) || null;

      await prisma.ipLog.create({
        data: {
          userId: userId || null,
          ipAddress: resolvedIp,
          userAgent: resolvedUa,
          eventType,
        },
      });
    } catch (err) {
      console.error('Failed to log IP event:', err.message);
    }
  },

  /**
   * Get high-level IP analytics summary metrics.
   */
  async getIpSummary() {
    const totalLogs = await prisma.ipLog.count();

    const ipGroups = await prisma.ipLog.groupBy({
      by: ['ipAddress'],
      _count: {
        id: true,
      },
    });

    const totalUniqueIps = ipGroups.length;

    const multiAccountIpsList = await prisma.ipLog.groupBy({
      by: ['ipAddress', 'userId'],
      where: { userId: { not: null } },
    });

    const userCountByIp = {};
    multiAccountIpsList.forEach((item) => {
      userCountByIp[item.ipAddress] = (userCountByIp[item.ipAddress] || 0) + 1;
    });

    let multiAccountCount = 0; // > 1 accounts
    let highRiskCount = 0; // > 5 accounts (warning threshold)

    Object.values(userCountByIp).forEach((count) => {
      if (count > 1) multiAccountCount++;
      if (count > 5) highRiskCount++;
    });

    const mostActive = [...ipGroups].sort((a, b) => b._count.id - a._count.id)[0];

    return {
      totalLogs,
      totalUniqueIps,
      multiAccountIpsCount: multiAccountCount,
      highRiskIpsCount: highRiskCount,
      mostActiveIp: mostActive ? { ipAddress: mostActive.ipAddress, count: mostActive._count.id } : null,
    };
  },

  /**
   * Get paginated IP list with filters & search.
   */
  async getIpList({ search = '', filter = 'all', page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    let ipWhere = {};
    if (search) {
      const q = search.trim();
      ipWhere.OR = [
        { ipAddress: { contains: q, mode: 'insensitive' } },
        { user: { nickname: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { id: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (filter === 'anonymous_only') {
      ipWhere.user = { isAnonymous: true };
    } else if (filter === 'registered_only') {
      ipWhere.user = { isAnonymous: false };
    }

    const logs = await prisma.ipLog.findMany({
      where: ipWhere,
      select: {
        ipAddress: true,
        userId: true,
        eventType: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            nickname: true,
            email: true,
            isAnonymous: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const aggregatedMap = new Map();

    logs.forEach((log) => {
      const ip = log.ipAddress;
      if (!aggregatedMap.has(ip)) {
        aggregatedMap.set(ip, {
          ipAddress: ip,
          lastSeen: log.createdAt.getTime(),
          firstSeen: log.createdAt.getTime(),
          lastEvent: log.eventType,
          totalEvents: 0,
          userMap: new Map(),
          registeredCount: 0,
          anonymousCount: 0,
        });
      }

      const item = aggregatedMap.get(ip);
      item.totalEvents += 1;
      if (log.createdAt.getTime() > item.lastSeen) {
        item.lastSeen = log.createdAt.getTime();
        item.lastEvent = log.eventType;
      }
      if (log.createdAt.getTime() < item.firstSeen) {
        item.firstSeen = log.createdAt.getTime();
      }

      if (log.user) {
        if (!item.userMap.has(log.user.id)) {
          item.userMap.set(log.user.id, log.user);
          if (log.user.isAnonymous) {
            item.anonymousCount += 1;
          } else {
            item.registeredCount += 1;
          }
        }
      }
    });

    let results = Array.from(aggregatedMap.values()).map((item) => ({
      ipAddress: item.ipAddress,
      accountsCount: item.userMap.size,
      registeredCount: item.registeredCount,
      anonymousCount: item.anonymousCount,
      lastSeen: item.lastSeen,
      firstSeen: item.firstSeen,
      lastEvent: item.lastEvent,
      totalEvents: item.totalEvents,
      isHighRisk: item.userMap.size > 5, // Warning badge threshold (>5)
    }));

    if (filter === 'multiple_accounts') {
      results = results.filter((r) => r.accountsCount > 1);
    } else if (filter === 'high_risk') {
      results = results.filter((r) => r.accountsCount > 5);
    }

    results.sort((a, b) => b.lastSeen - a.lastSeen);

    const totalResults = results.length;
    const paginated = results.slice(skip, skip + limit);

    return {
      data: paginated,
      total: totalResults,
      page,
      totalPages: Math.ceil(totalResults / limit) || 1,
    };
  },

  /**
   * Get comprehensive details for a single IP address.
   */
  async getIpDetails(ipAddress) {
    const logs = await prisma.ipLog.findMany({
      where: { ipAddress },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            email: true,
            avatar: true,
            role: true,
            isAnonymous: true,
            isBanned: true,
            createdAt: true,
            lastSeen: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (logs.length === 0) return null;

    const userMap = new Map();
    const userAgentCounts = {};
    let registeredCount = 0;
    let anonymousCount = 0;

    logs.forEach((log) => {
      if (log.user && !userMap.has(log.user.id)) {
        userMap.set(log.user.id, {
          ...log.user,
          createdAt: log.user.createdAt.getTime(),
          lastSeen: log.user.lastSeen.getTime(),
        });
        if (log.user.isAnonymous) anonymousCount++;
        else registeredCount++;
      }

      if (log.userAgent) {
        const parsed = this.parseUserAgent(log.userAgent);
        const key = `${parsed.browser} on ${parsed.os} (${parsed.device})`;
        userAgentCounts[key] = (userAgentCounts[key] || 0) + 1;
      }
    });

    const timeline = logs.slice(0, 50).map((l) => ({
      id: l.id,
      userId: l.userId,
      nickname: l.user?.nickname || 'Guest/Unknown',
      eventType: l.eventType,
      createdAt: l.createdAt.getTime(),
      parsedUa: this.parseUserAgent(l.userAgent),
    }));

    return {
      ipAddress,
      totalEvents: logs.length,
      accountsCount: userMap.size,
      registeredCount,
      anonymousCount,
      firstSeen: logs[logs.length - 1].createdAt.getTime(),
      lastSeen: logs[0].createdAt.getTime(),
      isHighRisk: userMap.size > 5,
      linkedAccounts: Array.from(userMap.values()),
      userAgents: userAgentCounts,
      timeline,
    };
  },

  /**
   * Get IP analytics & linked accounts history for a specific user.
   */
  async getUserIpAnalytics(userId) {
    const userLogs = await prisma.ipLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const uniqueIps = [...new Set(userLogs.map((l) => l.ipAddress))];
    const lastLoginIp = userLogs[0]?.ipAddress || null;

    let otherAccountsMap = new Map();

    if (uniqueIps.length > 0) {
      const coLogs = await prisma.ipLog.findMany({
        where: {
          ipAddress: { in: uniqueIps },
          userId: { not: userId, not: null },
        },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              email: true,
              avatar: true,
              isAnonymous: true,
              isBanned: true,
              role: true,
              lastSeen: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      coLogs.forEach((cl) => {
        if (cl.user && !otherAccountsMap.has(cl.user.id)) {
          otherAccountsMap.set(cl.user.id, {
            ...cl.user,
            lastSeen: cl.user.lastSeen.getTime(),
            sharedIp: cl.ipAddress,
          });
        }
      });
    }

    return {
      userId,
      lastLoginIp,
      ipHistory: userLogs.map((l) => ({
        id: l.id,
        ipAddress: l.ipAddress,
        eventType: l.eventType,
        createdAt: l.createdAt.getTime(),
        parsedUa: this.parseUserAgent(l.userAgent),
      })),
      otherAccountsOnSameIp: Array.from(otherAccountsMap.values()),
    };
  },
};

module.exports = ipService;
