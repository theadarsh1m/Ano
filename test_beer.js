const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.text().includes('[CC3D]')) {
      console.log('BROWSER:', msg.text());
    }
  });

  await page.goto('http://localhost:3000/dashboard/games/chamber-clash');
  console.log('Page loaded, waiting for canvas...');
  await page.waitForTimeout(2000);
  
  console.log('Clicking debug animate beer...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('DEBUG ANIMATE BEER'));
    if (btn) btn.click();
  });
  
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'beer_anim_test.png' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'beer_anim_test_mid.png' });
  await page.waitForTimeout(2000);
  
  await browser.close();
})();
