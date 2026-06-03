const path = require('path');
const fs = require('fs');
const { loadJson, saveJson } = require('./data');

const RESUME_PATH = path.join(__dirname, 'resumes', 'base.md');

function loadResume() {
  if (!fs.existsSync(RESUME_PATH)) {
    throw new Error('Base resume not found at resumes/base.md');
  }
  return fs.readFileSync(RESUME_PATH, 'utf8');
}

// Prints unranked jobs for Claude Code to score in-conversation.
// Rankings are applied manually via `node job-search.js apply-rankings <json>`.
async function runRank() {
  console.log('Phase 2: Rank matches\n');

  const matches = loadJson('matches.json');
  const unranked = matches.filter(m => !m.ranked);

  if (unranked.length === 0) {
    console.log('No unranked matches to score.');
    return;
  }

  console.log(`${unranked.length} unranked jobs ready for review:\n`);

  unranked.forEach((j, i) => {
    const salary = j.salary && !j.salary.startsWith('$0') ? j.salary : 'Not listed';
    console.log(`[${i}] ${j.company} — ${j.title}`);
    console.log(`    Salary: ${salary} | Location: ${j.location || 'Not specified'}`);
    console.log(`    URL: ${j.url}`);
    console.log(`    ${(j.description || '').slice(0, 300).replace(/\n/g, ' ')}...`);
    console.log('');
  });
}

// Apply rankings from a JSON array: [{jobIndex, score, rationale}]
function applyRankings(rankingsJson) {
  const matches = loadJson('matches.json');
  const unranked = matches.filter(m => !m.ranked);
  let rankings;

  try {
    rankings = JSON.parse(rankingsJson);
  } catch (e) {
    throw new Error('Invalid JSON: ' + e.message);
  }

  for (const rank of rankings) {
    const match = unranked[rank.jobIndex];
    if (match) {
      match.score = rank.score;
      match.rationale = rank.rationale;
      match.ranked = true;
    }
  }

  matches.sort((a, b) => (b.score || 0) - (a.score || 0));
  saveJson('matches.json', matches);

  console.log('Rankings applied:\n');
  matches.filter(m => m.ranked).forEach((m, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. [${m.score}] ${m.company} — ${m.title}`);
    console.log(`      ${m.rationale}`);
    console.log('');
  });
}

module.exports = { runRank, applyRankings };
