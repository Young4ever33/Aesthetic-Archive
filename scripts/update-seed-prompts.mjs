import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const jsonPath = path.join(root, 'public/local-mvp/src/data/cases.json');
const jsPath = path.join(root, 'public/local-mvp/src/data/cases.js');
const cases = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

function structuredPrompt(prompt, item, language) {
  const text = String(prompt || '').trim();
  const subject = language === 'zh' ? '以用户提供的主体描述为画面主体' : 'Use the user-provided subject description as the visual subject';
  const context = language === 'zh'
    ? `适用场景：${item.scenarioTags?.join('、') || '视觉研究、风格参考、AI 图像生成'}`
    : `Use cases: ${item.scenarioTags?.join(', ') || 'visual research, style reference, AI image generation'}`;
  return [
    language === 'zh' ? '【主体】' : '[SUBJECT]',
    subject,
    language === 'zh' ? '【风格与语境】' : '[STYLE AND CONTEXT]',
    text,
    language === 'zh' ? '【构图与镜头】' : '[COMPOSITION AND CAMERA]',
    item.designLogic || item.composition || (language === 'zh' ? '明确主体层级、留白、视线动线和画面比例' : 'Define hierarchy, negative space, visual flow, and aspect ratio'),
    language === 'zh' ? '【材质、光线与色彩】' : '[MATERIALS, LIGHT, AND COLOR]',
    `${item.imagery || item.materialTags?.join('、') || ''}${item.palette?.length ? `；${item.palette.map(color => typeof color === 'string' ? color : `${color.name} ${color.hex}`).join('、')}` : ''}`,
    language === 'zh' ? '【使用约束】' : '[CONSTRAINTS]',
    context,
  ].filter(Boolean).join('\n');
}

for (const item of cases) {
  item.promptVersion = 2;
  item.promptSchema = ['subject', 'style_and_context', 'composition_and_camera', 'materials_light_color', 'constraints', 'negative_prompt'];
  item.promptZh = structuredPrompt(item.promptZh, item, 'zh');
  item.promptEn = structuredPrompt(item.promptEn, item, 'en');
  item.negativePrompt = 'generic decoration, unrelated objects, invented provenance, inconsistent materials, weak hierarchy, unreadable text, low-resolution, watermark, malformed geometry';
  item.sourceType = 'curated-seed-pending-license-confirmation';
  item.sourceNote = 'Curated seed reference retained for beta evaluation. Confirm ownership or redistribution license before production publication.';
}

fs.writeFileSync(jsonPath, `${JSON.stringify(cases, null, 2)}\n`);
fs.writeFileSync(jsPath, `window.AA_CASES = ${JSON.stringify(cases, null, 2)};\n`);
console.log(`Updated ${cases.length} seed cards to Prompt schema v2.`);
