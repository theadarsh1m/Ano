require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

let prisma;

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || '';

  // Use Neon adapter only if connected to Neon serverless endpoint
  if (dbUrl.includes('neon.tech') || dbUrl.includes('neondatabase')) {
    try {
      const { PrismaNeon } = require('@prisma/adapter-neon');
      const { neonConfig } = require('@neondatabase/serverless');
      const ws = require('ws');

      neonConfig.webSocketConstructor = ws;
      neonConfig.useSecureWebSocket = true;
      neonConfig.wsProxy = undefined;

      const adapter = new PrismaNeon({ connectionString: dbUrl });
      return new PrismaClient({ adapter });
    } catch (err) {
      console.warn('Failed to initialize PrismaNeon adapter, falling back to default PrismaClient:', err.message);
    }
  }

  return new PrismaClient();
}

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  prisma = global.__prisma;
}

module.exports = prisma;
