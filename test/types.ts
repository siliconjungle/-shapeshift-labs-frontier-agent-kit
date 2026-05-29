import {
  createFeatureRun,
  recordFeatureStep,
  type FeatureManifest,
  type FeatureRun
} from '../src/index.js';
import { summarizeFrontierPatch, type FrontierPatchLike } from '../src/frontier.js';
import { featureRunToLogRecords, type FrontierAgentLogRecord } from '../src/logging.js';
import { frontierPlaywrightEvidenceToEvents } from '../src/playwright.js';
import { domDevtoolsSnapshotToEvidence } from '../src/dom.js';
import { createFrontierAgentEvidencePlan } from '../src/evidence.js';

const manifest: FeatureManifest = {
  id: 'feature.types',
  title: 'Type surface',
  packages: [{ name: '@shapeshift-labs/frontier', surface: 'patch' }]
};

let run: FeatureRun = createFeatureRun(manifest);
const patch: FrontierPatchLike = [[0, ['value'], true]];
const summary = summarizeFrontierPatch(patch);
run = recordFeatureStep(run, {
  title: 'apply patch',
  evidence: [{ kind: 'frontier.patch.summary', data: summary as unknown as import('../src/index.js').JsonValue }]
});
const records: FrontierAgentLogRecord[] = featureRunToLogRecords(run);
const pw = frontierPlaywrightEvidenceToEvents({ report: { queries: [{ id: 'q', count: 1 }] } });
const dom = domDevtoolsSnapshotToEvidence({ trace: [{ kind: 'dom-write' }] });
const plan = createFrontierAgentEvidencePlan(manifest);

void records;
void pw;
void dom;
void plan;
