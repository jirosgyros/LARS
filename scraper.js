const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { loadJson, saveJson } = require('./data');
const { SEARCH_KEYWORDS, meetsHardFilters, parseSalary } = require('./filters');

const SESSION_DIR = path.join(__dirname, '.session');
const STATE_FILE = path.join(SESSION_DIR, 'state.json');

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

const BROWSER_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-infobars',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function randomDelay(min = 2000, max = 5000) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

async function createBrowser(headless = true) {
  const browser = await chromium.launch({
    headless,
    args: BROWSER_ARGS,
  });
  const contextOptions = {
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  };
  if (headless && fs.existsSync(STATE_FILE)) {
    contextOptions.storageState = STATE_FILE;
  }
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
  });
  return { browser, context };
}

async function runLogin() {
  console.log('Opening LinkedIn for manual login...');
  console.log('Log in manually, then close the browser window when done.\n');

  const { browser, context } = await createBrowser(false);
  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  try {
    while (true) {
      await page.waitForTimeout(2000);
      const url = page.url();
      if (url.includes('/feed') || url.includes('/jobs') || url.includes('/mynetwork')) {
        console.log('Login detected. Saving session...');
        await context.storageState({ path: STATE_FILE });
        console.log(`Session saved to ${STATE_FILE}`);
        break;
      }
    }
  } catch {
    console.log('Browser closed.');
  } finally {
    await browser.close();
  }
}

async function isSessionValid(page) {
  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForTimeout(2000);
  return !page.url().includes('/login');
}

function markRotationComplete() {
  saveJson('rotation.json', { lastRun: new Date().toISOString(), keywords: SEARCH_KEYWORDS.length });
}

async function scrapeJobCards(page) {
  // Scroll through the results list to trigger lazy loading
  const listSel = '.jobs-search-results-list, .jobs-search__results-list, .scaffold-layout__list';
  for (let i = 0; i < 8; i++) {
    await page.evaluate((sel) => {
      const list = document.querySelector(sel);
      if (list) list.scrollTop += 600;
      else window.scrollBy(0, 600);
    }, listSel);
    await randomDelay(800, 1500);
  }

  const cards = await page.evaluate((sel) => {
    const results = [];
    const resultsList = document.querySelector(sel);
    const container = resultsList || document;
    const jobCards = container.querySelectorAll('.job-card-container, .jobs-search-results__list-item');

    jobCards.forEach(card => {
      const cardText = card.innerText || '';

      const titleEl = card.querySelector('.job-card-list__title, .job-card-container__link, a[data-control-name]');
      const companyEl = card.querySelector('.job-card-container__primary-description, .job-card-container__company-name, .artdeco-entity-lockup__subtitle');
      const locationEl = card.querySelector('.job-card-container__metadata-item, .artdeco-entity-lockup__caption');
      const linkEl = card.querySelector('a[href*="/jobs/view/"]');

      const jobId = card.getAttribute('data-job-id')
        || (linkEl && linkEl.href.match(/\/jobs\/view\/(\d+)/)?.[1])
        || null;

      if (jobId) {
        const salaryMatch = cardText.match(/\$[\d,]+(?:\s*[-–\/]\s*\$[\d,]+)?/);
        results.push({
          jobId,
          title: titleEl?.innerText?.trim() || '',
          company: companyEl?.innerText?.trim() || '',
          location: locationEl?.innerText?.trim() || '',
          cardSalary: salaryMatch ? salaryMatch[0] : null,
          url: linkEl ? linkEl.href.split('?')[0] : `https://www.linkedin.com/jobs/view/${jobId}/`,
        });
      }
    });
    return results;
  }, listSel);

  return cards;
}

async function scrapeJobDetail(page, job) {
  await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await randomDelay(2000, 4000);

  // Wait for description content to render (LinkedIn lazy-loads it)
  try {
    await page.waitForSelector('#job-details, .jobs-description__content, .jobs-description, article', { timeout: 8000 });
  } catch {
    // Continue anyway, we'll try to extract what we can
  }
  await randomDelay(1000, 2000);

  const detail = await page.evaluate(() => {
    // Try CSS selectors first, fall back to extracting from body text
    const descSelectors = [
      '#job-details',
      '.jobs-description__content',
      '.jobs-description',
      '.jobs-box__html-content',
      'article[class*="jobs"]',
    ];
    let descText = '';
    for (const sel of descSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 50) {
        descText = el.innerText.trim();
        break;
      }
    }
    // Fallback: extract everything after "About the job"
    if (!descText) {
      const body = document.body.innerText || '';
      const marker = body.indexOf('About the job');
      if (marker !== -1) {
        descText = body.substring(marker + 'About the job'.length).trim();
        // Trim at common footer sections
        const cutoffs = ['Show less', 'Show more', 'People also viewed', 'Similar jobs', 'About the company'];
        for (const cut of cutoffs) {
          const idx = descText.indexOf(cut);
          if (idx > 100) descText = descText.substring(0, idx).trim();
        }
      }
    }

    // Find salary anywhere on page -- grab all text nodes matching a dollar pattern
    let salaryText = null;
    const salarySelectors = [
      '.salary-main-rail__data-body',
      '.jobs-unified-top-card__job-insight--highlight',
      '.job-details-jobs-unified-top-card__job-insight--highlight',
      '.job-details-jobs-unified-top-card__job-insight',
      '[class*="salary"]',
      '[class*="compensation"]',
    ];
    for (const sel of salarySelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = el.innerText || '';
        if (/\$[1-9][\d,]{3,}/.test(text) || /\$[\d.]+[kK]/.test(text)) {
          salaryText = text.trim();
          break;
        }
      }
      if (salaryText) break;
    }
    // Fallback: scan description first, then full body
    if (!salaryText) {
      const salaryPattern = /\$[1-9][\d,]{3,}(?:\.?\d*)(?:\s*[-–\/]\s*\$[1-9][\d,]{3,}(?:\.?\d*))?\s*(?:\/yr|per year|annually|a year|\/year)?/i;
      // Prefer description text -- avoids spurious UI/page matches
      if (descText) {
        const descMatch = descText.match(salaryPattern);
        if (descMatch) salaryText = descMatch[0];
      }
      // Only fall back to full body if description had nothing
      if (!salaryText) {
        const body = document.body.innerText || '';
        const salaryMatch = body.match(salaryPattern);
        if (salaryMatch) salaryText = salaryMatch[0];
      }
    }

    const jobTypeEl = document.querySelector('.jobs-unified-top-card__workplace-type, [class*="workplace-type"]');

    return {
      description: descText,
      salary: salaryText,
      jobType: jobTypeEl?.innerText?.trim() || '',
    };
  });

  return { ...job, ...detail };
}

