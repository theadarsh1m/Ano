const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log("Launching Chromium via Playwright...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  // Pre-seed localStorage with ano-session so useUserStore has id and nickname
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

  // Click Practice Mode button to start the game
  console.log("Clicking Practice Mode button...");
  const practiceBtn = page.locator('button:has-text("Practice Mode (Single Player)")');
  await practiceBtn.click();

  // Wait 4s for round overlay and 3D scene to mount
  console.log("Waiting for 3D scene to mount...");
  await page.waitForTimeout(4000);

  // 1. Test SHOOT OPP LIVE
  console.log("Clicking SHOOT OPP LIVE...");
  const oppBtn = page.locator('button:has-text("SHOOT OPP LIVE")');
  await oppBtn.click();

  // Wait 0.95s to hit AIM_SETTLE phase (before firing at 1.2s)
  await page.waitForTimeout(950);

  const oppShotPath = path.join(artifactDir, 'opp_shot_aim_settle.png');
  await page.screenshot({ path: oppShotPath });
  console.log(`Saved screenshot: ${oppShotPath}`);

  // Wait for return to rest
  await page.waitForTimeout(3500);

  // 2. Test SHOOT SELF LIVE
  console.log("Clicking SHOOT SELF LIVE...");
  const selfBtn = page.locator('button:has-text("SHOOT SELF LIVE")');
  await selfBtn.click();

  // Wait 0.95s to hit AIM_SETTLE phase
  await page.waitForTimeout(950);

  const selfShotPath = path.join(artifactDir, 'self_shot_aim_settle.png');
  await page.screenshot({ path: selfShotPath });
  console.log(`Saved screenshot: ${selfShotPath}`);

  await browser.close();
  console.log("Playwright aim verification completed successfully!");
})();
