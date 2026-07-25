const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log("Launching Chromium for 3D Item Model Visual Verification...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.addInitScript(() => {
    window.localStorage.setItem('ano-session', JSON.stringify({
      state: {
        id: 'test_user_123',
        nickname: 'Tester',
        avatar: null,
        bio: null,
        joinedAt: Date.now(),
        isAnonymous: true,
        email: null,
        nsfwMode: 'HIDE',
        role: 'USER',
        preferences: { soundEnabled: true, notificationsEnabled: true, theme: 'dark' }
      },
      version: 1
    }));
  });

  const artifactDir = 'C:/Users/adars/.gemini/antigravity-ide/brain/683a1177-5e32-4e70-8eb6-17015d488ffe';

  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.text()));

  console.log("Navigating to game page...");
  await page.goto('http://localhost:3000/dashboard/games/chamber-clash', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  console.log("Clicking Practice Mode button...");
  await page.click('button:has-text("Practice Mode (Single Player)")');
  await page.waitForTimeout(4000);

  // 1. Capture inventory slots containing new Adrenaline, Medkit Bottle, Handsaw
  console.log("Capturing 3D inventory slot rendering...");
  await page.screenshot({ path: path.join(artifactDir, 'new_models_table_inventory.png') });

  // 2. Click Adrenaline debug / self injection button
  console.log("Testing Adrenaline self injection...");
  await page.click('button:has-text("TOP-DOWN STEAL MODE")');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(artifactDir, 'new_adrenaline_self_inject.png') });

  // Wait for top down transition to complete
  await page.waitForTimeout(1500);

  // 3. Click Handsaw debug button to test barrel cutting animation
  console.log("Testing Handsaw barrel cutting...");
  // First cancel steal mode
  await page.click('button:has-text("CANCEL")');
  await page.waitForTimeout(1000);

  await page.click('button:has-text("HANDSAW")');
  await page.waitForTimeout(1400); // During sawing stroke
  await page.screenshot({ path: path.join(artifactDir, 'new_handsaw_cutting_shotgun.png') });

  // 4. Click Medkit debug button to test bottle drinking animation
  await page.waitForTimeout(1500);
  console.log("Testing Medkit bottle drinking...");
  await page.click('button:has-text("MEDKIT")');
  await page.waitForTimeout(1000); // During drinking/tilt phase
  await page.screenshot({ path: path.join(artifactDir, 'new_medkit_bottle_drinking.png') });

  await browser.close();
  console.log("Visual verification script completed successfully!");
})();
