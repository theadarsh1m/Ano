const prisma = require('../db');

const conversationService = {
  /**
   * Get or create a conversation between two users.
   * Always stores IDs in sorted order to prevent duplicate pairs.
   */
  async getOrCreateConversation(userAId, userBId) {
    // Sort to ensure consistent ordering
    const [participantAId, participantBId] = [userAId, userBId].sort();

    // Try to find existing conversation
    let conversation = await prisma.conversation.findUnique({
      where: {
        participantAId_participantBId: { participantAId, participantBId },
      },
      include: {
        participantA: { select: { id: true, nickname: true, avatar: true } },
        participantB: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { participantAId, participantBId },
        include: {
          participantA: { select: { id: true, nickname: true, avatar: true } },
          participantB: { select: { id: true, nickname: true, avatar: true } },
        },
      });
    }

    return conversation;
  },

  /**
   * Get all conversations for a user, with last message and other participant info.
   */
  async getConversationsForUser(userId) {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participantAId: userId },
          { participantBId: userId },
        ],
      },
      include: {
        participantA: { select: { id: true, nickname: true, avatar: true, lastSeen: true } },
        participantB: { select: { id: true, nickname: true, avatar: true, lastSeen: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            createdAt: true,
            senderId: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conv) => {
      const otherUser = conv.participantAId === userId
        ? conv.participantB
        : conv.participantA;

      const lastMessage = conv.messages[0] || null;

      return {
        id: conv.id,
        otherUser,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              type: lastMessage.type,
              timestamp: lastMessage.createdAt.getTime(),
              senderId: lastMessage.senderId,
            }
          : null,
        updatedAt: conv.updatedAt.getTime(),
      };
    });
  },

  /**
   * Get a single conversation by ID with participant info.
   */
  async getConversation(conversationId) {
    return prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participantA: { select: { id: true, nickname: true, avatar: true, lastSeen: true } },
        participantB: { select: { id: true, nickname: true, avatar: true, lastSeen: true } },
      },
    });
  },
};

module.exports = conversationService;
