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
  pageA.on('console', msg => console.log('Client A [BROWSER]:', msg.text()));
  pageA.on('pageerror', err => console.log('Client A [ERROR]:', err.toString()));
  
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
  pageB.on('console', msg => console.log('Client B [BROWSER]:', msg.text()));
  pageB.on('pageerror', err => console.log('Client B [ERROR]:', err.toString()));
  
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

  console.log('Game started! Waiting 3s for round start animations...');
  await new Promise(r => setTimeout(r, 3000));

  // STEP 1: Click Shoot Target to enter targeting mode
  console.log('Client A: Clicking [Shoot Target]...');
  await pageA.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(el => el.textContent?.includes('Shoot Target'));
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 500));

  // STEP 2: Click the center of the canvas where the opponent is
  console.log('Client A: Clicking the 3D opponent (canvas center)...');
  const canvas = await pageA.$('canvas');
  if (canvas) {
    const box = await canvas.boundingBox();
    if (box) {
      // Opponent is roughly at center-top (Y=0.77, Z=-0.9), so let's click horizontally center, slightly above vertical center
      await pageA.mouse.click(box.x + box.width / 2, box.y + box.height * 0.4);
    }
  }

  console.log('Waiting 3s for shot animation / state update...');
  await new Promise(r => setTimeout(r, 3000));

  // Wait for the game UI to mount by looking for the Shoot Target button
  await pageA.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).some(el => el.textContent?.includes('Shoot Target'));
  }, { timeout: 30000 });

  // Check if a shot was fired by inspecting the actionLog
  const { gameStateA } = await pageA.evaluate(() => {
    return {
      gameStateA: window.__GAME_STATE
    };
  });

  console.log('\n--- INTERACTION TEST REPORT ---');
  if (gameStateA) {
    const logs = gameStateA.actionLog || [];
    const shotLog = logs.find((l) => l.message.includes('shot'));
    if (shotLog) {
      console.log('✅ SUCCESS: Opponent targeting in 3D triggered a shot! Log:', shotLog.message);
    } else {
      console.log('❌ FAILED: No shot found in action log. Interaction may not have worked.');
    }
  } else {
    console.log('❌ FAILED: Could not retrieve game state.');
  }

  await browser.close();
})();
