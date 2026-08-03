# MVP Static Checks

Run from project root:

```bash
node - <<'NODE'
const fs = require('fs');
new Function(fs.readFileSync('app.js', 'utf8'));
console.log('PASS app.js syntax');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');
const checks = {
  'marketing hero': html.includes('别再只是收藏参考图，开始搭建你的审美知识库。'),
  'app shell panels': html.includes('data-panel="plaza"') && html.includes('data-panel="archive"') && html.includes('data-panel="collage"'),
  'public plaza exports': html.includes('plaza-export-md-btn') && html.includes('plaza-export-json-btn'),
  'archive multi image': html.includes('archive-file') && html.includes('multiple'),
  'provider manager': html.includes('provider-list') && html.includes('provider-image-models') && html.includes('provider-image-api'),
  'collage toolrail': html.includes('collage-toolrail'),
  'prompt colors': css.includes('--prompt-zh') && css.includes('--prompt-en'),
  'free canvas nodes': css.includes('.board-node') && css.includes('.board-stroke'),
  'provider storage': js.includes("providers: 'aa_ai_providers_v1'"),
  'private archive storage': js.includes("privateCases: 'aa_private_cases_v1'"),
  'collage storage': js.includes("collage: 'aa_collage_board_v1'"),
  'publish workflow': js.includes('function updatePublishStatus') && js.includes("publishStatus === 'published'"),
  'provider image analysis': js.includes('async function analyzeImageWithProvider'),
  'board ai summary': js.includes('async function generateBoardAISummary'),
  'remove background': js.includes('async function removeBackgroundFromNode'),
  'extract palette': js.includes('function extractPaletteFromNode'),
  'undo redo': js.includes('function undoCollage') && js.includes('function redoCollage'),
  'esc clears board selection': js.includes('function clearBoardSelection')
};
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
}
NODE
```

Expected: all checks pass.
