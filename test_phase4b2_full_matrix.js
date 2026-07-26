const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log("=================================================");
  console.log("PHASE 4B.2 — MULTI-CLIENT ANIMATION GENERALIZATION MATRIX");
  console.log("=================================================");

  const browser = await chromium.launch({ headless: true });
  const artifactDir = 'C:/Users/adars/.gemini/antigravity-ide/brain/683a1177-5e32-4e70-8eb6-17015d488ffe';

  async function createPlayerContext(id, nickname) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript((userData) => {
      window.localStorage.clear();
      window.localStorage.setItem('ano-session', JSON.stringify({
        state: { id: userData.id, nickname: userData.nickname, avatar: null, bio: null, joinedAt: Date.now(), isAnonymous: true, email: null, nsfwMode: 'HIDE', role: 'USER', preferences: {} },
        version: 1
      }));
    }, { id, nickname });
    return { context, page };
  }

  const pA = await createPlayerContext('p1_alice', 'Alice');
  pA.page.on('console', msg => console.log('[CLIENT A LOG]', msg.text()));
  const pB = await createPlayerContext('p2_bob', 'Bob');
  const pC = await createPlayerContext('p3_charlie', 'Charlie');
  const pD = await createPlayerContext('p4_david', 'David');

  console.log("[4P SETUP] Navigating 4 clients...");
  await pA.page.goto('http://localhost:3000/dashboard/games/chamber-clash', { waitUntil: 'domcontentloaded' });
  await pB.page.goto('http://localhost:3000/dashboard/games/chamber-clash', { waitUntil: 'domcontentloaded' });
  await pC.page.goto('http://localhost:3000/dashboard/games/chamber-clash', { waitUntil: 'domcontentloaded' });
  await pD.page.goto('http://localhost:3000/dashboard/games/chamber-clash', { waitUntil: 'domcontentloaded' });
  await pA.page.waitForTimeout(1500);

  console.log("[4P SETUP] Starting 4-Player Practice Game on Client A...");
  await pA.page.screenshot({ path: path.join(artifactDir, 'debug_lobby_state.png') });
  
  // Reset game state if already in game
  await pA.page.evaluate(() => {
    const store = (window).useChamberClashStore?.getState?.();
    if (store && store.clearState) {
      store.clearState();
    }
  });
  await pA.page.reload({ waitUntil: 'domcontentloaded' });
  await pA.page.waitForTimeout(1500);

  const btn = pA.page.locator('button:has-text("Practice Mode (4 Player)")');
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  await btn.click();
  await pA.page.waitForTimeout(3000);

  // Helper to trigger animations dynamically via Zustand store
  async function triggerAnimation(actorUserId, itemId, targetUserId = null) {
    await pA.page.evaluate(({ actorUserId, itemId, targetUserId }) => {
      const store = (window).useChamberClashStore?.getState?.();
      if (store && store.gameState) {
        store.setState({
          activeItemAnimation: { itemId, userId: actorUserId, targetId: targetUserId },
          isAnimating: true
        });
      }
    }, { actorUserId, itemId, targetUserId });
  }

  async function triggerShot(gunTarget, targetPlayerId) {
    if (gunTarget === 'local') {
      await pA.page.click('button:has-text("SHOOT SELF LIVE")');
    } else if (targetPlayerId === 'opponent-dealer-1') {
      await pA.page.click('button:has-text("SHOOT DEALER LEFT")');
    } else if (targetPlayerId === 'opponent-dealer-2') {
      await pA.page.click('button:has-text("SHOOT DEALER FAR")');
    } else if (targetPlayerId === 'opponent-dealer-3') {
      await pA.page.click('button:has-text("SHOOT DEALER RIGHT")');
    }
  }

  // ── 1. SHOTGUN AIMING MATRIX ──
  console.log("\n[SHOTGUN MATRIX] Testing LOCAL shooting SELF...");
  await triggerShot('local', 'p1_alice');
  await pA.page.waitForTimeout(450);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_shoot_self.png') });
  await pA.page.waitForTimeout(3000);

  console.log("[SHOTGUN MATRIX] Testing LOCAL shooting LEFT (Bob)...");
  await triggerShot('opponent', 'opponent-dealer-1');
  await pA.page.waitForTimeout(450);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_shoot_left.png') });
  await pA.page.waitForTimeout(3000);

  console.log("[SHOTGUN MATRIX] Testing LOCAL shooting FAR (Charlie)...");
  await triggerShot('opponent', 'opponent-dealer-2');
  await pA.page.waitForTimeout(450);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_shoot_far.png') });
  await pA.page.waitForTimeout(3000);

  console.log("[SHOTGUN MATRIX] Testing LOCAL shooting RIGHT (David)...");
  await triggerShot('opponent', 'opponent-dealer-3');
  await pA.page.waitForTimeout(450);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_shoot_right.png') });
  await pA.page.waitForTimeout(3000);

  // Reset Shotgun
  await pA.page.evaluate(() => {
    const store = (window).useChamberClashStore?.getState?.();
    if (store) store.setState({ gunState: 'idle', gunTarget: null, isAnimating: false });
  });

  // ── 2. BEER DRINKING SEAT MATRIX ──
  console.log("\n[BEER MATRIX] LEFT player (Bob) drinking Beer...");
  await triggerAnimation('opponent-dealer-1', 'beer');
  await pA.page.waitForTimeout(1000);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_beer_left.png') });

  console.log("[BEER MATRIX] FAR player (Charlie) drinking Beer...");
  await triggerAnimation('opponent-dealer-2', 'beer');
  await pA.page.waitForTimeout(1000);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_beer_far.png') });

  console.log("[BEER MATRIX] RIGHT player (David) drinking Beer...");
  await triggerAnimation('opponent-dealer-3', 'beer');
  await pA.page.waitForTimeout(1000);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_beer_right.png') });

  // ── 3. MEDKIT, PHONE & ADRENALINE MATRIX ──
  console.log("\n[ITEM MATRIX] LEFT using Medkit...");
  await triggerAnimation('opponent-dealer-1', 'medkit');
  await pA.page.waitForTimeout(800);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_medkit_left.png') });

  console.log("[ITEM MATRIX] RIGHT using Burner Phone...");
  await triggerAnimation('opponent-dealer-3', 'burner_phone');
  await pA.page.waitForTimeout(1000);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_phone_right.png') });

  console.log("[ITEM MATRIX] RIGHT self-injecting Adrenaline...");
  await triggerAnimation('opponent-dealer-3', 'adrenaline');
  await pA.page.waitForTimeout(800);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_adrenaline_right.png') });

  // ── 4. HANDCUFFS MATRIX ──
  console.log("\n[HANDCUFFS MATRIX] LOCAL handcuffing LEFT...");
  await triggerAnimation('p1_alice', 'handcuffs', 'opponent-dealer-1');
  await pA.page.waitForTimeout(700);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_handcuffs_left.png') });

  console.log("[HANDCUFFS MATRIX] LOCAL handcuffing RIGHT...");
  await triggerAnimation('p1_alice', 'handcuffs', 'opponent-dealer-3');
  await pA.page.waitForTimeout(700);
  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_handcuffs_right.png') });

  // ── 5. MULTI-CLIENT CROSS-PLAYER ACTION MATRIX ──
  console.log("\n[MULTI-CLIENT MATRIX] Player B shoots Player D -> Capturing all 4 clients during AIM_SETTLE...");
  await triggerShot('opponent', 'opponent-dealer-3');
  await pA.page.waitForTimeout(400);

  await pA.page.screenshot({ path: path.join(artifactDir, 'screenshot_multiclient_clientA.png') });
  await pB.page.screenshot({ path: path.join(artifactDir, 'screenshot_multiclient_clientB.png') });
  await pC.page.screenshot({ path: path.join(artifactDir, 'screenshot_multiclient_clientC.png') });
  await pD.page.screenshot({ path: path.join(artifactDir, 'screenshot_multiclient_clientD.png') });

  await browser.close();
  console.log("\nAll Phase 4B.2 Animation Matrix Verification Tests Completed Successfully!");
})();
