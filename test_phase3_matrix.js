const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log("Launching Chromium via Playwright...");
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
  const practiceBtn = page.locator('button:has-text("Practice Mode (Single Player)")');
  await practiceBtn.click();
  await page.waitForTimeout(4000);

  // 1. OPPONENT SHOT — AIM_SETTLE, FIRING, RECOILING
  console.log("Testing SHOOT OPP LIVE...");
  await page.click('button:has-text("SHOOT OPP LIVE")');
  
  await page.waitForTimeout(700); // AIM_SETTLE
  await page.screenshot({ path: path.join(artifactDir, 'opp_aim_settle.png') });
  
  await page.waitForTimeout(250); // FIRING moment
  await page.screenshot({ path: path.join(artifactDir, 'opp_firing_moment.png') });
  
  await page.waitForTimeout(150); // RECOILING
  await page.screenshot({ path: path.join(artifactDir, 'opp_recoiling.png') });

  await page.waitForTimeout(2500); // Return to rest

  // 2. SELF SHOT — AIM_SETTLE, FIRING, RECOILING
  console.log("Testing SHOOT SELF LIVE...");
  await page.click('button:has-text("SHOOT SELF LIVE")');
  
  await page.waitForTimeout(700); // AIM_SETTLE
  await page.screenshot({ path: path.join(artifactDir, 'self_aim_settle.png') });

  await page.waitForTimeout(250); // FIRING moment
  await page.screenshot({ path: path.join(artifactDir, 'self_firing_moment.png') });

  await page.waitForTimeout(2500); // Return to rest

  // 3. LOCAL BEER vs OPPONENT BEER
  console.log("Testing LOCAL BEER LIVE...");
  await page.click('button:has-text("LOCAL BEER LIVE")');
  await page.waitForTimeout(1000); // DRINKing phase
  await page.screenshot({ path: path.join(artifactDir, 'local_beer_drink.png') });
  await page.waitForTimeout(2500);

  console.log("Testing OPP BEER LIVE...");
  await page.click('button:has-text("OPP BEER LIVE")');
  await page.waitForTimeout(1000); // OPPONENT DRINKing phase
  await page.screenshot({ path: path.join(artifactDir, 'opp_beer_drink.png') });
  await page.waitForTimeout(2500);

  // 4. LOCAL PHONE vs OPPONENT PHONE
  console.log("Testing LOCAL PHONE...");
  await page.click('button:has-text("LOCAL PHONE")');
  await page.waitForTimeout(1400); // SCREEN_OPEN phase
  await page.screenshot({ path: path.join(artifactDir, 'local_phone_screen.png') });
  await page.waitForTimeout(2500);

  console.log("Testing OPP PHONE (SECRET)...");
  await page.click('button:has-text("OPP PHONE (SECRET)")');
  await page.waitForTimeout(1400); // SCREEN_OPEN phase
  await page.screenshot({ path: path.join(artifactDir, 'opp_phone_secret.png') });
  await page.waitForTimeout(2500);

  await browser.close();
  console.log("Full Phase 3.1 matrix verification test completed successfully!");
})();
