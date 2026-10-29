#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { audit, auditItem, words } = require('../scripts/audit-common-test-stimuli.cjs');

const base = {
  id: 'eng-ct-001',
  section: 'reading',
  stimulus: 'A short original passage used only for structural testing.',
  wordCountMin: 5,
  stimulusType: 'text',
  questions: [{
    id: 'q1',
    prompt: 'Which statement is supported by the passage?',
    choices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
    answerIndex: 0,
    explanation: 'The passage directly supports choice A.',
    requiresStimulus: true
  }]
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }

assert.equal(words(' one  two\nthree '), 3);
assert.equal(audit([clone(base)]).passed, true, 'valid normalized item should pass');

const missingId = clone(base);
delete missingId.id;
assert.equal(audit([missingId]).passed, false, 'missing stable id should fail');

const tooShort = clone(base);
tooShort.wordCountMin = 100;
assert.equal(audit([tooShort]).passed, false, 'short stimulus should fail configured threshold');

const duplicateChoices = clone(base);
duplicateChoices.questions[0].choices = ['Same', 'Same', 'C', 'D'];
assert.equal(audit([duplicateChoices]).passed, false, 'duplicate choices should fail');

const missingChart = clone(base);
missingChart.questions[0].requiresChart = true;
assert.equal(audit([missingChart]).passed, false, 'required chart without chart data should fail');

const missingDocuments = clone(base);
missingDocuments.stimulusType = 'multi-document';
missingDocuments.documents = [{ title: 'Only one document' }];
assert.equal(audit([missingDocuments]).passed, false, 'multi-document items need at least two documents');

assert.equal(audit({ notQuestions: [] }).passed, false, 'unknown schema should fail closed');
assert.equal(auditItem(null).errors.length > 0, true, 'null item should fail');

console.log('PASS English Common Test stimulus audit regression tests (9 assertions)');
