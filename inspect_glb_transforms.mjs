/**
 * Use Puppeteer to navigate to the Practice 3D view, wait for render,
 * grab the console logs, and take a screenshot.
 */
import puppeteer from 'puppeteer';
import path from 'path';

const screenshotPath = path.resolve('opponent_verify_screenshot.png');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1536, height: 826 });
  
  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    if (msg.text().includes('Box3') || msg.text().includes('CHAR NODE') || msg.text().includes('CHARACTER')) {
      logs.push(msg.text());
    }
  });
  
  console.log('Navigating to chamber-clash...');
  await page.goto('http://localhost:3000/dashboard/games/chamber-clash', { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Click "Create Lobby"
  console.log('Looking for Create Lobby button...');
  await page.waitForSelector('button', { timeout: 10000 });
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Create Lobby')) {
      console.log('Clicking Create Lobby...');
      await btn.click();
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Click "Practice 3D View (Dev)"
  console.log('Looking for Practice 3D View button...');
  const buttons2 = await page.$$('button');
  for (const btn of buttons2) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Practice 3D')) {
      console.log('Clicking Practice 3D View...');
      await btn.click();
      break;
    }
  }
  
  // Wait for 3D scene to render
  console.log('Waiting 5 seconds for 3D scene to render...');
  await new Promise(r => setTimeout(r, 5000));
  
  // Take screenshot
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Screenshot saved to: ${screenshotPath}`);
  
  // Print collected logs
  if (logs.length > 0) {
    console.log('\n=== CONSOLE LOGS ===');
    logs.forEach(l => console.log(l));
  } else {
    console.log('\nNo Box3/CHARACTER logs captured (they may have fired before listener was attached)');
  }
  
  await browser.close();
  console.log('Done!');
})();
