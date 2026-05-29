import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const args = parseArgs(process.argv.slice(2));
const out = args.out || 'benchmarks/results/startup-import-latest.json';
const check = Boolean(args.check);
const imports = [
  ['root', '../dist/index.js'],
  ['frontier', '../dist/frontier.js'],
  ['logging', '../dist/logging.js'],
  ['playwright', '../dist/playwright.js'],
  ['dom', '../dist/dom.js'],
  ['evidence', '../dist/evidence.js'],
  ['package-map', '../dist/package-map.js'],
  ['node', '../dist/node.js']
];

const rows = [];
for (const [fixture, specifier] of imports) {
  const start = performance.now();
  await import(specifier + '?t=' + Date.now() + Math.random());
  const durationUs = (performance.now() - start) * 1000;
  rows.push({
    category: 'startup',
    fixture,
    library: '@shapeshift-labs/frontier-agent-kit',
    status: check && durationUs > 50000 ? 'over-budget' : 'ok',
    medianUs: Math.round(durationUs * 100) / 100,
    p95Us: Math.round(durationUs * 100) / 100,
    budgetUs: 50000
  });
}

const payload = { name: 'startup-import', generatedAt: new Date().toISOString(), node: process.version, rows };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');
if (check && rows.some((row) => row.status !== 'ok')) {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}
console.log('wrote ' + out);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') out.check = true;
    else if (argv[i] === '--out') out.out = argv[++i];
  }
  return out;
}
