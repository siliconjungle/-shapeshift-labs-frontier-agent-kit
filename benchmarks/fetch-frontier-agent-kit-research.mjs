import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const topic = 'frontier-agent-kit';
const sourcesPath = path.join('research', `${topic}-sources.json`);
const manifestDir = path.join('research', 'repos', topic);
const dataDir = path.join('benchmarks', 'data', topic);
fs.mkdirSync(manifestDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

const sources = fs.existsSync(sourcesPath)
  ? JSON.parse(fs.readFileSync(sourcesPath, 'utf8')).sources ?? []
  : [];
const fetched = [];
for (const source of sources) {
  if (source.type === 'inline') {
    const fileName = source.fileName || `${source.name}.txt`;
    fs.writeFileSync(path.join(dataDir, fileName), source.text || '');
    fetched.push({ name: source.name, type: source.type, path: path.join(dataDir, fileName) });
  } else if (source.type === 'git') {
    const target = path.join(manifestDir, source.name);
    if (fs.existsSync(path.join(target, '.git'))) {
      execFileSync('git', ['-C', target, 'fetch', '--all', '--tags'], { stdio: 'pipe' });
    } else {
      execFileSync('git', ['clone', source.url, target], { stdio: 'pipe' });
    }
    if (source.ref) execFileSync('git', ['-C', target, 'checkout', source.ref], { stdio: 'pipe' });
    const commit = execFileSync('git', ['-C', target, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    fetched.push({ name: source.name, type: source.type, path: target, commit });
  }
}

const manifest = {
  version: 1,
  topic,
  generatedAt: new Date().toISOString(),
  fetched
};
fs.writeFileSync(path.join(manifestDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote ' + path.join(manifestDir, 'manifest.json'));

