const prisma = require('../db');

const dmService = {
  /**
   * Save a direct message to the database.
   * Also touches the conversation's updatedAt for sort ordering.
   */
  async saveDirectMessage(message) {
    const [dm] = await prisma.$transaction([
      prisma.directMessage.create({
        data: {
          id: message.id,
          content: message.content,
          type: message.type || 'text',
          senderId: message.senderId,
          conversationId: message.conversationId,
          fileUrl: message.fileUrl || null,
          fileName: message.fileName || null,
          fileSize: message.fileSize || null,
          fileType: message.fileType || null,
        },
      }),
      prisma.conversation.update({
        where: { id: message.conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return dm;
  },

  /**
   * Get the latest DM messages for a conversation, oldest-first.
   */
  async getDirectMessages(conversationId, limit = 50) {
    const messages = await prisma.directMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    });

    // Reverse so oldest is first (for display)
    return messages.reverse().map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: msg.sender?.nickname || 'Unknown',
      senderAvatar: msg.sender?.avatar || null,
      content: msg.content,
      timestamp: msg.createdAt.getTime(),
      type: msg.type,
      fileUrl: msg.fileUrl,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      fileType: msg.fileType,
    }));
  },
};

module.exports = dmService;
