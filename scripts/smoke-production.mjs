const baseUrl = (process.argv[2] || process.env.SMOKE_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('Usage: pnpm smoke:production -- https://your-production-domain.example');
  process.exit(2);
}

const checks = [
  ['homepage', '/', 200],
  ['workspace', '/app', 200],
  ['profile auth boundary', '/api/profile', 401],
  ['review auth boundary', '/api/admin/reviews', 401],
];
let failed = false;
for (const [name, path, expected] of checks) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  const result = response.status === expected ? 'PASS' : 'FAIL';
  console.log(`${result} ${name}: ${response.status} (expected ${expected})`);
  if (response.status !== expected) failed = true;
}
const headers = await fetch(`${baseUrl}/`, { redirect: 'manual' });
for (const name of ['x-content-type-options', 'x-frame-options', 'referrer-policy']) {
  const value = headers.headers.get(name);
  console.log(`${value ? 'PASS' : 'FAIL'} security header ${name}: ${value || 'missing'}`);
  if (!value) failed = true;
}
if (failed) process.exit(1);
console.log('Unauthenticated production smoke checks passed. Run the authenticated checklist separately with a real test account.');
