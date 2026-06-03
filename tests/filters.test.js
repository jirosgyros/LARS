'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  SEARCH_KEYWORDS,
  CLEARANCE_KEYWORDS,
  CONTRACT_KEYWORDS,
  EXCLUDE_KEYWORDS,
  EXCLUDE_TITLE_KEYWORDS,
  TITLE_REQUIRED_KEYWORDS,
  ALLOWED_HYBRID_CITIES,
  MIN_SALARY,
  hasClearanceKeyword,
  hasContractKeyword,
  hasExcludeKeyword,
  hasTitleExcludeKeyword,
  isTitleRelevant,
  isAllowedHybridCity,
  parseSalary,
  parseSalaryLow,
  meetsHardFilters,
} = require('../filters.js');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  test('SEARCH_KEYWORDS is a non-empty array of strings', () => {
    assert.ok(Array.isArray(SEARCH_KEYWORDS));
    assert.ok(SEARCH_KEYWORDS.length > 0);
    SEARCH_KEYWORDS.forEach(kw => assert.equal(typeof kw, 'string'));
  });

  test('CLEARANCE_KEYWORDS is a non-empty array of strings', () => {
    assert.ok(Array.isArray(CLEARANCE_KEYWORDS));
    assert.ok(CLEARANCE_KEYWORDS.length > 0);
    CLEARANCE_KEYWORDS.forEach(kw => assert.equal(typeof kw, 'string'));
  });

  test('CONTRACT_KEYWORDS is a non-empty array of strings', () => {
    assert.ok(Array.isArray(CONTRACT_KEYWORDS));
    assert.ok(CONTRACT_KEYWORDS.length > 0);
    CONTRACT_KEYWORDS.forEach(kw => assert.equal(typeof kw, 'string'));
  });

  test('EXCLUDE_KEYWORDS is an array', () => {
    assert.ok(Array.isArray(EXCLUDE_KEYWORDS));
  });

  test('EXCLUDE_TITLE_KEYWORDS is a non-empty array of strings', () => {
    assert.ok(Array.isArray(EXCLUDE_TITLE_KEYWORDS));
    assert.ok(EXCLUDE_TITLE_KEYWORDS.length > 0);
    EXCLUDE_TITLE_KEYWORDS.forEach(kw => assert.equal(typeof kw, 'string'));
  });

  test('TITLE_REQUIRED_KEYWORDS is a non-empty array of strings', () => {
    assert.ok(Array.isArray(TITLE_REQUIRED_KEYWORDS));
    assert.ok(TITLE_REQUIRED_KEYWORDS.length > 0);
    TITLE_REQUIRED_KEYWORDS.forEach(kw => assert.equal(typeof kw, 'string'));
  });

  test('ALLOWED_HYBRID_CITIES is a non-empty array of strings', () => {
    assert.ok(Array.isArray(ALLOWED_HYBRID_CITIES));
    assert.ok(ALLOWED_HYBRID_CITIES.length > 0);
    ALLOWED_HYBRID_CITIES.forEach(city => assert.equal(typeof city, 'string'));
  });

  test('MIN_SALARY is a positive number', () => {
    assert.equal(typeof MIN_SALARY, 'number');
    assert.ok(MIN_SALARY > 0);
  });
});

// ---------------------------------------------------------------------------
// hasClearanceKeyword
// ---------------------------------------------------------------------------

describe('hasClearanceKeyword', () => {
  test('returns false for clean text', () => {
    assert.equal(hasClearanceKeyword('Senior Security Engineer at Acme Corp'), false);
  });

  test('detects "clearance" in text', () => {
    assert.equal(hasClearanceKeyword('Must have clearance to apply'), true);
  });

  test('detects "ts/sci" (case-insensitive)', () => {
    assert.equal(hasClearanceKeyword('Requires TS/SCI eligibility'), true);
  });

  test('detects "top secret"', () => {
    assert.equal(hasClearanceKeyword('Candidate must hold Top Secret clearance'), true);
  });

  test('detects " sci " with surrounding spaces', () => {
    assert.equal(hasClearanceKeyword('SCI access required'), true);
  });

  test('detects "polygraph"', () => {
    assert.equal(hasClearanceKeyword('Polygraph may be required'), true);
  });

  test('detects "public trust"', () => {
    assert.equal(hasClearanceKeyword('Public Trust clearance needed'), true);
  });

  test('is case-insensitive', () => {
    assert.equal(hasClearanceKeyword('SECURITY CLEARANCE REQUIRED'), true);
  });

  test('returns false for empty string', () => {
    assert.equal(hasClearanceKeyword(''), false);
  });
});

