require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig, Pool } = require('@neondatabase/serverless');

// Use secure WebSocket connections for Neon serverless pool
neonConfig.useSecureWebSocket = true;
neonConfig.wsProxy = undefined;

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({ adapter });
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({ adapter });
  }
  prisma = global.__prisma;
}

module.exports = prisma;
