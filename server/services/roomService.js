const prisma = require('../db');
const { v4: uuidv4 } = require('uuid');

const roomService = {
  /**
   * Create a new room and persist it to the database.
   */
  async createRoom(name, type, createdBy, description = null) {
    const id = type === 'private'
      ? uuidv4().substring(0, 6).toUpperCase()
      : uuidv4().substring(0, 8);

    const inviteCode = type === 'private' ? id : null;

    const room = await prisma.room.create({
      data: {
        id,
        name,
        description,
        type,
        inviteCode,
        createdBy,
      },
    });

    return room;
  },

  /**
   * Get a single room by ID or invite code.
   */
  async getRoom(roomId) {
    return prisma.room.findFirst({
      where: {
        OR: [
          { id: roomId },
          { inviteCode: roomId },
        ],
      },
    });
  },

  /**
   * Get all public rooms.
   */
  async getAllPublicRooms() {
    return prisma.room.findMany({
      where: { type: 'public' },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Get rooms by an array of IDs (used for private rooms a user has joined).
   */
  async getRoomsByIds(ids) {
    return prisma.room.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: 'desc' },
    });
  },
};

module.exports = roomService;
