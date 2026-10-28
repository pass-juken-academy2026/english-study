'use strict';
const fs = require('node:fs');
function matchingBracket(source, open) {
  let depth = 0, quote = '', escaped = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"') { quote = ch; continue; }
    if (ch === '[' || ch === '{' || ch === '(') depth++;
    else if (ch === ']' || ch === '}' || ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('Unclosed array literal');
}
function extractArray(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error('Missing marker: ' + marker);
  const open = source.indexOf('[', at + marker.length);
  const close = matchingBracket(source, open);
  return JSON.parse(source.slice(open, close + 1));
}
function splitItems(source, open, close) {
  const out = [];
  let start = open + 1, depth = 0, quote = '', escaped = false;
  for (let i = open + 1; i < close; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"') { quote = ch; continue; }
    if (ch === '[' || ch === '{' || ch === '(') depth++;
    else if (ch === ']' || ch === '}' || ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      const item = source.slice(start, i).trim();
      if (item) out.push(item);
      start = i + 1;
    }
  }
  const last = source.slice(start, close).trim();
  if (last) out.push(last);
  return out;
}
const source = fs.readFileSync('index.html', 'utf8');
const errors = [];
const norm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const sectionAt = source.indexOf('const EN_COMMON_SECTIONS=');
const sectionOpen = source.indexOf('[', sectionAt);
const sectionClose = matchingBracket(source, sectionOpen);
const sectionSource = source.slice(sectionOpen, sectionClose + 1);
const qMatches = [...sectionSource.matchAll(/questions\s*:\s*\[/g)];
const expectedCounts = [5, 6, 8, 6, 8, 10, 8, 9];
const readingPrompts = new Set();
let readingTotal = 0;
if (qMatches.length !== 8) errors.push('Expected eight reading sections, found ' + qMatches.length);
for (let i = 0; i < qMatches.length; i++) {
  const open = sectionSource.indexOf('[', qMatches[i].index);
  const close = matchingBracket(sectionSource, open);
  const rows = splitItems(sectionSource, open, close).map(raw => {
    try { return JSON.parse(raw); } catch { return null; }
  });
  if (rows.length !== expectedCounts[i]) errors.push('Reading section ' + (i + 1) + ': expected ' + expectedCounts[i] + ' questions, found ' + rows.length);
  for (const [j, q] of rows.entries()) {
    const label = 'Reading section ' + (i + 1) + ' question ' + (j + 1);
    if (!Array.isArray(q) || q.length !== 4) { errors.push(label + ': invalid record shape'); continue; }
    if (typeof q[0] !== 'string' || !q[0].trim()) errors.push(label + ': missing prompt');
    if (!Array.isArray(q[1]) || q[1].length !== 4 || q[1].some(x => typeof x !== 'string' || !x.trim())) errors.push(label + ': expected four options');
    if (typeof q[2] !== 'string' || !q[1].includes(q[2])) errors.push(label + ': answer is not one of the options');
    if (typeof q[3] !== 'string' || !q[3].trim()) errors.push(label + ': missing explanation');
    const prompt = norm(q[0]);
    if (readingPrompts.has(prompt)) errors.push(label + ': duplicate prompt');
    readingPrompts.add(prompt);
    readingTotal++;
  }
}
if (readingTotal !== 60) errors.push('Expected 60 reading questions, found ' + readingTotal);
const listening = extractArray(source, 'const COMMON_LISTENING_TEST=');
if (listening.length !== 30) errors.push('Expected 30 listening questions, found ' + listening.length);
const groups = new Map(), seenTitles = new Set(), listeningPrompts = new Set();
let previousTitle = null;
for (const [i, q] of listening.entries()) {
  const label = 'Listening question ' + (i + 1);
  if (!q || typeof q !== 'object') { errors.push(label + ': invalid record'); continue; }
  if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(x => typeof x !== 'string' || !x.trim())) errors.push(label + ': expected four options');
  if (typeof q.answer !== 'string' || !q.options?.includes(q.answer)) errors.push(label + ': answer is not one of the options');
  if (!q.question || !q.explain || !q.audioText) errors.push(label + ': missing question/audio/explanation');
  if (q.title !== previousTitle) {
    if (seenTitles.has(q.title)) errors.push(label + ': listening stimulus group is split');
    seenTitles.add(q.title);
    previousTitle = q.title;
  }
  const group = groups.get(q.title) || { count: 0, audioText: q.audioText };
  group.count++;
  if (group.audioText !== q.audioText) errors.push(label + ': audio script differs within the same stimulus group');
  groups.set(q.title, group);
  const prompt = norm(q.question);
  if (listeningPrompts.has(prompt)) errors.push(label + ': duplicate prompt');
  listeningPrompts.add(prompt);
}
if (groups.size !== 6) errors.push('Expected six listening stimulus groups, found ' + groups.size);
for (const [title, group] of groups) if (group.count !== 5) errors.push(title + ': expected five questions, found ' + group.count);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('English common-test data OK: 60 reading questions across eight sections and 30 listening questions across six stimulus groups.');
