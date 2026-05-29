import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  createFeatureRun,
  featureRunToJsonl,
  recordEvidence,
  recordFeatureStep,
  redactFeatureRun
} from '../dist/index.js';
import { summarizeFrontierPatch } from '../dist/frontier.js';
import { featureRunToLogRecords } from '../dist/logging.js';

const args = parseArgs(process.argv.slice(2));
const rounds = Number(args.rounds ?? 80);
const out = args.out || 'benchmarks/results/agent-kit-latest.json';

const rows = [
  bench('create-feature-run-1000', rounds, () => {
    for (let i = 0; i < 1000; i++) createFixtureRun(i, 1);
  }),
  bench('record-steps-and-evidence-1000', rounds, () => {
    let run = createFixtureRun(1, 0);
    for (let i = 0; i < 1000; i++) {
      run = recordFeatureStep(run, { title: 'step ' + i, status: 'passed', evidence: [{ kind: 'bench', data: { value: i } }] }, i);
    }
    if (run.evidence.length !== 1000) throw new Error('bad evidence count');
  }),
  bench('jsonl-export-1000-events', rounds, () => {
    const run = createFixtureRun(2, 1000);
    const jsonl = featureRunToJsonl(run);
    if (jsonl.length < 1000) throw new Error('bad jsonl');
  }),
  bench('redact-1000-events', rounds, () => {
    const run = createFixtureRun(3, 1000);
    redactFeatureRun(run);
  }),
  bench('log-records-1000-events', rounds, () => {
    const run = createFixtureRun(4, 1000);
    featureRunToLogRecords(run);
  }),
  bench('summarize-patch-1000-ops', rounds, () => {
    const patch = Array.from({ length: 1000 }, (_, i) => [0, ['rows', i, 'value'], i]);
    summarizeFrontierPatch(patch);
  })
];

const payload = {
  name: 'frontier-agent-kit',
  generatedAt: new Date().toISOString(),
  node: process.version,
  rows
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');
console.log('wrote ' + out);

function createFixtureRun(id, eventCount) {
  let run = createFeatureRun({
    id: 'feature.bench.' + id,
    title: 'Benchmark feature ' + id,
    packages: [{ name: '@shapeshift-labs/frontier' }]
  }, { runId: 'bench-run-' + id, now: () => 1 });
  for (let i = 0; i < eventCount; i++) {
    run = recordEvidence(run, {
      kind: 'bench.event',
      data: { value: i, token: 'secret-' + i }
    }, i);
  }
  return run;
}

function bench(fixture, rounds, fn) {
  const samples = [];
  for (let i = 0; i < rounds; i++) {
    const start = performance.now();
    fn();
    samples.push((performance.now() - start) * 1000);
  }
  samples.sort((a, b) => a - b);
  return {
    category: 'agent-kit',
    fixture,
    library: '@shapeshift-labs/frontier-agent-kit',
    status: 'ok',
    medianUs: round(samples[Math.floor(samples.length / 2)]),
    p95Us: round(samples[Math.floor(samples.length * 0.95)]),
    rounds
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