// ---------------------------------------------------------------------------
// hasContractKeyword
// ---------------------------------------------------------------------------

describe('hasContractKeyword', () => {
  test('returns false for permanent role description', () => {
    assert.equal(hasContractKeyword('Full-time permanent position with benefits'), false);
  });

  test('detects "contract-to-hire"', () => {
    assert.equal(hasContractKeyword('This is a contract-to-hire opportunity'), true);
  });

  test('detects "contract to hire" without hyphen', () => {
    assert.equal(hasContractKeyword('contract to hire role available'), true);
  });

  test('detects "c2h"', () => {
    assert.equal(hasContractKeyword('Position type: C2H'), true);
  });

  test('is case-insensitive', () => {
    assert.equal(hasContractKeyword('CONTRACT-TO-HIRE role'), true);
  });

  test('returns false for empty string', () => {
    assert.equal(hasContractKeyword(''), false);
  });
});

// ---------------------------------------------------------------------------
// hasExcludeKeyword
// ---------------------------------------------------------------------------

describe('hasExcludeKeyword', () => {
  test('returns false for any text (EXCLUDE_KEYWORDS is empty)', () => {
    assert.equal(hasExcludeKeyword('anything goes here'), false);
  });

  test('returns false for empty string', () => {
    assert.equal(hasExcludeKeyword(''), false);
  });
});

// ---------------------------------------------------------------------------
// hasTitleExcludeKeyword
// ---------------------------------------------------------------------------

describe('hasTitleExcludeKeyword', () => {
  test('returns false for a clean security title', () => {
    assert.equal(hasTitleExcludeKeyword('Director of Information Security'), false);
  });

  test('detects "data governance"', () => {
    assert.equal(hasTitleExcludeKeyword('VP Data Governance'), true);
  });

  test('detects "compliance officer"', () => {
    assert.equal(hasTitleExcludeKeyword('Chief Compliance Officer'), true);
  });

  test('detects "compliance manager"', () => {
    assert.equal(hasTitleExcludeKeyword('Compliance Manager, Finance'), true);
  });

  test('detects "grc analyst"', () => {
    assert.equal(hasTitleExcludeKeyword('Senior GRC Analyst'), true);
  });

  test('detects "machine learning"', () => {
    assert.equal(hasTitleExcludeKeyword('Machine Learning Engineer'), true);
  });

  test('detects "ai engineer"', () => {
    assert.equal(hasTitleExcludeKeyword('AI Engineer'), true);
  });

  test('detects "ai safety"', () => {
    assert.equal(hasTitleExcludeKeyword('AI Safety Researcher'), true);
  });

  test('is case-insensitive', () => {
    assert.equal(hasTitleExcludeKeyword('PRIVACY OFFICER'), true);
  });

  test('returns false for undefined/null title', () => {
    assert.equal(hasTitleExcludeKeyword(undefined), false);
    assert.equal(hasTitleExcludeKeyword(null), false);
  });
});

// ---------------------------------------------------------------------------
// isTitleRelevant
// ---------------------------------------------------------------------------

describe('isTitleRelevant', () => {
  test('returns true for title containing "security"', () => {
    assert.equal(isTitleRelevant('Director of Information Security'), true);
  });

  test('returns true for title containing "cyber"', () => {
    assert.equal(isTitleRelevant('VP Cybersecurity'), true);
  });

  test('returns true for title containing "ciso"', () => {
    assert.equal(isTitleRelevant('CISO'), true);
  });

  test('returns true for title containing "infosec"', () => {
    assert.equal(isTitleRelevant('InfoSec Lead'), true);
  });

  test('returns true for title containing "threat"', () => {
    assert.equal(isTitleRelevant('Director Threat Management'), true);
  });

  test('returns true for title containing "detection"', () => {
    assert.equal(isTitleRelevant('Detection Engineering Manager'), true);
  });

  test('returns true for title containing "purple team"', () => {
    assert.equal(isTitleRelevant('Purple Team Manager'), true);
  });

  test('returns true for title containing "soc " (with space)', () => {
    assert.equal(isTitleRelevant('SOC Manager'), true);
  });

  test('returns true for title containing "incident response"', () => {
    assert.equal(isTitleRelevant('Head of Incident Response'), true);
  });

  test('returns false for unrelated title', () => {
    assert.equal(isTitleRelevant('Software Engineer, Payments'), false);
  });

  test('returns false for empty title', () => {
    assert.equal(isTitleRelevant(''), false);
  });

  test('returns false for null/undefined', () => {
    assert.equal(isTitleRelevant(null), false);
    assert.equal(isTitleRelevant(undefined), false);
  });

  test('is case-insensitive', () => {
    assert.equal(isTitleRelevant('SECURITY ARCHITECT'), true);
  });
});

