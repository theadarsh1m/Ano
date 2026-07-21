const { Client } = require('pg');
require('dotenv').config({ path: 'd:/Adarsh learning/My projects/ano/.env' });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    // Add new values to enum
    await client.query(`ALTER TYPE "ModerationStatus" ADD VALUE IF NOT EXISTS 'SAFE';`);
    await client.query(`ALTER TYPE "ModerationStatus" ADD VALUE IF NOT EXISTS 'SENSITIVE';`);
    await client.query(`ALTER TYPE "ModerationStatus" ADD VALUE IF NOT EXISTS 'PENDING_MODERATION';`);
    await client.query(`ALTER TYPE "ModerationStatus" ADD VALUE IF NOT EXISTS 'REJECTED';`);

    // Update existing records
    await client.query(`UPDATE "Post" SET "moderationStatus" = 'PENDING_MODERATION' WHERE "moderationStatus" = 'PENDING' OR "moderationStatus" = 'SCANNING' OR "moderationStatus" = 'SCANNING_FAILED';`);
    await client.query(`UPDATE "Post" SET "moderationStatus" = 'SAFE' WHERE "moderationStatus" = 'APPROVED';`);
    await client.query(`UPDATE "Post" SET "moderationStatus" = 'REJECTED' WHERE "moderationStatus" = 'FLAGGED';`);

    await client.query(`UPDATE "Message" SET "moderationStatus" = 'PENDING_MODERATION' WHERE "moderationStatus" = 'PENDING' OR "moderationStatus" = 'SCANNING' OR "moderationStatus" = 'SCANNING_FAILED';`);
    await client.query(`UPDATE "Message" SET "moderationStatus" = 'SAFE' WHERE "moderationStatus" = 'APPROVED';`);
    await client.query(`UPDATE "Message" SET "moderationStatus" = 'REJECTED' WHERE "moderationStatus" = 'FLAGGED';`);

    await client.query(`UPDATE "DirectMessage" SET "moderationStatus" = 'PENDING_MODERATION' WHERE "moderationStatus" = 'PENDING' OR "moderationStatus" = 'SCANNING' OR "moderationStatus" = 'SCANNING_FAILED';`);
    await client.query(`UPDATE "DirectMessage" SET "moderationStatus" = 'SAFE' WHERE "moderationStatus" = 'APPROVED';`);
    await client.query(`UPDATE "DirectMessage" SET "moderationStatus" = 'REJECTED' WHERE "moderationStatus" = 'FLAGGED';`);

    await client.query(`TRUNCATE TABLE "ModerationCache";`);
    
    // Create new enum
    await client.query(`CREATE TYPE "ModerationStatus" AS ENUM ('SAFE', 'SENSITIVE', 'PENDING_MODERATION', 'REJECTED');`);
    
    // Alter columns
    await client.query(`ALTER TABLE "Post" ALTER COLUMN "moderationStatus" DROP DEFAULT;`);
    await client.query(`ALTER TABLE "Post" ALTER COLUMN "moderationStatus" TYPE "ModerationStatus" USING "moderationStatus"::text::"ModerationStatus";`);
    await client.query(`ALTER TABLE "Post" ALTER COLUMN "moderationStatus" SET DEFAULT 'PENDING_MODERATION'::"ModerationStatus";`);

    await client.query(`ALTER TABLE "Message" ALTER COLUMN "moderationStatus" DROP DEFAULT;`);
    await client.query(`ALTER TABLE "Message" ALTER COLUMN "moderationStatus" TYPE "ModerationStatus" USING "moderationStatus"::text::"ModerationStatus";`);
    await client.query(`ALTER TABLE "Message" ALTER COLUMN "moderationStatus" SET DEFAULT 'PENDING_MODERATION'::"ModerationStatus";`);

    await client.query(`ALTER TABLE "DirectMessage" ALTER COLUMN "moderationStatus" DROP DEFAULT;`);
    await client.query(`ALTER TABLE "DirectMessage" ALTER COLUMN "moderationStatus" TYPE "ModerationStatus" USING "moderationStatus"::text::"ModerationStatus";`);
    await client.query(`ALTER TABLE "DirectMessage" ALTER COLUMN "moderationStatus" SET DEFAULT 'PENDING_MODERATION'::"ModerationStatus";`);

    await client.query(`ALTER TABLE "ModerationCache" ALTER COLUMN "status" TYPE "ModerationStatus" USING "status"::text::"ModerationStatus";`);

    // Drop old enum
    await client.query(`DROP TYPE "ModerationStatus_old";`);

    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
