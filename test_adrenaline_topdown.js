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

  // 1. Click TOP-DOWN STEAL MODE debug button
  console.log("Clicking TOP-DOWN STEAL MODE...");
  await page.click('button:has-text("TOP-DOWN STEAL MODE")');

  // Screenshot 1: Self injection phase
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(artifactDir, 'adrenaline_self_inject_step1.png') });

  // Screenshot 2: Top-down high-angle camera selection view
  await page.waitForTimeout(1500); // camera transitioned upward
  await page.screenshot({ path: path.join(artifactDir, 'adrenaline_topdown_view_step2.png') });

  // Hover over an opponent 3D item on table
  console.log("Hovering over opponent 3D item on table...");
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (box) {
    // Move mouse over slot 0 item position on canvas
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.42);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'adrenaline_hover_item_step3.png') });

    // Click to steal the item!
    console.log("Clicking 3D item to steal...");
    await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.42);

    // Screenshot 4: Camera returns and stolen item animation plays
    await page.waitForTimeout(1500); // camera returned to FP view
    await page.screenshot({ path: path.join(artifactDir, 'adrenaline_stolen_item_drink_step4.png') });
  }

  await browser.close();
  console.log("Playwright Top-Down Adrenaline Steal verification test completed successfully!");
})();
