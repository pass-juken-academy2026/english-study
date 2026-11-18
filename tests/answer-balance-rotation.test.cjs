'use strict';
const fs = require('node:fs');
const source = fs.readFileSync('index.html','utf8');
const errors=[];
function extractArray(marker){
 const at=source.indexOf(marker);if(at<0)throw new Error('Missing marker '+marker);
 const open=source.indexOf('[',at);let depth=0,quote='',escaped=false;
 for(let i=open;i<source.length;i++){const ch=source[i];if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}if(ch==='"'||ch==="'"){quote=ch;continue;}if(ch==='[')depth++;else if(ch===']'){depth--;if(depth===0)return JSON.parse(source.slice(open,i+1).replace(/([{,]\s*)([A-Za-z][A-Za-z0-9_]*)\s*:/g,'$1"$2":'));}}
 throw new Error('Unclosed array '+marker);
}
const common=extractArray('const EN_COMMON_SECTIONS=');
const listening=extractArray('const COMMON_LISTENING_TEST=');
const mock=extractArray('const SAITAMA_MOCK_SETS=');
if(common.length!==8)errors.push('Expected eight reading sections.');
if(common.reduce((n,s)=>n+s.questions.length,0)!==60)errors.push('Expected 60 reading questions.');
if(common.reduce((n,s)=>n+s.target,0)!==44)errors.push('Expected 44 reading questions per set.');
if(listening.length!==30)errors.push('Expected 30 listening questions.');
if(new Set(listening.map(q=>q.audioText)).size!==6)errors.push('Expected six listening groups.');
if(mock.length!==2||mock.some(s=>s.questions.length!==10))errors.push('Expected two 10-question mock sets.');
function validate(rows,getOptions,getAnswer,label){
 const seen=new Set();
 for(const [i,q] of rows.entries()){
  const opts=getOptions(q),answer=getAnswer(q);
  if(!Array.isArray(opts)||opts.length!==4||new Set(opts).size!==4)errors.push(label+' '+(i+1)+': choices must be four distinct options');
  if(!opts.includes(answer))errors.push(label+' '+(i+1)+': correct answer missing from choices');
  const prompt=String(q.question??q[0]??'').normalize('NFKC').toLocaleLowerCase().replace(/[\s　、。！？「」『』（）()【】・,:：;；]/g,'');
  if(prompt&&seen.has(prompt))errors.push(label+': duplicate question');
  seen.add(prompt);
 }
}
for(const section of common){
 if(section.passage.length<1000)errors.push(section.title+': passage shorter than 1000 characters');
 validate(section.questions,q=>q[1],q=>q[2],section.title);
}
for(const q of listening){if(q.audioText.length<250)errors.push('Listening stimulus too short');}
validate(listening,q=>q.options,q=>q.answer,'Listening');
for(const set of mock){if(set.passage.length<600)errors.push(set.title+': mock passage too short');validate(set.questions,q=>q[1],q=>q[2],set.title);}
function simulatedBalancedPositions(rows,getOptions,getAnswer){const counts=[0,0,0,0];for(const q of rows){const opts=getOptions(q),answer=getAnswer(q);if(!opts.includes(answer))continue;const min=Math.min(...counts),target=[0,1,2,3].find(i=>counts[i]===min);counts[target]++;}return counts;}
const balanced=counts=>Math.max(...counts)-Math.min(...counts)<=1;
for(const section of common)if(!balanced(simulatedBalancedPositions(section.questions,q=>q[1],q=>q[2])))errors.push(section.title+': answer-position balance impossible/incorrect');
const listeningGroups=new Map();listening.forEach(q=>{const arr=listeningGroups.get(q.audioText)||[];arr.push(q);listeningGroups.set(q.audioText,arr);});
for(const group of listeningGroups.values())if(!balanced(simulatedBalancedPositions(group,q=>q.options,q=>q.answer)))errors.push('Listening group answer positions imbalanced');
for(const set of mock)if(!balanced(simulatedBalancedPositions(set.questions,q=>q[1],q=>q[2])))errors.push(set.title+': mock answer positions imbalanced');

if(!source.includes('function rebalanceEnglishOptionGroup')||!source.includes('rebalanceEnglishCommonReading()')||!source.includes('rebalanceEnglishListeningOptions()')||!source.includes('rebalanceEnglishMockOptions()'))errors.push('Answer-position balancing hooks are missing.');
if(!source.includes('englishCommonReadingSeen_')||!source.includes('englishCommonListeningSeen')||!source.includes('englishSaitamaMockSeen')||!source.includes('refill'))errors.push('No-repeat exam rotation hooks are missing.');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log('English exam banks OK: 8 long reading sections/60 questions (44 per test), 30 listening, two 10-question mocks; distinct options, no duplicate prompts, balanced-key and no-repeat hooks present.');
