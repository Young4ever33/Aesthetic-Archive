import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const cards = JSON.parse(fs.readFileSync(path.join(root, 'public/local-mvp/src/data/cases.json'), 'utf8'));
const jsSource = fs.readFileSync(path.join(root, 'public/local-mvp/src/data/cases.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(jsSource, context);
const browserCards = JSON.parse(JSON.stringify(context.window.AA_CASES));
const forbidden = /\{\{|\}\}|\[[^\]]*(subject|description|project|variable)[^\]]*\]|user[- ]provided|replace with|to be completed|待补充|用户提供|请填写|占位符/i;
const chinese = /[\u3400-\u9fff]/;
const qualitySlogans = /masterpiece|best quality|8k|award[- ]winning|杰作|最佳质量|获奖/i;
const failures = [];

if (cards.length !== 22) failures.push(`expected 22 cards, received ${cards.length}`);
if (JSON.stringify(cards) !== JSON.stringify(browserCards)) failures.push('cases.json and cases.js are not synchronized');

for (const card of cards) {
  const fields = [card.promptZh, card.promptEn, card.negativePromptZh, card.negativePromptEn];
  if (card.promptVersion !== 3 || card.promptSchemaId !== 'aesthetic-archive.prompt-card.v3') failures.push(`${card.id}: invalid Prompt v3 identity`);
  if (String(card.promptZh || '').length < 220) failures.push(`${card.id}: Chinese Prompt is too short`);
  if (String(card.promptEn || '').length < 580) failures.push(`${card.id}: English Prompt is too short`);
  if (String(card.negativePromptZh || '').length < 60) failures.push(`${card.id}: Chinese Negative Prompt is too short`);
  if (String(card.negativePromptEn || '').length < 180) failures.push(`${card.id}: English Negative Prompt is too short`);
  if (forbidden.test(fields.join('\n'))) failures.push(`${card.id}: placeholder or meta instruction found`);
  if (chinese.test(String(card.promptEn || '')) || chinese.test(String(card.negativePromptEn || ''))) failures.push(`${card.id}: English language isolation failed`);
  if (qualitySlogans.test(fields.join('\n'))) failures.push(`${card.id}: model-specific quality slogan found`);
  if (card.promptEngineering?.directlyRunnable !== true || card.promptEngineering?.containsPlaceholders !== false || card.promptEngineering?.providerNeutral !== true) failures.push(`${card.id}: Prompt engineering contract incomplete`);
  const status = card.promptEngineering?.review?.status;
  if (card.id === 'A-04' && status !== 'passed') failures.push('A-04: accepted generation review is not recorded');
  if (card.id !== 'A-04' && status !== 'static-pass-generation-pending') failures.push(`${card.id}: untested card must remain generation-pending`);
}

if (failures.length) {
  console.error(`Seed Prompt validation failed (${failures.length}):`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Seed Prompt v3 validation passed for ${cards.length} cards.`);
console.log('A-04: user-accepted generation review recorded.');
console.log(`${cards.length - 1} cards: static optimization passed; real generation review remains pending.`);
