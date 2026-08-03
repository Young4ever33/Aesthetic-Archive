import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const failures = [];
const ignored = new Set(['node_modules', '.git', '.next', '.vercel', 'coverage']);
const sensitiveBasename = /^(?:\.env(?:\..*)?|.*\.(?:pem|key|p12|pfx))$/i;
const secretValue = /(sk-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:SUPABASE_SERVICE_ROLE_KEY|PROVIDER_ENCRYPTION_KEY)\s*=\s*(?!YOUR_|SERVER_ONLY_|BASE64_ENCODED_|replace-with|your-)[^\s#`]+|(?:api[_-]?key|secret)\s*[:=]\s*["'](?!your-|YOUR_|replace-)[^"']{20,}["'])/i;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else checkFile(full);
  }
}

function checkFile(file) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (sensitiveBasename.test(path.basename(file))) failures.push(`${relative}: sensitive filename must not be committed`);
  const stat = fs.statSync(file);
  if (stat.size > 10 * 1024 * 1024) failures.push(`${relative}: file exceeds 10 MB GitHub review limit`);
  if (!/\.(?:js|mjs|ts|tsx|json|md|yml|yaml|html|css|txt|sql)$/.test(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  if (secretValue.test(text) && !/docs\/ENVIRONMENT_TEMPLATE\.md$/.test(relative)) failures.push(`${relative}: possible secret value detected`);
  if (/node_modules|\.next|\.env\.local|\.DS_Store/.test(relative)) failures.push(`${relative}: generated or local file must not be committed`);
}

walk(root);
const required = ['README.md', 'LICENSE', 'package.json', 'pnpm-lock.yaml', '.gitignore', 'docs/ENVIRONMENT_TEMPLATE.md', 'docs/RELEASE_CHECKLIST.md'];
for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`${file}: required repository file is missing`);

if (failures.length) {
  console.error('GitHub checks failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('GitHub checks passed: no generated directories, sensitive filenames, obvious secrets, or oversized files detected.');
