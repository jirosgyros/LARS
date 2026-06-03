const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { loadJson, saveJson } = require('./data');

const RESUME_PATH = path.join(__dirname, 'resumes', 'base.md');
const TAILORED_DIR = path.join(__dirname, 'resumes', 'tailored');

// LLM backend selection. Set LLM_BACKEND=api in .env to use Anthropic's
// per-token API; default is the `claude` CLI (subscription via Claude Code).
const LLM_BACKEND = (process.env.LLM_BACKEND || 'cli').toLowerCase();
const MODEL_API = 'claude-sonnet-4-20250514';
const MODEL_CLI = 'sonnet';

let _apiClient = null;
function apiClient() {
  if (_apiClient) return _apiClient;
  const Anthropic = require('@anthropic-ai/sdk');
  _apiClient = new Anthropic();
  return _apiClient;
}

async function callClaudeAPI(prompt, maxTokens = 4096) {
  const response = await apiClient().messages.create({
    model: MODEL_API,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
}

function callClaudeCLI(prompt) {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDECODE;

  const proc = spawnSync('claude', [
    '--dangerously-skip-permissions',
    '--model', MODEL_CLI,
    '--output-format', 'json',
    '-p', prompt,
  ], {
    env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (proc.status !== 0) {
    throw new Error(`claude CLI failed (exit ${proc.status}): ${(proc.stderr || '').slice(0, 500)}`);
  }

  let payload;
  try {
    payload = JSON.parse(proc.stdout);
  } catch {
    throw new Error(`claude CLI returned non-JSON: ${proc.stdout.slice(0, 200)}`);
  }

  if (!('result' in payload)) {
    throw new Error(`claude CLI response missing 'result' key: ${proc.stdout.slice(0, 200)}`);
  }

  return payload.result;
}

async function callClaude(prompt, maxTokens = 4096) {
  if (LLM_BACKEND === 'api') return callClaudeAPI(prompt, maxTokens);
  if (LLM_BACKEND === 'cli') return callClaudeCLI(prompt);
  throw new Error(`Unknown LLM_BACKEND '${LLM_BACKEND}'. Use 'cli' (default) or 'api'.`);
}

function loadResume() {
  if (!fs.existsSync(RESUME_PATH)) {
    throw new Error('Base resume not found at resumes/base.md');
  }
  return fs.readFileSync(RESUME_PATH, 'utf8');
}

function buildTailorPrompt(resume, job) {
  return `You are tailoring a resume for a specific job application. You MUST follow these rules strictly:

RULES:
1. ONLY use facts from the base resume. Do NOT invent skills, metrics, experience, certifications, or any claims not present in the base resume.
2. Rewrite the summary/objective to speak directly to this role's specific needs.
3. Reorder bullet points so the most relevant experience appears first under each role.
4. Rephrase bullets to mirror the job posting's terminology -- same facts, their words.
5. Surface relevant keywords from the posting that map to real experience in the resume.
6. If the job requires something NOT in the base resume, leave it out entirely. Do NOT fabricate.
7. Keep all dates, titles, company names, and certifications exactly as they appear in the base resume.
8. Output valid markdown matching the base resume's structure.

BASE RESUME:
${resume}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}

Output ONLY the tailored resume in markdown. No commentary, no explanations.`;
}

function buildValidationPrompt(baseResume, tailoredResume) {
  return `Compare the tailored resume against the base resume. Your job is to find ANY claim in the tailored resume that does not have a factual basis in the base resume.

Check for:
- Skills or tools mentioned in tailored but not in base
- Metrics or numbers that don't appear in base
- Experience claims not supported by base
- Certifications not listed in base
- Inflated titles or responsibilities
- Any fabricated content whatsoever
- Role scope inflation: does the tailored resume claim the person *leads* or *owns* a function that the base resume only shows them *contributing to* or *supporting*? (e.g., "led detection engineering" when the base shows "led detection testing and validation")
- Terminology swaps that change meaning: rephrasing a testing/validation role as an engineering or development role

BASE RESUME:
${baseResume}

TAILORED RESUME:
${tailoredResume}

If everything in the tailored resume is factually supported by the base resume, respond with exactly: {"valid": true}

If you find fabrications, respond with: {"valid": false, "issues": ["description of each issue"]}

Respond with ONLY the JSON. No other text.`;
}

function sanitizeFilename(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

async function tailorForJob(resume, job, rank) {
  const prompt = buildTailorPrompt(resume, job);

  let tailored;
  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    const promptForAttempt = retries === 0
      ? prompt
      : prompt + '\n\nPREVIOUS ATTEMPT HAD FABRICATIONS. Be even more strict. Only use exact facts from the base resume.';
    tailored = await callClaude(promptForAttempt, 4096);

    const valText = await callClaude(buildValidationPrompt(resume, tailored), 1024);

    let validation;
    try {
      const jsonStr = valText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      validation = JSON.parse(jsonStr);
    } catch {
      console.log('    Validation parse error, treating as valid');
      break;
    }

    if (validation.valid) {
      break;
    } else {
      console.log(`    Fabrication detected (attempt ${retries + 1}): ${validation.issues.join(', ')}`);
      retries++;
      if (retries > maxRetries) {
        console.log('    WARNING: Still flagged after retries. Saving with warning.');
        tailored = `<!-- WARNING: Factual validation flagged issues after ${maxRetries + 1} attempts. Review manually. -->\n\n${tailored}`;
      }
    }
  }

  const rankStr = String(rank).padStart(2, '0');
  const company = sanitizeFilename(job.company);
  const role = sanitizeFilename(job.title);
  const filename = `${rankStr}_${company}_${role}`;

  if (!fs.existsSync(TAILORED_DIR)) fs.mkdirSync(TAILORED_DIR, { recursive: true });
  fs.writeFileSync(path.join(TAILORED_DIR, `${filename}.md`), tailored);

  return filename;
}

async function runTailor() {
  console.log('Phase 4: Tailor resumes\n');

  const approved = loadJson('approved.json');
  if (approved.length === 0) {
    console.log('No approved jobs. Review matches first: node job-search.js review');
    return;
  }

  const resume = loadResume();

  approved.sort((a, b) => (b.score || 0) - (a.score || 0));

  for (let i = 0; i < approved.length; i++) {
    const job = approved[i];
    if (job.tailored) {
      console.log(`  [${i + 1}/${approved.length}] ${job.company} - already tailored, skipping`);
      continue;
    }
    console.log(`  [${i + 1}/${approved.length}] ${job.company} - ${job.title}...`);

    try {
      const filename = await tailorForJob(resume, job, i + 1);
      job.tailored = true;
      job.tailoredFile = filename;
      saveJson('approved.json', approved);
      console.log(`    Saved: ${filename}.md`);
    } catch (e) {
      console.log(`    ERROR: ${e.message}`);
    }
  }

  console.log(`\nTailoring complete. Run: node job-search.js export`);
}

module.exports = { runTailor, buildTailorPrompt, buildValidationPrompt };
