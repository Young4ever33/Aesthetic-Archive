import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('public/local-mvp/app.js');
const html = read('public/local-mvp/index.html');
const gateway = read('lib/ai-gateway.ts');
const review = read('app/api/admin/reviews/route.ts');
const reviewCompat = read('app/api/cards/review/route.ts');
const failures = [];

function requireMatch(value, pattern, message) {
  if (!pattern.test(value)) failures.push(message);
}
function forbid(value, pattern, message) {
  if (pattern.test(value)) failures.push(message);
}

const detailIds = [
  'detail-elements-block',
  'detail-composition-block',
  'detail-palette-block',
  'detail-use-cases-block',
  'detail-prompt-zh-block',
  'detail-prompt-en-block',
];
let previous = -1;
for (const id of detailIds) {
  const index = html.indexOf(`id="${id}"`);
  if (index < 0 || index <= previous) failures.push(`card detail field is missing or out of order: ${id}`);
  previous = index;
}
forbid(html, /detail-(?:negative|generation)-block/, 'card detail contains an unapproved extra content block');
requireMatch(html, /id="detail-background-title">风格背景</, 'left detail column must contain 风格背景');
requireMatch(html, /app-20260804-final-audit\.js/, 'workspace HTML is not loading the current fingerprinted script');
requireMatch(html, /styles-20260804-review-ai\.css/, 'workspace HTML is not loading the current fingerprinted stylesheet');
forbid(html, /review-access-20260804\.js/, 'workspace still loads the obsolete review bootstrap race');

forbid(app, /generateLocalAestheticDraft|模拟\s*AI|compressImageFile/, 'workspace still contains simulated AI or reference-image compression');
requireMatch(app, /function readImageFile\(file\)/, 'original reference image reader is missing');
requireMatch(app, /images, templateId:/, 'vision request does not send the images array');
requireMatch(app, /AI 返回的卡片不符合内容标准/, 'AI draft quality gate is missing');
requireMatch(app, /const distinctField =/, 'cross-field structured content deduplication is missing');
requireMatch(app, /const recordKind = item\?\.source === 'private' \|\| item\?\.ownerId \|\| item\?\.owner_id \? 'user' : 'seed'/, 'seed and user card identities are not kept separate');
requireMatch(app, /payload\.error\?\.code, payload\.requestId/, 'state-changing UI errors do not expose safe diagnostics');
requireMatch(app, /Promise\.allSettled\(\[/, 'workspace synchronization can still disable all interactions after one partial failure');

forbid(gateway, /AbortController|setTimeout\s*\(|for\s*\([^)]*retry|while\s*\([^)]*retry/i, 'AI Gateway contains an application deadline or retry loop');
requireMatch(gateway, /images\.map\(image => \(\{ type: 'image_url'/, 'OpenAI-compatible vision request is not multi-image');
requireMatch(gateway, /images\.map\(image => \(\{ inline_data:/, 'Gemini vision request is not multi-image');

for (const [source, name] of [[review, 'admin review route'], [reviewCompat, 'compatibility review route']]) {
  requireMatch(source, /SELF_REVIEW_FORBIDDEN/, `${name} does not forbid self-review`);
  requireMatch(source, /REVIEW_AUDIT_FAILED/, `${name} does not enforce audit persistence`);
  requireMatch(source, /REVIEW_NOTIFICATION_FAILED/, `${name} does not enforce author notification persistence`);
}
requireMatch(review, /\.neq\('owner_id', user\.id\)/, 'review queue does not exclude the reviewer own cards');
requireMatch(reviewCompat, /INVALID_ACTION/, 'review compatibility route accepts unknown actions');

if (failures.length) {
  console.error('Workspace contract checks failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Workspace contract checks passed: moderation, Likes, multi-image AI, card detail, and Provider request invariants are present.');
