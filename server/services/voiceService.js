const prisma = require('../db');

class VoiceService {
  async getVoiceChannels(roomId) {
    return prisma.voiceChannel.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async createVoiceChannel(roomId, name, capacity = 25) {
    return prisma.voiceChannel.create({
      data: {
        roomId,
        name,
        capacity
      }
    });
  }

  async deleteVoiceChannel(channelId) {
    return prisma.voiceChannel.delete({
      where: { id: channelId }
    });
  }
}

module.exports = new VoiceService();
