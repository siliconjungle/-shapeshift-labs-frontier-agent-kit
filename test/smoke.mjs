import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assessFeatureRun,
  createFeatureRun,
  createFeatureRunProof,
  evaluateFeatureRunAcceptance,
  featureRunFromJsonl,
  featureRunProofToMarkdown,
  featureRunReviewToMarkdown,
  featureRunToJsonl,
  featureRunToMarkdownReport,
  finishFeatureRun,
  iterateFeatureRunJsonlRecords,
  indexFeatureRun,
  planFeatureRun,
  listFrontierPackageSurfaces,
  queryFeatureEvidence,
  recordCheckpoint,
  recordEvidence,
  recordFeatureStep,
  recordGateResult,
  redactFeatureRun,
  reviewFeatureRun
} from '../dist/index.js';
import { createFeatureEvidenceManifest, createFrontierAgentEvidencePlan } from '../dist/evidence.js';
import { summarizeFrontierPatch } from '../dist/frontier.js';
import { featureRunToLogRecords } from '../dist/logging.js';
import { frontierPlaywrightEvidenceToEvents } from '../dist/playwright.js';
import { domDevtoolsSnapshotToEvidence, summarizeDomDevtoolsSnapshot } from '../dist/dom.js';
import {
  initFrontierAgentWorkspace,
  inspectFrontierAgentWorkspace,
  readFeatureManifestFile,
  runCli,
  writeFeatureRunJsonlFile
} from '../dist/node.js';

test('records a feature run across Frontier evidence surfaces', () => {
  const manifest = createFeatureEvidenceManifest('feature.todo.complete', 'Complete todo item', {
    packages: [
      '@shapeshift-labs/frontier',
      '@shapeshift-labs/frontier-dom',
      '@shapeshift-labs/frontier-playwright',
      '@shapeshift-labs/frontier-logging'
    ],
    gates: [
      { id: 'unit', command: 'npm test', required: true, category: 'test' }
    ]
  });
  let run = createFeatureRun(manifest, {
    runId: 'run-test',
    traceId: 'trace-test',
    actor: { id: 'codex', kind: 'ai', model: 'gpt' },
    now: () => 1000
  });

  const patchSummary = summarizeFrontierPatch([
    [0, ['todos', 0, 'done'], true],
    [1, ['todos', 1]]
  ]);
  assert.equal(patchSummary.opCount, 2);
  assert.equal(patchSummary.pathCount, 2);

  run = recordFeatureStep(run, {
    id: 'step-1',
    title: 'toggle todo',
    status: 'passed',
    endedAt: 1010,
    reads: [['todos', 0, 'done']],
    writes: [['todos', 0, 'done']],
    packages: [{ name: '@shapeshift-labs/frontier', surface: 'patch' }],
    evidence: [
      {
        kind: 'frontier.patch.summary',
        package: '@shapeshift-labs/frontier',
        data: patchSummary,
        summary: 'patch summarized'
      }
    ]
  }, 1001);

  const domEvent = domDevtoolsSnapshotToEvidence({
    generatedAt: 1002,
    trace: [
      { kind: 'binding-dirty', bindingId: 1, bindingKind: 'text' },
      { kind: 'dom-write', bindingId: 1, bindingKind: 'text' }
    ],
    hydration: { issues: [] }
  }, { stepId: 'step-1' });
  run = recordEvidence(run, domEvent, 1002);

  const playwrightEvents = frontierPlaywrightEvidenceToEvents({
    generatedAt: new Date(1003).toISOString(),
    runId: 'pw-run',
    report: {
      generatedAt: new Date(1003).toISOString(),
      summary: { state: 2, dom: 1 },
      queries: [{ id: 'todo-done', count: 1, matches: [{ changed: true }] }]
    }
  }, { stepId: 'step-1' });
  for (const event of playwrightEvents) run = recordEvidence(run, event, 1003);

  run = recordGateResult(run, {
    id: 'unit',
    command: 'npm test',
    status: 'passed',
    required: true,
    durationMs: 42
  });
  run = finishFeatureRun(run, undefined, 1011);

  assert.equal(assessFeatureRun(run), 'passed');
  assert.equal(run.summary.evidenceCount, 4);
  assert.ok(run.summary.packages.includes('@shapeshift-labs/frontier-dom'));

  const plan = planFeatureRun(manifest, 2000);
  assert.ok(plan.requiredEvidenceKinds.includes('frontier.playwright.report'));
  assert.ok(plan.steps.some((step) => step.kind === 'gate' && step.command === 'npm test'));

  const review = reviewFeatureRun(run, 3000);
  assert.equal(review.ready, true);
  assert.equal(review.acceptance[0].status, 'passed');
  assert.equal(review.findings.filter((finding) => finding.severity === 'error').length, 0);
  assert.match(featureRunReviewToMarkdown(review), /Feature Run Review/);
  assert.match(featureRunToMarkdownReport(run), /Frontier Feature Run/);
  const acceptance = evaluateFeatureRunAcceptance(run);
  assert.equal(acceptance[0].status, 'passed');
  const index = indexFeatureRun(run);
  assert.ok(index.evidenceByKind['frontier.patch.summary'].length > 0);
  assert.equal(index.gatesById.unit.status, 'passed');
  const proof = createFeatureRunProof(run, 4000);
  assert.equal(proof.ready, true);
  assert.equal(proof.acceptance[0].status, 'passed');
  assert.match(featureRunProofToMarkdown(proof), /Frontier Feature Proof/);

  const jsonlRecords = [...iterateFeatureRunJsonlRecords(run)];
  assert.equal(jsonlRecords.length, 1 + run.steps.length + run.evidence.length + run.checkpoints.length + run.gates.length);
  const jsonl = featureRunToJsonl(run);
  const restored = featureRunFromJsonl(jsonl);
  assert.equal(restored.id, run.id);
  assert.equal(restored.evidence.length, run.evidence.length);

  const redacted = redactFeatureRun(recordEvidence(run, {
    kind: 'secret',
    data: { token: 'abc', nested: { password: 'def' } }
  }));
  const secret = queryFeatureEvidence(redacted, { kind: 'secret' })[0];
  assert.equal(secret.data.token, '[redacted]');
  assert.equal(secret.data.nested.password, '[redacted]');

  const logRecords = featureRunToLogRecords(run);
  assert.ok(logRecords.some((record) => record.name === 'frontier.agent.run.summary'));
});

