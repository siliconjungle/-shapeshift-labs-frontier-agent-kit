# Frontier Agent Kit

Observable feature-run contracts and evidence adapters for AI agents working with Frontier applications.

`@shapeshift-labs/frontier-agent-kit` sits above the Frontier package family. It does not replace `@shapeshift-labs/evidence-kit`; it composes with it. Evidence Kit owns the generic repository harness for tests, fuzzers, benchmarks, package-boundary gates, startup checks, source passes, and perf docs. Frontier Agent Kit owns the runtime shape of an AI feature attempt: manifests, steps, tool calls, Frontier patch evidence, DOM/Playwright/logging adapters, checkpoints, gates, JSONL replay, and redaction.

## Install

```sh
npm install @shapeshift-labs/frontier-agent-kit
npm install -D @shapeshift-labs/evidence-kit
```

Optional peers are only needed for the integrations you use:

```sh
npm install @shapeshift-labs/frontier @shapeshift-labs/frontier-logging
npm install @shapeshift-labs/frontier-dom @shapeshift-labs/frontier-playwright
```

## Package Shape

The root import is dependency-light and JSON-only:

```ts
import {
  createFeatureRun,
  recordFeatureStep,
  recordEvidence,
  featureRunToJsonl
} from '@shapeshift-labs/frontier-agent-kit';
```

Optional integrations stay behind subpaths:

```ts
import { summarizeFrontierPatch } from '@shapeshift-labs/frontier-agent-kit/frontier';
import { featureRunToLogRecords } from '@shapeshift-labs/frontier-agent-kit/logging';
import { frontierPlaywrightEvidenceToEvents } from '@shapeshift-labs/frontier-agent-kit/playwright';
import { domDevtoolsSnapshotToEvidence } from '@shapeshift-labs/frontier-agent-kit/dom';
import { initFrontierAgentWorkspace } from '@shapeshift-labs/frontier-agent-kit/node';
```

## Feature Runs

```ts
import {
  createFeatureRun,
  finishFeatureRun,
  recordFeatureStep,
  recordGateResult
} from '@shapeshift-labs/frontier-agent-kit';
import { summarizeFrontierPatch } from '@shapeshift-labs/frontier-agent-kit/frontier';

let run = createFeatureRun({
  id: 'feature.checkout.submit',
  title: 'Submit checkout',
  packages: [
    { name: '@shapeshift-labs/frontier', surface: 'patch' },
    { name: '@shapeshift-labs/frontier-dom', surface: 'devtools' },
    { name: '@shapeshift-labs/frontier-playwright', surface: 'ai-session' }
  ],
  acceptance: [
    { id: 'status-paid', source: 'state', query: '/checkout/status', expected: 'paid', required: true }
  ],
  gates: [
    { id: 'unit', command: 'npm test', required: true, category: 'test' },
    { id: 'fuzz', command: 'npm run fuzz', required: true, category: 'fuzz' }
  ]
}, { runId: 'checkout-run-1', actor: { id: 'codex', kind: 'ai' } });

const patchSummary = summarizeFrontierPatch([[0, ['checkout', 'status'], 'paid']]);

run = recordFeatureStep(run, {
  title: 'commit checkout status',
  status: 'passed',
  writes: [['checkout', 'status']],
  evidence: [
    { kind: 'frontier.patch.summary', package: '@shapeshift-labs/frontier', data: patchSummary }
  ]
});

run = recordGateResult(run, {
  id: 'unit',
  command: 'npm test',
  status: 'passed',
  required: true
});

run = finishFeatureRun(run);
```

## CLI

```sh
frontier-agent-kit inspect --json
frontier-agent-kit init
frontier-agent-kit init-feature --id feature.checkout.submit --title "Submit checkout"
frontier-agent-kit new-run features/feature.checkout.submit.json
frontier-agent-kit summarize agent-runs/run-id.json --json
```

`init` creates:

- `frontier-agent.config.json`
- `features/example-feature.json`
- `agent-runs/`
- `research/frontier-agent-kit-sources.json`

## Frontier Package Coverage

The package map includes all current Frontier package-family surfaces:

- GA: `frontier`, `frontier-query`, `frontier-codec`, `frontier-engine`, `frontier-state`, `frontier-state-cache`, `frontier-state-cache-idb`, `frontier-state-cache-file`, `frontier-state-cache-sql`, `frontier-schema`, `frontier-event-log`, `frontier-logging`, `frontier-mutation`
- Beta: `frontier-crdt`, `frontier-crdt-sync`, `frontier-crdt-websocket`, `frontier-react`
- Hold: `frontier-richtext`
- Incubation: `frontier-scheduler`, `frontier-virtual`, `frontier-scene`, `frontier-pathfinding`, `frontier-dom`, `frontier-playwright`, `frontier-realtime`, `frontier-realtime-server`, `frontier-realtime-websocket`, `frontier-game`

The design keeps AI workflow concepts out of lower Frontier layers. Frontier packages expose state, patch, cache, DOM, Playwright, logging, CRDT, realtime, and game evidence; this package records the feature-run envelope around them.

## Evidence Kit Integration

Use Evidence Kit for the repository-level harness:

```sh
npx evidence-kit init --language ts
npm run evidence:full
```

Use Frontier Agent Kit for feature-level observability:

```sh
npm run agent:inspect
frontier-agent-kit new-run features/my-feature.json
```

The two layers meet through structured artifacts:

- Feature manifests name Frontier packages, paths, actions, UI bindings, acceptance criteria, and gates.
- Feature runs record steps, tool calls, evidence events, checkpoints, and gate results.
- Evidence Kit indexes the research notes, benchmark JSON, fuzz corpus, package-boundary rows, and decision records that justify those feature runs.

## API

Root:

- `createFeatureRun(manifest, options?)`
- `recordFeatureStep(run, step, now?)`
- `recordEvidence(run, event, now?)`
- `recordCheckpoint(run, checkpoint, now?)`
- `recordGateResult(run, result)`
- `finishFeatureRun(run, status?, now?)`
- `featureRunToJsonl(run)` / `featureRunFromJsonl(jsonl)`
- `redactFeatureRun(run, policy?)`
- `listFrontierPackageSurfaces()`

Subpaths:

- `./frontier`: patch summaries and state checkpoints.
- `./logging`: structural Frontier logger records.
- `./playwright`: Frontier Playwright AI evidence/report adapters.
- `./dom`: Frontier DOM devtools snapshot adapters.
- `./evidence`: Evidence Kit script/gate planning helpers.
- `./node`: filesystem workspace helpers and CLI implementation.
- `./package-map`: Frontier package-family catalog.

## Benchmarks

Run:

```sh
npm run bench
npm run bench:startup:check
npm run bench:package:gates
```

Benchmark JSON is written under `benchmarks/results/*latest.json` and indexed by:

```sh
npm run docs:perf
npm run docs:perf:search -- agent-kit
```

## Release Gate

Before publishing:

```sh
npm run test
npm run fuzz -- --cases 1000
npm run bench
npm run bench:startup:check
npm run bench:package:gates
npm run docs:perf
npm run docs:perf -- --check
npm run pack:dry
```

