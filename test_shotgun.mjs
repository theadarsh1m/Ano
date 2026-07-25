import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  console.log('Navigating...');
  await page.goto('http://localhost:3000/dashboard/games/chamber-clash');

  console.log('Logging in as guest...');
  try {
    await page.waitForSelector('button:has-text("Play as Guest")', { timeout: 3000 });
    const buttons = await page.$$('button');
    for (const b of buttons) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes("Play as Guest")) {
        await b.click();
        break;
      }
    }
  } catch (e) {
    console.log('Already logged in or no guest button.');
  }

  console.log('Waiting for Practice 3D View button...');
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Practice 3D View (Dev)'));
  }, { timeout: 5000 });
  
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Practice 3D View (Dev)'));
    if (btn) btn.click();
  });

  console.log('Waiting for DEBUG SHOTGUN ANIMATION button...');
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('DEBUG SHOTGUN ANIMATION'));
  }, { timeout: 10000 });

  console.log('Clicking DEBUG SHOTGUN ANIMATION...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('DEBUG SHOTGUN ANIMATION'));
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 4000));
  
  await browser.close();
  console.log('Done.');
})();
