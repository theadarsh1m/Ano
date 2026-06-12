const prisma = require('../db');

const cleanupService = {
  start() {
    // Run cleanup every 24 hours
    const interval = 24 * 60 * 60 * 1000;
    
    setInterval(async () => {
      try {
        console.log('Running anonymous user cleanup...');
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const staleUsers = await prisma.user.findMany({
          where: {
            isAnonymous: true,
            isOnline: false,
            lastSeen: {
              lt: sevenDaysAgo,
            },
          },
          select: { id: true },
        });

        if (staleUsers.length === 0) {
          console.log('No stale anonymous users found.');
          return;
        }

        const staleIds = staleUsers.map(u => u.id);

        // Delete Direct Messages where they are the sender
        await prisma.directMessage.deleteMany({
          where: { senderId: { in: staleIds } },
        });

        // Delete Messages where they are the sender
        await prisma.message.deleteMany({
          where: { senderId: { in: staleIds } },
        });

        // Delete Conversations where they are participant A or B
        await prisma.conversation.deleteMany({
          where: {
            OR: [
              { participantAId: { in: staleIds } },
              { participantBId: { in: staleIds } }
            ]
          }
        });

        // Finally, delete the users
        const result = await prisma.user.deleteMany({
          where: {
            id: { in: staleIds },
          },
        });

        console.log(`Cleanup complete: Removed ${result.count} stale anonymous users.`);
      } catch (err) {
        console.error('Error during anonymous user cleanup:', err);
      }
    }, interval);
    
    console.log('Cleanup service started.');
  }
};

module.exports = cleanupService;
