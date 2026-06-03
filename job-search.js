#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
}

const [,, command] = process.argv;

(async () => {
  switch (command) {
    case 'login': {
      const { runLogin } = require('./scraper');
      await runLogin();
      break;
    }
    case 'scrape': {
      const { runScrape } = require('./scraper');
      await runScrape();
      break;
    }
    case 'rank': {
      const { runRank } = require('./ranker');
      await runRank();
      break;
    }
    case 'review': {
      const { startServer } = require('./server');
      startServer();
      break;
    }
    case 'tailor': {
      const { runTailor } = require('./tailor');
      await runTailor();
      break;
    }
    case 'export': {
      const { runExport } = require('./pdf');
      await runExport();
      break;
    }
    case 'status': {
      const { loadJson } = require('./data');
      const seen = loadJson('seen.json');
      const matches = loadJson('matches.json');
      const approved = loadJson('approved.json');
      const rejected = loadJson('rejected.json');
      const tailoredDir = path.join(__dirname, 'resumes', 'tailored');
      const tailored = fs.existsSync(tailoredDir)
        ? fs.readdirSync(tailoredDir).filter(f => f.endsWith('.pdf')).length
        : 0;
      console.log(`Job Search Status:`);
      console.log(`  Seen:      ${seen.length}`);
      console.log(`  Matches:   ${matches.length} (unreviewed)`);
      console.log(`  Approved:  ${approved.length}`);
      console.log(`  Rejected:  ${rejected.length}`);
      console.log(`  Tailored:  ${tailored} PDFs`);
      break;
    }
    case 'apply-rankings': {
      const { applyRankings } = require('./ranker');
      const json = process.argv[3];
      if (!json) { console.error('Usage: node job-search.js apply-rankings \'[{"jobIndex":0,"score":85,"rationale":"..."}]\''); process.exit(1); }
      applyRankings(json);
      break;
    }
    case 'run': {
      const { runScrape } = require('./scraper');
      const { runRank } = require('./ranker');
      await runScrape();
      await runRank();
      break;
    }
    default:
      console.log('Usage: node job-search.js <command>\n');
      console.log('Commands:');
      console.log('  login             Manual LinkedIn login (seeds session)');
      console.log('  scrape            Search LinkedIn + validate matches');
      console.log('  rank              List unranked matches for review');
      console.log('  apply-rankings    Apply scores from Claude Code review (JSON arg)');
      console.log('  review            Start review UI at localhost:3000');
      console.log('  tailor            Generate tailored resumes for approved jobs');
      console.log('  export            Convert tailored markdown to PDF');
      console.log('  status            Print pipeline counts');
      console.log('  run               Scrape + list unranked matches');
  }
  if (command !== 'review' && command !== 'run') process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
