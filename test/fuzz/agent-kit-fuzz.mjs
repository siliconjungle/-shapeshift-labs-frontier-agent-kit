import assert from 'node:assert/strict';
import {
  createFeatureRun,
  featureRunFromJsonl,
  featureRunToJsonl,
  queryFeatureEvidence,
  recordEvidence,
  recordFeatureStep,
  redactFeatureRun
} from '../../dist/index.js';

const args = parseArgs(process.argv.slice(2));
const cases = Number(args.cases ?? 1000);
let seed = Number(args.seed ?? 123456789);

for (let i = 0; i < cases; i++) {
  const id = 'feature.fuzz.' + i;
  let run = createFeatureRun({
    id,
    title: 'Fuzz feature ' + i,
    packages: [{ name: pickPackage() }],
    gates: [{ id: 'test', command: 'npm test', required: true }]
  }, { runId: 'run-' + i, now: () => i + 1 });
  const stepCount = 1 + randInt(5);
  for (let step = 0; step < stepCount; step++) {
    run = recordFeatureStep(run, {
      title: 'step ' + step,
      status: randInt(5) === 0 ? 'failed' : 'passed',
      reads: [['state', randInt(20)]],
      writes: [['state', randInt(20)]],
      evidence: [{
        kind: 'fuzz.event',
        severity: randInt(20) === 0 ? 'warn' : 'info',
        data: {
          token: 'secret-' + step,
          value: randInt(1000),
          nested: { password: 'pw-' + i }
        }
      }]
    }, i * 100 + step);
  }
  run = recordEvidence(run, {
    kind: 'fuzz.tail',
    data: { ok: true, values: Array.from({ length: randInt(8) }, () => randInt(50)) }
  });
  const jsonl = featureRunToJsonl(run);
  const restored = featureRunFromJsonl(jsonl);
  assert.equal(restored.id, run.id);
  assert.equal(restored.steps.length, run.steps.length);
  assert.equal(restored.evidence.length, run.evidence.length);
  const redacted = redactFeatureRun(restored);
  const event = queryFeatureEvidence(redacted, { kind: 'fuzz.event' })[0];
  assert.equal(event.data.token, '[redacted]');
  assert.equal(event.data.nested.password, '[redacted]');
}

console.log('agent-kit fuzz passed cases=' + cases + ' seed=' + Number(args.seed ?? 123456789));

function pickPackage() {
  const packages = [
    '@shapeshift-labs/frontier',
    '@shapeshift-labs/frontier-state',
    '@shapeshift-labs/frontier-dom',
    '@shapeshift-labs/frontier-playwright',
    '@shapeshift-labs/frontier-logging',
    '@shapeshift-labs/frontier-crdt-sync'
  ];
  return packages[randInt(packages.length)];
}

function randInt(max) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed % max;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

