import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = parseArgs(process.argv.slice(2));
const out = args.out || 'benchmarks/results/package-boundary-gates-latest.json';
const check = Boolean(args.check);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const rows = [];

for (const [subpath, target] of Object.entries(pkg.exports)) {
  if (subpath === './package.json') continue;
  const importPath = typeof target === 'string' ? target : target.import;
  const typesPath = typeof target === 'string' ? undefined : target.types;
  rows.push(row('package-boundary', 'export-' + subpath, fs.existsSync(importPath) && (!typesPath || fs.existsSync(typesPath)), { importPath, typesPath }));
}

const rootSource = fs.readFileSync('dist/index.js', 'utf8');
rows.push(row('package-boundary', 'root-no-node-runtime-imports', !/node:fs|node:path|node:child_process/.test(rootSource)));
rows.push(row('package-boundary', 'root-no-optional-frontier-imports', !/from ['"]@shapeshift-labs\/frontier/.test(rootSource)));
rows.push(row('package-boundary', 'frontier-package-map-count', rootSource.includes('FRONTIER_PACKAGE_SURFACES') || fs.readFileSync('dist/package-map.js', 'utf8').includes('frontier-game')));

let packOk = false;
let packBytes = 0;
try {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const parsed = JSON.parse(output)[0];
  packOk = parsed.files.some((file) => file.path === 'dist/index.js') && parsed.files.some((file) => file.path === 'README.md');
  packBytes = parsed.unpackedSize;
} catch {
  packOk = false;
}
rows.push(row('package-boundary', 'npm-pack-dry-run', packOk, { unpackedBytes: packBytes }));

const payload = { name: 'package-boundary-gates', generatedAt: new Date().toISOString(), node: process.version, rows };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');
if (check && rows.some((item) => item.status !== 'ok')) {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}
console.log('wrote ' + out);

function row(category, fixture, ok, extra = {}) {
  return {
    category,
    fixture,
    library: '@shapeshift-labs/frontier-agent-kit',
    status: ok ? 'ok' : 'failed',
    ...extra
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') out.check = true;
    else if (argv[i] === '--out') out.out = argv[++i];
  }
  return out;
}
