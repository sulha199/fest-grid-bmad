const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error));
  
  await page.goto('http://localhost:3001/en', { waitUntil: 'networkidle' });
  
  // Wait for the specific text
  try {
    await page.waitForSelector('text="Past Jazz Night 2025"', { timeout: 10000 });
    console.log("Success! Events loaded.");
  } catch (e) {
    const text = await page.evaluate(() => document.body.innerText);
    console.log("Failed to find events. Body:", text);
  }
  
  await browser.close();
})();