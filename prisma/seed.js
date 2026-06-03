const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Prisma 7 requires a driver adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Create default public rooms
  await prisma.room.upsert({
    where: { id: 'lobby' },
    update: {},
    create: {
      id: 'lobby',
      name: 'Main Lobby',
      type: 'public',
      capacity: 100,
      createdBy: 'system',
    },
  });

  await prisma.room.upsert({
    where: { id: 'chill' },
    update: {},
    create: {
      id: 'chill',
      name: 'Chill Zone',
      type: 'public',
      capacity: 50,
      createdBy: 'system',
    },
  });

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