// ---------------------------------------------------------------------------
// isAllowedHybridCity
// ---------------------------------------------------------------------------

describe('isAllowedHybridCity', () => {
  test('returns true for Austin', () => {
    assert.equal(isAllowedHybridCity('Austin, TX (Hybrid)'), true);
  });

  test('returns true for Denver', () => {
    assert.equal(isAllowedHybridCity('Denver, CO'), true);
  });

  test('returns true for Chicago', () => {
    assert.equal(isAllowedHybridCity('Chicago, IL'), true);
  });

  test('returns true for Seattle', () => {
    assert.equal(isAllowedHybridCity('Seattle, WA'), true);
  });

  test('is case-insensitive', () => {
    assert.equal(isAllowedHybridCity('AUSTIN, TX'), true);
  });

  test('returns false for a city not in the allowed list', () => {
    assert.equal(isAllowedHybridCity('Miami, FL (Hybrid)'), false);
  });

  test('returns false for empty string', () => {
    assert.equal(isAllowedHybridCity(''), false);
  });

  test('returns false for null/undefined', () => {
    assert.equal(isAllowedHybridCity(null), false);
    assert.equal(isAllowedHybridCity(undefined), false);
  });
});

// ---------------------------------------------------------------------------
// parseSalary
// ---------------------------------------------------------------------------

describe('parseSalary', () => {
  test('parses "$220k"', () => {
    assert.equal(parseSalary('$220k'), 220000);
  });

  test('parses "$200,000"', () => {
    assert.equal(parseSalary('$200,000'), 200000);
  });

  test('parses plain "220" as 220000 (under-1000 multiplied)', () => {
    assert.equal(parseSalary('220'), 220000);
  });

  test('parses "220000" as-is', () => {
    assert.equal(parseSalary('220000'), 220000);
  });

  test('parses range "$200k-$250k" as average 225000', () => {
    assert.equal(parseSalary('$200k-$250k'), 225000);
  });

  test('parses range "$200,000-$240,000" as average 220000', () => {
    assert.equal(parseSalary('$200,000-$240,000'), 220000);
  });

  test('parses range with en-dash "$210k–$230k"', () => {
    assert.equal(parseSalary('$210k–$230k'), 220000);
  });

  test('returns null for null input', () => {
    assert.equal(parseSalary(null), null);
  });

  test('returns null for empty string', () => {
    assert.equal(parseSalary(''), null);
  });

  test('returns null for non-numeric string', () => {
    assert.equal(parseSalary('negotiable'), null);
  });

  test('returns null for "$0"', () => {
    assert.equal(parseSalary('$0'), null);
  });

  test('parses prose salary "base salary of $180,000 - $190,000"', () => {
    assert.equal(parseSalary('You should reasonably expect a base salary of $180,000 - $190,000. In addition, we offer an annual discretionary performance bonus.'), 185000);
  });
});

// ---------------------------------------------------------------------------
// parseSalaryLow
// ---------------------------------------------------------------------------

describe('parseSalaryLow', () => {
  test('parses "$220k" as 220000', () => {
    assert.equal(parseSalaryLow('$220k'), 220000);
  });

  test('parses "$200,000" as 200000', () => {
    assert.equal(parseSalaryLow('$200,000'), 200000);
  });

  test('parses plain "220" as 220000', () => {
    assert.equal(parseSalaryLow('220'), 220000);
  });

  test('returns the low end of a range "$200k-$250k"', () => {
    assert.equal(parseSalaryLow('$200k-$250k'), 200000);
  });

  test('returns the low end of a range "$180,000-$220,000"', () => {
    assert.equal(parseSalaryLow('$180,000-$220,000'), 180000);
  });

  test('returns the low end with en-dash "$210k–$230k"', () => {
    assert.equal(parseSalaryLow('$210k–$230k'), 210000);
  });

  test('returns null for null input', () => {
    assert.equal(parseSalaryLow(null), null);
  });

  test('returns null for empty string', () => {
    assert.equal(parseSalaryLow(''), null);
  });

  test('returns null for non-numeric string', () => {
    assert.equal(parseSalaryLow('open'), null);
  });
});

// ---------------------------------------------------------------------------
// meetsHardFilters
// ---------------------------------------------------------------------------