test('evaluates state acceptance from checkpoints', () => {
  const manifest = {
    id: 'feature.acceptance.state',
    title: 'State acceptance',
    state: [{ id: 'checkout-status', path: ['checkout', 'status'] }],
    acceptance: [
      { id: 'status-paid', source: 'state', query: '/checkout/status', expected: 'paid', required: true }
    ]
  };
  let run = createFeatureRun(manifest, { runId: 'acceptance-pass', now: () => 1 });
  run = recordCheckpoint(run, {
    label: 'after checkout',
    data: { checkout: { status: 'paid' } }
  }, 2);
  run = finishFeatureRun(run, undefined, 3);
  assert.equal(assessFeatureRun(run), 'passed');
  assert.equal(evaluateFeatureRunAcceptance(run)[0].status, 'passed');

  let failed = createFeatureRun(manifest, { runId: 'acceptance-fail', now: () => 1 });
  failed = recordCheckpoint(failed, {
    label: 'after checkout',
    data: { checkout: { status: 'pending' } }
  }, 2);
  failed = finishFeatureRun(failed, undefined, 3);
  const review = reviewFeatureRun(failed);
  assert.equal(assessFeatureRun(failed), 'failed');
  assert.equal(review.ready, false);
  assert.ok(review.findings.some((finding) => finding.kind === 'acceptance' && finding.severity === 'error'));
});

test('review finds missing gates and undeclared writes', () => {
  let run = createFeatureRun({
    id: 'feature.review.findings',
    title: 'Review findings',
    packages: [{ name: '@shapeshift-labs/frontier' }],
    state: [{ id: 'declared', path: ['todos'] }],
    gates: [{ id: 'unit', command: 'npm test', required: true }]
  }, { runId: 'review-run' });
  run = recordFeatureStep(run, {
    title: 'write outside declaration',
    status: 'passed',
    writes: [['settings', 'theme']]
  });
  const review = reviewFeatureRun(run);
  assert.equal(review.ready, false);
  assert.ok(review.findings.some((finding) => finding.kind === 'path'));
  assert.ok(review.findings.some((finding) => finding.kind === 'gate' && finding.severity === 'error'));
  assert.ok(review.nextActions.length > 0);
});

test('exposes all Frontier package surfaces and workspace helpers', async () => {
  const surfaces = listFrontierPackageSurfaces();
  assert.equal(surfaces.length, 28);
  assert.ok(surfaces.some((surface) => surface.id === 'frontier-playwright' && surface.surfaces.includes('ai-session')));
  assert.ok(surfaces.some((surface) => surface.id === 'frontier-game'));

  const plan = createFrontierAgentEvidencePlan();
  assert.ok(plan.gates.some((gate) => gate.category === 'package-boundary'));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-agent-kit-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'agent-kit-target',
    type: 'module',
    scripts: { test: 'node --test' }
  }, null, 2) + '\n');
  const init = initFrontierAgentWorkspace(dir);
  assert.ok(init.created.includes('frontier-agent.config.json'));
  const report = inspectFrontierAgentWorkspace(dir);
  assert.equal(report.hasConfig, true);
  assert.equal(report.featureCount, 1);
  assert.equal(report.frontierPackageCount, 28);
  const manifest = readFeatureManifestFile(path.join(dir, 'features/example-feature.json'));
  const run = createFeatureRun(manifest, { runId: 'workspace-run' });
  writeFeatureRunJsonlFile(path.join(dir, 'agent-runs/workspace-run.jsonl'), run);
  assert.ok(fs.existsSync(path.join(dir, 'agent-runs/workspace-run.jsonl')));

  const planResult = await withConsoleSilenced(() => runCli(['plan', 'features/example-feature.json', '--cwd', dir, '--json'], process.cwd()));
  assert.equal(planResult.status, 0);
  assert.equal(planResult.output.featureId, 'feature.example');
  const validateResult = await withConsoleSilenced(() => runCli(['validate-manifest', 'features/example-feature.json', '--cwd', dir, '--json'], process.cwd()));
  assert.equal(validateResult.status, 0);
  const proofResult = await withConsoleSilenced(() => runCli(['proof', 'agent-runs/workspace-run.jsonl', '--cwd', dir, '--json'], process.cwd()));
  assert.equal(proofResult.status, 1);
  assert.equal(proofResult.output.kind, 'frontier.agent.feature-proof');
});

test('summarizes DOM devtools snapshots', () => {
  const summary = summarizeDomDevtoolsSnapshot({
    trace: [
      { kind: 'patch' },
      { kind: 'patch' },
      { kind: 'dom-write' }
    ],
    hydration: { issues: ['missing-anchor'] }
  });
  assert.equal(summary.patchCount, 2);
  assert.equal(summary.hydrationIssueCount, 1);
});

async function withConsoleSilenced(callback) {
  const originalLog = console.log;
  try {
    console.log = () => {};
    return await callback();
  } finally {
    console.log = originalLog;
  }
}
