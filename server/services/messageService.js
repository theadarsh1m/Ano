const prisma = require('../db');

const messageService = {
  /**
   * Save a message to the database.
   */
  async saveMessage(message) {
    return await prisma.message.create({
      data: {
        id: message.id,
        content: message.content,
        type: message.type || 'text',
        senderId: message.senderId === 'system' ? null : message.senderId,
        roomId: message.roomId,
        // Media fields
        fileUrl: message.fileUrl || null,
        fileName: message.fileName || null,
        fileSize: message.fileSize || null,
        fileType: message.fileType || null,
        moderationStatus: message.moderationStatus || 'SAFE',
        moderationProvider: message.moderationProvider || 'Sightengine',
        nudityScore: message.nudityScore || null,
        goreScore: message.goreScore || null,
        rawModerationResponse: message.rawModerationResponse || null,
        moderatedAt: message.moderatedAt || null,
      },
    });
  },

  /**
   * Get the latest messages for a room, ordered oldest to newest.
   */
  async getMessages(roomId, limit = 50) {
    const messages = await prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
    });

    // Reverse so oldest is first (for display)
    return messages.reverse().map((msg) => ({
      id: msg.id,
      roomId: msg.roomId,
      senderId: msg.senderId || 'system',
      senderName: msg.sender?.nickname || 'System',
      content: msg.content,
      timestamp: msg.createdAt.getTime(),
      type: msg.type,
      // Media fields
      fileUrl: msg.fileUrl,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      fileType: msg.fileType,
      moderationStatus: msg.moderationStatus,
      moderationProvider: msg.moderationProvider,
      nudityScore: msg.nudityScore,
      goreScore: msg.goreScore,
      rawModerationResponse: msg.rawModerationResponse,
      moderatedAt: msg.moderatedAt,
    }));
  },
};

module.exports = messageService;
