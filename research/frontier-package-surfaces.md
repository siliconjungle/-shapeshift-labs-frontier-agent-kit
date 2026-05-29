---
date: 2026-05-29
kind: research
area: frontier-agent-kit
tags: [research, frontier-packages, package-boundary, ai, evidence, observability]
verdict: accepted
decision: Frontier Agent Kit should stay above the package family as a feature-run and evidence envelope. Root imports stay dependency-light; package-specific integrations remain structural subpaths.
artifacts:
  source: src/package-map.ts
  tests: test/smoke.mjs, test/types.ts
  benchmarks: benchmarks/agent-kit-benchmark.mjs, benchmarks/startup-import.mjs, benchmarks/package-boundary-gates.mjs
---

# Frontier Package Surface Review

The package map was reviewed against `config/release-train.json`, local package READMEs, local `package.json` exports, and available standalone repositories under `/Users/james/Documents`.

## Accepted Integration Shape

- `@shapeshift-labs/frontier-agent-kit` is a tooling/runtime envelope above all Frontier packages.
- Root imports contain feature manifests, feature runs, evidence events, gates, redaction, JSONL replay, and the package catalog.
- Optional adapters live under subpaths: `./frontier`, `./logging`, `./playwright`, `./dom`, `./evidence`, `./node`.
- The package uses structural types for Frontier integrations instead of importing every Frontier package.
- Evidence Kit remains the generic repository evidence harness.

## Package Coverage

| Package | Tier | Agent Kit Role |
| --- | --- | --- |
| `@shapeshift-labs/frontier` | GA | Patch summaries, path evidence, state checkpoints, registry references. |
| `@shapeshift-labs/frontier-query` | GA | Query-key and selector evidence in manifests and acceptance criteria. |
| `@shapeshift-labs/frontier-codec` | GA | Encoded patch/history artifacts, byte-size evidence, content-address references. |
| `@shapeshift-labs/frontier-engine` | GA | Planned diff/profile evidence and schema-patcher gate context. |
| `@shapeshift-labs/frontier-state` | GA | App-state commits, maintained views, subscriptions, and path-map checkpoints. |
| `@shapeshift-labs/frontier-state-cache` | GA | Query/entity watcher evidence, optimistic layers, persistence/change-log gates. |
| `@shapeshift-labs/frontier-state-cache-idb` | GA | Browser persistence evidence and IndexedDB durability gates. |
| `@shapeshift-labs/frontier-state-cache-file` | GA | Node file persistence evidence and structured snapshot artifacts. |
| `@shapeshift-labs/frontier-state-cache-sql` | GA | SQL executor/persistence evidence without database-driver ownership. |
| `@shapeshift-labs/frontier-schema` | GA | Manifest schema contracts, JSON Schema validation, CloudEvent/query helpers. |
| `@shapeshift-labs/frontier-event-log` | GA | Replay cursors, compaction, checkpoints, patch event records. |
| `@shapeshift-labs/frontier-scheduler` | Incubation | Work graph, lane, backpressure, cancellation, and replay evidence. |
| `@shapeshift-labs/frontier-logging` | GA | Feature-run log records, spans, redaction, sinks, benchmark traces. |
| `@shapeshift-labs/frontier-mutation` | GA | Action/mutation plans, selector plans, action registry provenance. |
| `@shapeshift-labs/frontier-virtual` | Incubation | Range materialization, viewport, grid, and culling evidence. |
| `@shapeshift-labs/frontier-scene` | Incubation | Scene graph, transforms, bounds, camera/frustum evidence. |
| `@shapeshift-labs/frontier-pathfinding` | Incubation | Path-job, dirty-cell, flow-field, and navigation evidence. |
| `@shapeshift-labs/frontier-dom` | Incubation | Devtools traces, DOM writes, dirty bindings, hydration, action provenance. |
| `@shapeshift-labs/frontier-playwright` | Incubation | AI sessions, timeline reports, JSONL export, browser evidence, log-record bridge. |
| `@shapeshift-labs/frontier-crdt` | Beta | CRDT document heads/state vectors, branches, awareness, undo/version evidence. |
| `@shapeshift-labs/frontier-crdt-sync` | Beta | Provider/repo/storage protocol evidence, model checking, forensics, text binding. |
| `@shapeshift-labs/frontier-crdt-websocket` | Beta | WebSocket transport evidence above sync message contracts. |
| `@shapeshift-labs/frontier-react` | Beta | React external-store hook/adaptor evidence as host/UI metadata. |
| `@shapeshift-labs/frontier-richtext` | Hold | Local rich-text Delta/range/cursor evidence, clearly marked hold/redesign. |
| `@shapeshift-labs/frontier-realtime` | Incubation | Command, tick, snapshot, prediction, reconciliation, rollback evidence. |
| `@shapeshift-labs/frontier-realtime-server` | Incubation | Room/session/rate-limit/snapshot-history evidence. |
| `@shapeshift-labs/frontier-realtime-websocket` | Incubation | Realtime WebSocket transport evidence. |
| `@shapeshift-labs/frontier-game` | Incubation | Game entity/component/world/spatial/replication/rollback evidence. |

## Evidence Kit Review

`@shapeshift-labs/evidence-kit` provides:

- `inspect`, `init`, `add-fuzzer`, `add-benchmark`, `add-source-fetcher`
- benchmark scope, startup checks, package-boundary gates, perf docs/search
- repeatable research fetchers and manifests
- skills for bootstrap, target evidence design, fuzzing, benchmarks, source passes, perf wiki, and package boundaries

Frontier Agent Kit deliberately reuses that flow instead of copying it. The new package adds feature-run data structures and Frontier-specific adapters that Evidence Kit can index through notes and benchmark JSON.

## Deferred

- Direct imports from Frontier optional packages in root.
- A hosted UI. The first package version exposes data and CLI primitives; a visual inspector can be added later as a separate app or subpath.
- Cross-version codec compatibility. Feature evidence records should describe the current run and package versions, not decode old Frontier wire formats.

