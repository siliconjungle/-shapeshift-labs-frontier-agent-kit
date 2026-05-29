---
date: 2026-05-29
kind: iteration
area: frontier-agent-kit
tags: [iteration, bootstrap, ai, evidence, package-boundary, startup, fuzzing, benchmark]
verdict: accepted
decision: Bootstrapped Frontier Agent Kit as a standalone package above the Frontier family, with structural adapters and an Evidence Kit-compatible harness.
artifacts:
  source: src/index.ts, src/package-map.ts, src/frontier.ts, src/logging.ts, src/playwright.ts, src/dom.ts, src/evidence.ts, src/node.ts
  tests: test/smoke.mjs, test/types.ts
  fuzzers: test/fuzz/agent-kit-fuzz.mjs
  benchmarks: benchmarks/agent-kit-benchmark.mjs, benchmarks/startup-import.mjs, benchmarks/package-boundary-gates.mjs
---

# Bootstrap Frontier Agent Kit

## Goal

Create a standalone npm package and repository for an observable, extensible AI feature-work pattern over Frontier.

## Implemented

- Feature manifests for packages, state/query/action/UI surfaces, acceptance criteria, and gates.
- Feature runs with steps, tool calls, evidence events, checkpoints, gate results, summaries, redaction, and JSONL replay.
- Frontier package-family catalog covering all current GA, beta, hold, and incubation packages.
- Structural adapters for Frontier patch summaries, Frontier logging records, Frontier Playwright AI evidence, Frontier DOM devtools snapshots, Evidence Kit plans, and Node workspace files.
- CLI for workspace inspection, initialization, feature creation, run creation, and summaries.
- Smoke tests, TypeScript API test, deterministic fuzzer, benchmark, startup import gate, and package-boundary gate.

## Decision

Keep this package above the Frontier runtime packages. AI workflow concepts should not move into `frontier`, `codec`, `engine`, `state`, `dom`, `playwright`, `logging`, CRDT, realtime, or game packages. Those packages produce evidence; this package records the feature-run envelope.

## Deferred

- Visual feature-run inspector.
- Direct state-cache persistence adapters for run storage.
- OpenTelemetry/Perfetto exporters; the logging subpath currently emits structural Frontier log records.

