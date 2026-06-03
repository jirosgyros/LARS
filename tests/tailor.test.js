// runTailor is not tested here — it requires a live Anthropic API client and file I/O.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { buildTailorPrompt, buildValidationPrompt } = require('../tailor.js');

// ---------------------------------------------------------------------------
// buildTailorPrompt
// ---------------------------------------------------------------------------

describe('buildTailorPrompt', () => {
  const baseResume = 'John Doe\nSoftware Engineer\n- Built REST APIs in Node.js';
  const job = {
    title: 'Senior Backend Engineer',
    company: 'Acme Corp',
    description: 'Looking for someone with Node.js and API experience.',
  };

  test('returns a string', () => {
    const result = buildTailorPrompt(baseResume, job);
    assert.equal(typeof result, 'string');
  });

  test('includes the base resume content', () => {
    const result = buildTailorPrompt(baseResume, job);
    assert.ok(result.includes(baseResume), 'prompt should contain the base resume');
  });

  test('includes job title', () => {
    const result = buildTailorPrompt(baseResume, job);
    assert.ok(result.includes(job.title), 'prompt should contain job.title');
  });

  test('includes job company', () => {
    const result = buildTailorPrompt(baseResume, job);
    assert.ok(result.includes(job.company), 'prompt should contain job.company');
  });

  test('includes job description', () => {
    const result = buildTailorPrompt(baseResume, job);
    assert.ok(result.includes(job.description), 'prompt should contain job.description');
  });

  test('contains core rule instructions', () => {
    const result = buildTailorPrompt(baseResume, job);
    assert.ok(result.includes('RULES:'), 'prompt should contain RULES section');
    assert.ok(result.includes('BASE RESUME:'), 'prompt should contain BASE RESUME label');
    assert.ok(result.includes('JOB POSTING:'), 'prompt should contain JOB POSTING label');
  });

  test('instructs output of markdown only, no commentary', () => {
    const result = buildTailorPrompt(baseResume, job);
    assert.ok(
      result.includes('No commentary') || result.includes('no commentary'),
      'prompt should instruct no commentary'
    );
  });

  // Edge cases

  test('handles empty resume string', () => {
    const result = buildTailorPrompt('', job);
    assert.equal(typeof result, 'string');
    assert.ok(result.includes(job.title));
    assert.ok(result.includes(job.company));
    assert.ok(result.includes(job.description));
  });

  test('handles empty job title', () => {
    const result = buildTailorPrompt(baseResume, { ...job, title: '' });
    assert.equal(typeof result, 'string');
    assert.ok(result.includes(baseResume));
  });

  test('handles empty job company', () => {
    const result = buildTailorPrompt(baseResume, { ...job, company: '' });
    assert.equal(typeof result, 'string');
    assert.ok(result.includes(baseResume));
  });

  test('handles empty job description', () => {
    const result = buildTailorPrompt(baseResume, { ...job, description: '' });
    assert.equal(typeof result, 'string');
    assert.ok(result.includes(baseResume));
  });

  test('handles all empty strings', () => {
    const result = buildTailorPrompt('', { title: '', company: '', description: '' });
    assert.equal(typeof result, 'string');
    // Should still produce a non-empty prompt (rules/structure remain)
    assert.ok(result.length > 0);
  });

  test('handles job fields with special characters', () => {
    const specialJob = {
      title: 'C++ / Rust Engineer (Staff)',
      company: 'Foo & Bar, LLC',
      description: 'Must know <templates> and "generics".',
    };
    const result = buildTailorPrompt(baseResume, specialJob);
    assert.ok(result.includes(specialJob.title));
    assert.ok(result.includes(specialJob.company));
    assert.ok(result.includes(specialJob.description));
  });

  test('handles multiline resume and description', () => {
    const multiResume = 'Alice\n\nExperience:\n- Did A\n- Did B\n\nSkills:\n- X, Y, Z';
    const multiJob = {
      title: 'Engineer',
      company: 'Corp',
      description: 'Line one.\nLine two.\nLine three.',
    };
    const result = buildTailorPrompt(multiResume, multiJob);
    assert.ok(result.includes(multiResume));
    assert.ok(result.includes(multiJob.description));
  });
});

// ---------------------------------------------------------------------------
// buildValidationPrompt
// ---------------------------------------------------------------------------

