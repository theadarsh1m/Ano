import puppeteer from 'puppeteer-core';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    defaultViewport: { width: 1536, height: 826 },
    args: ['--window-size=1536,826']
  });

  // --- Client A (Host) ---
  const contextA = await browser.createBrowserContext();
  const pageA = await contextA.newPage();
  
  console.log('Client A: Logging in...');
  await pageA.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await pageA.waitForSelector('input[type="text"]');
  await pageA.type('input[type="text"]', 'HostUser');
  await pageA.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Continue as Guest')).click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  console.log('Client A: Navigating to lobby...');
  await pageA.goto('http://localhost:3000/dashboard/games/chamber-clash', { waitUntil: 'networkidle2' });

  await pageA.screenshot({ path: 'debug_client_a.png' });
  
  // Find and click "Create Lobby"
  await pageA.waitForSelector('button');
  await pageA.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Create Lobby')).click();
  });
  
  // Get gameId from URL by polling (removed, we just use the lobby list)
  console.log('Created Lobby!');

  // --- Client B (Guest) ---
  const contextB = await browser.createBrowserContext();
  const pageB = await contextB.newPage();
  
  console.log('Client B: Logging in...');
  await pageB.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await pageB.waitForSelector('input[type="text"]');
  await pageB.type('input[type="text"]', 'GuestUser');
  await pageB.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Continue as Guest')).click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  console.log('Client B: Navigating to games page...');
  await pageB.goto('http://localhost:3000/dashboard/games/chamber-clash', { waitUntil: 'networkidle2' });

  // Client B: Click Join
  console.log('Client B: Clicking Join...');
  await pageB.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Join')));
  await pageB.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Join')).click();
  });

  await new Promise(r => setTimeout(r, 2000));

  // Client B: Click Ready
  console.log('Client B: Clicking Ready...');
  await pageB.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Ready')));
  await pageB.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Ready')).click();
  });

  await new Promise(r => setTimeout(r, 2000));

  // Client A: Click Start Match
  console.log('Client A: Clicking Start Match...');
  await pageA.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Start Match') && !b.disabled));
  await pageA.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Start Match')).click();
  });

  console.log('Game started! Waiting for animations to complete...');
  await new Promise(r => setTimeout(r, 15000)); // Wait for round start and item distribution

  // Extract Game State
  const gameStateA = await pageA.evaluate(() => window.__GAME_STATE);
  const gameStateB = await pageB.evaluate(() => window.__GAME_STATE);

  console.log('\n--- VERIFICATION REPORT ---');
  
  console.log('\nCLIENT A (Host)');
  // Take Screenshots FIRST before any evaluation logic that could crash
  await pageA.screenshot({ path: 'client_A_screenshot.png' });
  await pageB.screenshot({ path: 'client_B_screenshot.png' });
  console.log('\nScreenshots saved to client_A_screenshot.png and client_B_screenshot.png');

  console.log('\n--- VERIFICATION REPORT ---');
  
  console.log('\nCLIENT A (Host) View of Server Data:');
  if (gameStateA && gameStateA.players) {
    gameStateA.players.forEach((p, idx) => {
      console.log(`Player ${idx + 1} (${p.nickname}):`);
      console.log(`  ID: ${p.userId}`);
      console.log(`  Inventory:`, p.inventory);
    });
  } else {
    console.log('gameStateA is undefined or has no players. (Possible unmount or sync issue)');
  }

  console.log('\nCLIENT B (Guest) View of Server Data:');
  if (gameStateB && gameStateB.players) {
    gameStateB.players.forEach((p, idx) => {
      console.log(`Player ${idx + 1} (${p.nickname}):`);
      console.log(`  ID: ${p.userId}`);
      console.log(`  Inventory:`, p.inventory);
    });
  } else {
    console.log('gameStateB is undefined or has no players. (Possible unmount or sync issue)');
  }

  await browser.close();
})();
