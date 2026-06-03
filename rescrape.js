const { chromium } = require('playwright');
const path = require('path');
const { loadJson, saveJson } = require('./data');
const { parseSalary } = require('./filters');

(async () => {
  const STATE_FILE = path.join(__dirname, '.session', 'state.json');
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    storageState: STATE_FILE,
  });
  const page = await context.newPage();

  const approved = loadJson('approved.json');
  for (const job of approved) {
    console.log('Fetching:', job.company, '-', job.title.split('\n')[0]);
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);

    const detail = await page.evaluate(() => {
      const sels = ['#job-details', '.jobs-description__content', '.jobs-description', '.jobs-box__html-content'];
      let descText = '';
      for (const s of sels) {
        const el = document.querySelector(s);
        if (el && el.innerText && el.innerText.trim().length > 50) {
          descText = el.innerText.trim();
          break;
        }
      }
      if (!descText) {
        const body = document.body.innerText || '';
        const marker = body.indexOf('About the job');
        if (marker !== -1) {
          descText = body.substring(marker + 'About the job'.length).trim();
          const cutoffs = ['Show less', 'Show more', 'People also viewed', 'Similar jobs', 'About the company'];
          for (const cut of cutoffs) {
            const idx = descText.indexOf(cut);
            if (idx > 100) descText = descText.substring(0, idx).trim();
          }
        }
      }
      let salary = null;
      const body = document.body.innerText || '';
      const salMatch = body.match(/\$[\d,]+(?:\.?\d*)(?:\s*[-\u2013\/]\s*\$[\d,]+(?:\.?\d*))?\s*(?:\/yr|per year|annually|a year)?/i);
      if (salMatch) salary = salMatch[0];
      return { description: descText, salary };
    });

    job.description = detail.description || job.description;
    if (detail.salary) {
      job.salary = detail.salary;
      job.salaryMidpoint = parseSalary(detail.salary);
    }
    job.title = job.title.split('\n')[0];
    console.log('  Description:', (job.description || '').length, 'chars');
    console.log('  Salary:', job.salary);
    await page.waitForTimeout(2000);
  }

  saveJson('approved.json', approved);
  await browser.close();
  console.log('Done.');
})();