describe('buildValidationPrompt', () => {
  const baseResume = 'Jane Smith\n- Led detection testing and validation for SIEM platform';
  const tailoredResume = 'Jane Smith\n- Led detection engineering for SIEM platform';

  test('returns a string', () => {
    const result = buildValidationPrompt(baseResume, tailoredResume);
    assert.equal(typeof result, 'string');
  });

  test('includes the base resume content', () => {
    const result = buildValidationPrompt(baseResume, tailoredResume);
    assert.ok(result.includes(baseResume), 'prompt should contain the base resume');
  });

  test('includes the tailored resume content', () => {
    const result = buildValidationPrompt(baseResume, tailoredResume);
    assert.ok(result.includes(tailoredResume), 'prompt should contain the tailored resume');
  });

  test('contains BASE RESUME and TAILORED RESUME labels', () => {
    const result = buildValidationPrompt(baseResume, tailoredResume);
    assert.ok(result.includes('BASE RESUME:'), 'prompt should label the base resume');
    assert.ok(result.includes('TAILORED RESUME:'), 'prompt should label the tailored resume');
  });

  test('instructs JSON-only response', () => {
    const result = buildValidationPrompt(baseResume, tailoredResume);
    assert.ok(result.includes('{"valid": true}'), 'prompt should show valid JSON example');
    assert.ok(result.includes('{"valid": false'), 'prompt should show invalid JSON example');
    assert.ok(
      result.includes('ONLY the JSON') || result.includes('only the JSON') || result.includes('ONLY the JSON'),
      'prompt should instruct JSON-only output'
    );
  });

  test('mentions fabrication and hallucination checks', () => {
    const result = buildValidationPrompt(baseResume, tailoredResume);
    assert.ok(
      result.toLowerCase().includes('fabricat'),
      'prompt should mention fabrication checks'
    );
  });

  test('mentions role scope inflation check', () => {
    const result = buildValidationPrompt(baseResume, tailoredResume);
    assert.ok(
      result.toLowerCase().includes('scope inflation') || result.toLowerCase().includes('role scope'),
      'prompt should mention role scope inflation'
    );
  });

  test('mentions terminology swap check', () => {
    const result = buildValidationPrompt(baseResume, tailoredResume);
    assert.ok(
      result.toLowerCase().includes('terminology'),
      'prompt should mention terminology swaps'
    );
  });

  // Edge cases

  test('handles empty base resume', () => {
    const result = buildValidationPrompt('', tailoredResume);
    assert.equal(typeof result, 'string');
    assert.ok(result.includes(tailoredResume));
  });

  test('handles empty tailored resume', () => {
    const result = buildValidationPrompt(baseResume, '');
    assert.equal(typeof result, 'string');
    assert.ok(result.includes(baseResume));
  });

  test('handles both resumes empty', () => {
    const result = buildValidationPrompt('', '');
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  test('handles identical base and tailored resumes', () => {
    const same = 'John Doe\n- Built APIs';
    const result = buildValidationPrompt(same, same);
    assert.equal(typeof result, 'string');
    // Both occurrences of the content should appear in the prompt
    const firstIndex = result.indexOf(same);
    const secondIndex = result.indexOf(same, firstIndex + 1);
    assert.ok(firstIndex !== -1, 'first resume occurrence should be present');
    assert.ok(secondIndex !== -1, 'second resume occurrence should be present');
  });

  test('handles resumes with special characters', () => {
    const specialBase = 'Alice <alice@example.com>\n- C++ & Rust engineer\n- "Led" platform work';
    const specialTailored = 'Alice <alice@example.com>\n- C++ & Rust engineer\n- Led platform engineering';
    const result = buildValidationPrompt(specialBase, specialTailored);
    assert.ok(result.includes(specialBase));
    assert.ok(result.includes(specialTailored));
  });

  test('handles multiline resumes', () => {
    const multiBase = 'Bob\n\nExperience:\n- Did A\n- Did B\n\nSkills: Python, SQL';
    const multiTailored = 'Bob\n\nExperience:\n- Led A\n- Architected B\n\nSkills: Python, SQL';
    const result = buildValidationPrompt(multiBase, multiTailored);
    assert.ok(result.includes(multiBase));
    assert.ok(result.includes(multiTailored));
  });
});
