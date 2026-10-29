'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('index.html', 'utf8');
const start = source.indexOf('const EN_COMMON_SECTIONS=[');
const end = source.indexOf('const COMMON_TEST_EN=', start);
assert.ok(start >= 0 && end > start, 'live English Common Test bank must exist');
const block = source.slice(start, end);
const sections = vm.runInNewContext(block + '\nEN_COMMON_SECTIONS;', Object.create(null));
assert.equal(sections.length, 8, 'expected eight original reading sections');
for (const [index, section] of sections.entries()) {
  const words = String(section.passage || '').trim().split(/\s+/u).filter(Boolean).length;
  assert.ok(words >= 220, 'section ' + (index + 1) + ' is too short: ' + words + ' words');
  assert.ok(Array.isArray(section.questions) && section.questions.length >= section.target,
    'section ' + (index + 1) + ' does not have enough question items');
  for (const [qi, q] of section.questions.entries()) {
    assert.ok(String(q[0] || '').trim(), 'missing prompt in section ' + (index + 1) + ', question ' + (qi + 1));
    assert.ok(Array.isArray(q[1]) && q[1].length === 4, 'four options required in section ' + (index + 1));
    assert.equal(new Set(q[1]).size, 4, 'duplicate options in section ' + (index + 1));
    assert.ok(q[1].includes(q[2]), 'answer must match an option in section ' + (index + 1) + ', question ' + (qi + 1));
    assert.ok(String(q[3] || '').trim(), 'missing explanation in section ' + (index + 1));
  }
}
const tableStimuli = sections.filter(section =>
  section.passage.split(/\r?\n/u).filter(line => line.includes('|')).length >= 3);
assert.ok(tableStimuli.length >= 2, 'expected at least two multi-row data tables');
assert.ok(source.includes('function renderStimulus(text)'), 'structured stimulus renderer must exist');
console.log('PASS live English Common Test stimulus audit: ' + sections.length + ' sections, word lengths, four-choice answers, explanations, and tables');
