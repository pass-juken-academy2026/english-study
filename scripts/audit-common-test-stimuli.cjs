#!/usr/bin/env node
'use strict';

// Fail-closed structural quality gate for original Common Test-style English items.
// Input is a JSON array (or {questions:[...]}) using the normalized schema below:
// {id, section, stimulus, stimulusType, wordCountMin?, questions:[{id,prompt,choices,answerIndex,explanation,requiresStimulus?}], tables?, charts?}
// This tool flags candidates for review; it does not certify exam fidelity or legal compliance.
const fs = require('node:fs');

function words(value) {
  return String(value || '').trim().split(/\s+/u).filter(Boolean).length;
}
function auditItem(item, defaults = {}) {
  const errors = [];
  const warnings = [];
  const id = item && item.id ? String(item.id) : '(missing id)';
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { id, errors: ['item must be an object'], warnings };
  }
  const stimulus = String(item.stimulus || '').trim();
  const count = words(stimulus);
  const min = Number.isInteger(item.wordCountMin) ? item.wordCountMin :
    (Number.isInteger(defaults.wordCountMin) ? defaults.wordCountMin : 180);
  if (!item.id) errors.push('missing stable id');
  if (!item.section) errors.push('missing section');
  if (!stimulus) errors.push('missing stimulus');
  else if (count < min) errors.push(`stimulus too short: ${count} words; section threshold is ${min}`);
  if (!Array.isArray(item.questions) || item.questions.length === 0) {
    errors.push('questions must be a non-empty array');
  } else {
    item.questions.forEach((q, i) => {
      const label = q && q.id ? String(q.id) : `question[${i}]`;
      if (!q || typeof q !== 'object') { errors.push(`${label}: must be an object`); return; }
      if (!String(q.prompt || '').trim()) errors.push(`${label}: missing prompt`);
      if (!Array.isArray(q.choices) || q.choices.length !== 4) errors.push(`${label}: must have exactly four choices`);
      if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) errors.push(`${label}: answerIndex must be 0..3`);
      if (!String(q.explanation || '').trim()) errors.push(`${label}: missing explanation`);
      if (q.requiresStimulus === true && !stimulus) errors.push(`${label}: requires stimulus but stimulus is empty`);
      if (q.requiresChart === true && !(Array.isArray(item.charts) && item.charts.length)) errors.push(`${label}: requires chart but no chart is attached`);
      if (q.requiresTable === true && !(Array.isArray(item.tables) && item.tables.length)) errors.push(`${label}: requires table but no table is attached`);
      const normalized = (q.choices || []).map(v => String(v).trim().toLocaleLowerCase()).filter(Boolean);
      if (new Set(normalized).size !== normalized.length) errors.push(`${label}: duplicate/blank choices`);
    });
  }
  if (item.stimulusType === 'chart' && !(Array.isArray(item.charts) && item.charts.length)) errors.push('stimulusType=chart but charts are missing');
  if (item.stimulusType === 'table' && !(Array.isArray(item.tables) && item.tables.length)) errors.push('stimulusType=table but tables are missing');
  if (item.stimulusType === 'multi-document' && (!Array.isArray(item.documents) || item.documents.length < 2)) errors.push('multi-document stimulus requires at least two documents');
  if (count < Math.max(min, 250)) warnings.push('review whether information density, document linkage, and inference demand are sufficient');
  return { id, wordCount: count, threshold: min, errors, warnings };
}
function audit(data, config = {}) {
  const items = Array.isArray(data) ? data : data && data.questions;
  if (!Array.isArray(items)) return { passed: false, total: 0, results: [], errors: ['input must be an array or {questions:[...]}'] };
  const results = items.map(item => auditItem(item, config));
  const errors = results.flatMap(r => r.errors.map(e => `${r.id}: ${e}`));
  return { passed: errors.length === 0, total: items.length, results, errors };
}
if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/audit-common-test-stimuli.cjs <question-bank.json> [config.json]');
    process.exit(2);
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const config = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : {};
    const result = audit(data, config);
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exit(1);
  } catch (error) {
    console.error(`Audit failed closed: ${error.message}`);
    process.exit(1);
  }
}
module.exports = { audit, auditItem, words };