describe('meetsHardFilters', () => {
  // Helper: a base job that passes all filters
  function passingJob(overrides = {}) {
    return Object.assign(
      {
        title: 'Director of Information Security',
        description: 'Lead our security team. Full-time permanent role.',
        salary: '$160k-$190k',
        location: 'Remote',
      },
      overrides
    );
  }

  test('passes for a clean remote job with sufficient salary', () => {
    const result = meetsHardFilters(passingJob());
    assert.equal(result.pass, true);
    assert.deepEqual(result.flags, []);
  });

  test('fails when title is irrelevant', () => {
    const result = meetsHardFilters(passingJob({ title: 'Software Engineer, Payments' }));
    assert.equal(result.pass, false);
    assert.ok(result.reason.includes('irrelevant title'));
  });

  test('fails when title matches exclude list', () => {
    const result = meetsHardFilters(passingJob({ title: 'Security Compliance Manager' }));
    assert.equal(result.pass, false);
    assert.ok(result.reason.includes('excluded role type'));
  });

  test('fails when description contains clearance keyword', () => {
    const result = meetsHardFilters(passingJob({ description: 'Must have TS/SCI clearance' }));
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'clearance required');
  });

  test('fails when description contains contract-to-hire keyword', () => {
    const result = meetsHardFilters(passingJob({ description: 'This is a contract-to-hire position' }));
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'contract-to-hire');
  });

  test('fails when salary is below MIN_SALARY', () => {
    const result = meetsHardFilters(passingJob({ salary: '$100k-$130k' }));
    assert.equal(result.pass, false);
    assert.ok(result.reason.includes('salary too low'));
  });

  test('fails when salary equals exactly below MIN_SALARY boundary', () => {
    const result = meetsHardFilters(passingJob({ salary: '$149,999' }));
    assert.equal(result.pass, false);
    assert.ok(result.reason.includes('salary too low'));
  });

  test('passes when salary equals exactly MIN_SALARY', () => {
    const result = meetsHardFilters(passingJob({ salary: '$150,000' }));
    assert.equal(result.pass, true);
  });

  test('fails when location is not remote or hybrid', () => {
    const result = meetsHardFilters(passingJob({ location: 'Chicago, IL (On-site)' }));
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'not remote or hybrid');
  });

  test('fails when location is hybrid but city not in allowed list', () => {
    const result = meetsHardFilters(passingJob({ location: 'New York, NY (Hybrid)' }));
    assert.equal(result.pass, false);
    assert.ok(result.reason.includes('hybrid not in allowed city'));
  });

  test('passes when location is hybrid in an allowed city (Austin)', () => {
    const result = meetsHardFilters(passingJob({ location: 'Austin, TX (Hybrid)' }));
    assert.equal(result.pass, true);
    assert.ok(result.flags.includes('negotiable_hybrid'));
  });

  test('passes when location is hybrid in an allowed city (Denver)', () => {
    const result = meetsHardFilters(passingJob({ location: 'Denver, CO (Hybrid)' }));
    assert.equal(result.pass, true);
    assert.ok(result.flags.includes('negotiable_hybrid'));
  });

  test('passes when location is hybrid in Chicago', () => {
    const result = meetsHardFilters(passingJob({ location: 'Chicago, IL (Hybrid)' }));
    assert.equal(result.pass, true);
    assert.ok(result.flags.includes('negotiable_hybrid'));
  });

  test('passes when location is hybrid in Seattle', () => {
    const result = meetsHardFilters(passingJob({ location: 'Seattle, WA (Hybrid)' }));
    assert.equal(result.pass, true);
    assert.ok(result.flags.includes('negotiable_hybrid'));
  });

  test('sets no_salary_listed flag when salary is absent', () => {
    const result = meetsHardFilters(passingJob({ salary: null }));
    assert.equal(result.pass, true);
    assert.ok(result.flags.includes('no_salary_listed'));
  });

  test('sets both flags for hybrid allowed city with no salary', () => {
    const result = meetsHardFilters(passingJob({ location: 'Austin, TX (Hybrid)', salary: null }));
    assert.equal(result.pass, true);
    assert.ok(result.flags.includes('negotiable_hybrid'));
    assert.ok(result.flags.includes('no_salary_listed'));
  });

  test('clearance keyword in title text triggers clearance rejection', () => {
    const result = meetsHardFilters(
      passingJob({ description: 'Full-time role', title: 'Security Engineer with clearance' })
    );
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'clearance required');
  });

  test('handles missing description gracefully', () => {
    const job = passingJob({ description: undefined });
    const result = meetsHardFilters(job);
    assert.equal(result.pass, true);
  });

  test('handles missing location gracefully — fails as not remote/hybrid', () => {
    const result = meetsHardFilters(passingJob({ location: undefined }));
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'not remote or hybrid');
  });
});
