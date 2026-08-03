import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2] || 'docs/prompt-v3/A-04-parametric-architecture.sample.json';
const card = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
const zh = card.generationPrompt?.zh || '';
const en = card.generationPrompt?.en || '';
const negativeZh = card.negativePrompt?.zh || '';
const negativeEn = card.negativePrompt?.en || '';
const forbidden = /\{\{|\}\}|\[[^\]]*(subject|description|project|variable)[^\]]*\]|user[- ]provided|replace with|to be completed|待补充|用户提供|请填写|占位符/i;
const chinese = /[\u3400-\u9fff]/;
const requirements = {
  schemaV3: card.promptVersion === 3 && card.schemaId === 'aesthetic-archive.prompt-card.v3',
  zhRunnable: zh.length >= 350 && !forbidden.test(zh),
  enRunnable: en.length >= 700 && !forbidden.test(en),
  negativeSpecific: negativeZh.length >= 80 && negativeEn.length >= 160,
  englishIsolation: !chinese.test(en) && !chinese.test(negativeEn),
  noPlaceholders: !forbidden.test([zh, en, negativeZh, negativeEn].join('\n')),
  copyContract: card.copyBehavior?.default === 'generationPrompt' && card.copyBehavior?.containsPlaceholders === false,
  staticDimensions: ['style', 'composition', 'color', 'materialAndTexture'].every((key) => Number(card.qualityReview?.evidenceCoverage?.[key]) >= 0.8),
  honestGenerationStatus: card.qualityReview?.generationValidation?.status !== 'pass' || Number(card.qualityReview?.generationValidation?.score) >= 0.8,
};
console.log(requirements);
const failed = Object.entries(requirements).filter(([, pass]) => !pass);
if (failed.length) {
  console.error(`Prompt v3 validation failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Prompt v3 static validation passed: ${file}`);
if (card.qualityReview?.generationValidation?.status !== 'pass') console.log('Real generation gate remains incomplete.');
