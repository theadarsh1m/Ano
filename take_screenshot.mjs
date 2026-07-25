import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotPath = path.resolve(__dirname, 'table_preview.png');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1536, height: 826 });

  page.on('console', msg => {
    if (msg.text().includes('OPPONENT') || msg.text().includes('Interaction')) {
      console.log('BROWSER:', msg.text());
    }
  });

  console.log('Navigating...');
  await page.goto('http://localhost:3000/test-3d', { waitUntil: 'networkidle2' });

  console.log('Waiting for render...');
  await new Promise(r => setTimeout(r, 15000));
  
  await page.screenshot({ path: screenshotPath });
  console.log('Saved to', screenshotPath);

  await browser.close();
})();
