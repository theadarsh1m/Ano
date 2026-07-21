const prisma = require('./server/db');

async function fixLegacy() {
  console.log("Fixing legacy moderation records...");
  
  try {
    const postRes = await prisma.post.updateMany({
      where: {
        moderationStatus: 'PENDING_MODERATION',
        moderatedAt: null,
      },
      data: {
        moderationStatus: 'SAFE'
      }
    });
    console.log(`Updated ${postRes.count} legacy Posts to SAFE`);

    const msgRes = await prisma.message.updateMany({
      where: {
        moderationStatus: 'PENDING_MODERATION',
        moderatedAt: null,
      },
      data: {
        moderationStatus: 'SAFE'
      }
    });
    console.log(`Updated ${msgRes.count} legacy Messages to SAFE`);

    const dmRes = await prisma.directMessage.updateMany({
      where: {
        moderationStatus: 'PENDING_MODERATION',
        moderatedAt: null,
      },
      data: {
        moderationStatus: 'SAFE'
      }
    });
    console.log(`Updated ${dmRes.count} legacy DirectMessages to SAFE`);

    const cacheRes = await prisma.moderationCache.updateMany({
      where: {
        status: 'PENDING_MODERATION',
        moderatedAt: null,
      },
      data: {
        status: 'SAFE'
      }
    });
    console.log(`Updated ${cacheRes.count} legacy ModerationCache entries to SAFE`);

    console.log("Migration fix complete.");
  } catch (err) {
    console.error("Error fixing migration:", err);
  }
}

fixLegacy();
