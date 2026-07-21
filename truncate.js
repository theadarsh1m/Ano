const { Client } = require('pg');
require('dotenv').config({ path: 'd:/Adarsh learning/My projects/ano/.env' });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query(`TRUNCATE TABLE "ModerationCache";`);
    console.log("Truncated!");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