async function runScrape() {
  console.log('Phase 1: Scrape LinkedIn Jobs\n');

  if (!fs.existsSync(STATE_FILE)) {
    console.log('No session found. Run: node job-search.js login');
    return;
  }

  const { browser, context } = await createBrowser(true);
  const page = await context.newPage();

  try {
    const valid = await isSessionValid(page);
    if (!valid) {
      console.log('Session expired. Run: node job-search.js login');
      return;
    }
    console.log('Session valid.\n');

    const seen = new Set(loadJson('seen.json').map(s => s.jobId || s));
    let totalCards = 0;
    let totalNew = 0;
    let totalMatched = 0;

    function persistSeen() {
      const allSeen = [...seen].map(id => typeof id === 'string' ? { jobId: id } : id);
      saveJson('seen.json', allSeen);
    }

    for (const keyword of SEARCH_KEYWORDS) {
      console.log(`--- Searching: "${keyword}" ---\n`);

      let cards = [];
      try {
        const MAX_PAGES = 3;
        for (let pageNum = 0; pageNum < MAX_PAGES; pageNum++) {
          const params = new URLSearchParams({
            keywords: keyword,
            location: 'United States',
            f_WT: '2',
            f_TPR: 'r604800', // Past week
            f_JT: 'F',
            start: String(pageNum * 25),
          });

          await page.goto(`https://www.linkedin.com/jobs/search/?${params}`, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
          });
          await randomDelay(3000, 5000);

          const pageCards = await scrapeJobCards(page);
          if (pageCards.length === 0) break;
          cards.push(...pageCards);
          if (pageNum < MAX_PAGES - 1) await randomDelay(2000, 4000);
        }
      } catch (e) {
        console.log(`  Search failed: ${e.message}, skipping keyword\n`);
        continue;
      }

      // Deduplicate across pages before checking seen
      const uniqueCards = [...new Map(cards.map(c => [c.jobId, c])).values()];
      totalCards += uniqueCards.length;
      const newCards = uniqueCards.filter(c => !seen.has(c.jobId));
      totalNew += newCards.length;
      console.log(`  ${cards.length} cards, ${newCards.length} new\n`);

      for (let i = 0; i < newCards.length; i++) {
        const card = newCards[i];
        process.stdout.write(`  [${i + 1}/${newCards.length}] ${card.company} - ${card.title} ... `);

        try {
          const detail = await scrapeJobDetail(page, card);
          // Use detail salary, fall back to card salary, fall back to LinkedIn filter floor
          if (!detail.salary && card.cardSalary) detail.salary = card.cardSalary;
          // No salary found -- don't assume; hard filter will reject
          const filterResult = meetsHardFilters(detail);

          seen.add(card.jobId);

          if (filterResult.pass) {
            const match = {
              ...detail,
              searchKeyword: keyword,
              salaryMidpoint: parseSalary(detail.salary),
              flags: filterResult.flags,
              scrapedAt: new Date().toISOString(),
              ranked: false,
            };
            // Save match immediately
            const matches = loadJson('matches.json');
            matches.push(match);
            saveJson('matches.json', matches);
            totalMatched++;
            console.log(`MATCH${filterResult.flags.length ? ` [${filterResult.flags.join(', ')}]` : ''}`);
          } else {
            console.log(`filtered (${filterResult.reason})`);
          }
        } catch (e) {
          console.log(`ERROR -- ${e.message}`);
          seen.add(card.jobId);
        }

        // Persist seen after every job so we never re-visit
        persistSeen();

        await randomDelay();
      }

      // Delay between keyword searches to avoid rate limiting
      await randomDelay(3000, 6000);
    }

    markRotationComplete();

    const finalMatches = loadJson('matches.json').length;
    console.log(`\nScrape complete: searched ${SEARCH_KEYWORDS.length} keywords`);
    console.log(`  ${totalCards} total cards, ${totalNew} new, ${totalMatched} matched`);
    console.log(`  Total unreviewed: ${finalMatches}`);

  } finally {
    await browser.close();
  }
}

module.exports = { runLogin, runScrape };
