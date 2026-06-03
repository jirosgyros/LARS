// ============================================================
// CONFIG -- EDIT THESE FOR YOUR SEARCH
// ============================================================
// Defaults below are example values for a senior cybersecurity role
// search. Change them to match your job target, salary floor, and
// geographic preferences.

// LinkedIn search queries. The scraper rotates through these.
// Add/remove based on the titles you want LinkedIn to surface.
const SEARCH_KEYWORDS = [
  '"VP Cybersecurity"',
  '"Director Cybersecurity"',
  '"Director Information Security"',
  '"Head of Security Operations"',
  '"Security Engineering Manager"',
  '"Staff Security Engineer"',
  '"Detection Engineering Manager"',
];

// Anything in a JD that signals federal clearance is required.
// Edit only if you're cleared and want those roles included.
const CLEARANCE_KEYWORDS = [
  'clearance', 'ts/sci', 'top secret', ' sci ', 'polygraph',
  'secret clearance', 'public trust', 'security clearance required',
  'must hold active clearance',
];

// Contract-to-hire signals to filter out. Edit if you're open to C2H.
const CONTRACT_KEYWORDS = [
  'contract-to-hire', 'contract to hire', 'c2h',
];

// Description-level exclusions. Empty by default.
const EXCLUDE_KEYWORDS = [];

// Title-level exclusions. The defaults skip GRC/compliance-only and
// pure ML/AI engineer roles. Edit to match your filter preferences.
const EXCLUDE_TITLE_KEYWORDS = [
  'data governance', 'compliance officer', 'compliance manager',
  'director of compliance', 'grc analyst', 'privacy officer',
  'regulatory compliance', 'chief compliance',
  'ai/ml', 'ml/ai', 'machine learning', 'ai safety', 'data scientist',
  'machine learning engineer', 'ai engineer',
];

// Title must contain at least one of these to be relevant.
// Edit for your domain (e.g. swap 'security' for 'data' or 'platform').
const TITLE_REQUIRED_KEYWORDS = [
  'security', 'cyber', 'ciso', 'infosec', 'threat',
  'detection', 'purple team', 'soc ',
  'incident response',
];

// Cities where you're willing to accept a hybrid role (case-insensitive
// substring match against the LinkedIn location string). Add yours.
const ALLOWED_HYBRID_CITIES = ['austin', 'denver', 'chicago', 'seattle'];

// Hard salary floor in USD. Roles posting below this are dropped.
// Roles with no salary listed are kept and flagged 'no_salary_listed'.
const MIN_SALARY = 150000;

// ============================================================
// END CONFIG
// ============================================================

function hasClearanceKeyword(text) {
  const lower = (' ' + text + ' ').toLowerCase();
  return CLEARANCE_KEYWORDS.some(kw => lower.includes(kw));
}

function hasContractKeyword(text) {
  const lower = text.toLowerCase();
  return CONTRACT_KEYWORDS.some(kw => lower.includes(kw));
}

function hasExcludeKeyword(text) {
  const lower = text.toLowerCase();
  return EXCLUDE_KEYWORDS.some(kw => lower.includes(kw));
}

function isAllowedHybridCity(location) {
  const lower = (location || '').toLowerCase();
  return ALLOWED_HYBRID_CITIES.some(city => lower.includes(city));
}

function parseSalaryValue(str) {
  if (!str) return null;
  const cleaned = str.replace(/[\$,]/g, '').trim();
  const kMatch = cleaned.match(/([\d.]+)\s*[kK]/);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;
  const num = parseFloat(cleaned);
  if (isNaN(num) || num === 0) return null;
  // Values under 1000 are likely in thousands (e.g. "220" = $220k)
  return num < 1000 ? num * 1000 : num;
}

function parseSalary(text) {
  if (!text) return null;
  const rangeMatch = text.match(/([\d\$,\.kK]+)\s*[-–]\s*([\d\$,\.kK]+)/);
  if (rangeMatch) {
    const low = parseSalaryValue(rangeMatch[1]);
    const high = parseSalaryValue(rangeMatch[2]);
    if (low !== null && high !== null) return Math.round((low + high) / 2);
  }
  return parseSalaryValue(text);
}

function parseSalaryLow(text) {
  if (!text) return null;
  const rangeMatch = text.match(/([\d\$,\.kK]+)\s*[-–]\s*([\d\$,\.kK]+)/);
  if (rangeMatch) return parseSalaryValue(rangeMatch[1]);
  return parseSalaryValue(text);
}

function isTitleRelevant(title) {
  const lower = (' ' + (title || '') + ' ').toLowerCase();
  return TITLE_REQUIRED_KEYWORDS.some(kw => lower.includes(kw));
}

function hasTitleExcludeKeyword(title) {
  const lower = (title || '').toLowerCase();
  return EXCLUDE_TITLE_KEYWORDS.some(kw => lower.includes(kw));
}

function meetsHardFilters(job) {
  if (!isTitleRelevant(job.title)) return { pass: false, reason: `irrelevant title: ${job.title}` };
  if (hasTitleExcludeKeyword(job.title)) return { pass: false, reason: `excluded role type (title): ${job.title}` };
  const desc = (job.description || '') + ' ' + (job.title || '');
  if (hasClearanceKeyword(desc)) return { pass: false, reason: 'clearance required' };
  if (hasContractKeyword(desc)) return { pass: false, reason: 'contract-to-hire' };
  if (hasExcludeKeyword(desc)) return { pass: false, reason: 'excluded role type' };
  const salaryLow = parseSalaryLow(job.salary);
  if (salaryLow !== null && salaryLow < MIN_SALARY) return { pass: false, reason: `salary too low: ${salaryLow}` };
  const noSalary = salaryLow === null;
  const isRemote = (job.location || '').toLowerCase().includes('remote');
  const isHybrid = (job.location || '').toLowerCase().includes('hybrid');
  if (!isRemote && !isHybrid) return { pass: false, reason: 'not remote or hybrid' };
  if (isHybrid && !isAllowedHybridCity(job.location)) return { pass: false, reason: `hybrid not in allowed city: ${job.location}` };
  const hybridFlag = isHybrid ? 'negotiable_hybrid' : null;
  const salaryFlag = noSalary ? 'no_salary_listed' : null;
  return { pass: true, flags: [hybridFlag, salaryFlag].filter(Boolean) };
}

module.exports = {
  SEARCH_KEYWORDS, CLEARANCE_KEYWORDS, CONTRACT_KEYWORDS, EXCLUDE_KEYWORDS, EXCLUDE_TITLE_KEYWORDS, TITLE_REQUIRED_KEYWORDS, ALLOWED_HYBRID_CITIES, MIN_SALARY,
  hasClearanceKeyword, hasContractKeyword, hasExcludeKeyword, hasTitleExcludeKeyword, isTitleRelevant, isAllowedHybridCity,
  parseSalary, parseSalaryLow, meetsHardFilters,
};
