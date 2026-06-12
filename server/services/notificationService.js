const prisma = require('../db');

const notificationService = {
  /**
   * Create a new notification.
   */
  async createNotification({ recipientId, senderId, type, title, message, metadata }) {
    return prisma.notification.create({
      data: {
        recipientId,
        senderId,
        type,
        title,
        message,
        metadata: metadata || null,
      },
      include: {
        sender: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });
  },

  /**
   * Get notifications for a user, ordered by newest first.
   */
  async getUserNotifications(userId, limit = 50) {
    return prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });
  },

  /**
   * Mark a specific notification as read.
   */
  async markAsRead(notificationId, userId) {
    // Verify ownership
    const notif = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    
    if (!notif || notif.recipientId !== userId) {
      throw new Error("Notification not found or unauthorized");
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  },

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId) {
    return prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });
  },
  
  /**
   * Create a friendship request or friendship status
   */
  async createFriendship(userId, friendId) {
    const [participantAId, participantBId] = [userId, friendId].sort();
    
    let friendship = await prisma.friendship.findUnique({
      where: {
        userId_friendId: { userId: participantAId, friendId: participantBId }
      }
    });
    
    if (!friendship) {
      friendship = await prisma.friendship.create({
        data: {
          userId: participantAId,
          friendId: participantBId,
          status: 'pending'
        }
      });
    }
    return friendship;
  },
  
  async getFriends(userId) {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: userId },
          { friendId: userId }
        ],
        status: 'accepted'
      },
      include: {
        user: { select: { id: true, nickname: true, avatar: true, isOnline: true } },
        friend: { select: { id: true, nickname: true, avatar: true, isOnline: true } }
      }
    });
    
    return friendships.map(f => f.userId === userId ? f.friend : f.user);
  }
};

module.exports = notificationService;
