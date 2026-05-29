import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  createFeatureRun,
  createFeatureRunProof,
  evaluateFeatureRunAcceptance,
  featureRunToJsonl,
  featureRunProofToMarkdown,
  featureRunToMarkdownReport,
  indexFeatureRun,
  iterateFeatureRunJsonlRecords,
  planFeatureRun,
  recordCheckpoint,
  recordEvidence,
  recordFeatureStep,
  redactFeatureRun,
  reviewFeatureRun
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
  bench('review-run-1000-events', rounds, () => {
    const run = createFixtureRun(5, 1000);
    reviewFeatureRun(run);
  }),
  bench('index-run-1000-events', rounds, () => {
    const run = createFixtureRun(8, 1000);
    const index = indexFeatureRun(run);
    if (Object.keys(index.evidenceByKind).length === 0) throw new Error('bad index');
  }),
  bench('evaluate-acceptance-1000-events', rounds, () => {
    const run = createAcceptanceFixtureRun(9, 1000);
    const results = evaluateFeatureRunAcceptance(run);
    if (results[0]?.status !== 'passed') throw new Error('bad acceptance');
  }),
  bench('proof-markdown-1000-events', rounds, () => {
    const run = createAcceptanceFixtureRun(10, 1000);
    const markdown = featureRunProofToMarkdown(createFeatureRunProof(run));
    if (!markdown.includes('Frontier Feature Proof')) throw new Error('bad proof');
  }),
  bench('markdown-report-1000-events', rounds, () => {
    const run = createFixtureRun(6, 1000);
    featureRunToMarkdownReport(run);
  }),
  bench('jsonl-record-iterator-1000-events', rounds, () => {
    const run = createFixtureRun(7, 1000);
    let count = 0;
    for (const _record of iterateFeatureRunJsonlRecords(run)) count++;
    if (count !== 1001) throw new Error('bad record count');
  }),
  bench('plan-feature-run-1000', rounds, () => {
    for (let i = 0; i < 1000; i++) {
      planFeatureRun({
        id: 'feature.plan.' + i,
        title: 'Plan feature ' + i,
        packages: [{ name: '@shapeshift-labs/frontier-playwright' }],
        gates: [{ id: 'unit', command: 'npm test', required: true }]
      });
    }
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

function createAcceptanceFixtureRun(id, eventCount) {
  let run = createFeatureRun({
    id: 'feature.bench.acceptance.' + id,
    title: 'Benchmark acceptance feature ' + id,
    packages: [{ name: '@shapeshift-labs/frontier' }],
    acceptance: [
      { id: 'status-ready', source: 'state', query: '/state/status', expected: 'ready', required: true }
    ],
    gates: [{ id: 'unit', command: 'npm test', required: true, category: 'test' }]
  }, { runId: 'bench-acceptance-run-' + id, now: () => 1 });
  for (let i = 0; i < eventCount; i++) {
    run = recordEvidence(run, {
      kind: 'bench.event',
      data: { value: i, token: 'secret-' + i }
    }, i);
  }
  run = recordCheckpoint(run, {
    label: 'ready',
    data: { state: { status: 'ready' } }
  }, eventCount + 1);
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
