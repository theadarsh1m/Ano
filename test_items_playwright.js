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

  // 1. Test LOCAL PHONE (Flip phone open + private screen)
  console.log("Clicking LOCAL PHONE...");
  await page.click('button:has-text("LOCAL PHONE")');
  await page.waitForTimeout(1400); // mid-reading phase
  const phonePath = path.join(artifactDir, 'burner_phone_private_screen.png');
  await page.screenshot({ path: phonePath });
  console.log(`Saved screenshot: ${phonePath}`);
  await page.waitForTimeout(2500);

  // 2. Test LOCAL BEER LIVE (Drink + ejected shell landing on table)
  console.log("Clicking LOCAL BEER LIVE...");
  await page.click('button:has-text("LOCAL BEER LIVE")');
  await page.waitForTimeout(2300); // shell ejected and resting on table
  const beerPath = path.join(artifactDir, 'beer_shell_ejected_table.png');
  await page.screenshot({ path: beerPath });
  console.log(`Saved screenshot: ${beerPath}`);
  await page.waitForTimeout(2000);

  // 3. Test STEAL BEER (Adrenaline self-injection -> Beer drink & shell eject)
  console.log("Clicking STEAL BEER...");
  await page.click('button:has-text("STEAL BEER")');
  await page.waitForTimeout(800); // self injection phase
  const adrenalinePath = path.join(artifactDir, 'adrenaline_self_inject.png');
  await page.screenshot({ path: adrenalinePath });
  console.log(`Saved screenshot: ${adrenalinePath}`);
  await page.waitForTimeout(3000);

  await browser.close();
  console.log("Playwright item verification completed successfully!");
})();
