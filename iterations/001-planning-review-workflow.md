---
date: 2026-05-29
kind: iteration
area: frontier-agent-kit
tags: [iteration, workflow, review, planning, reporting, benchmark, package-boundary]
verdict: accepted
decision: Added a coherent plan/run/review workflow over the lower-level feature-run ledger, plus CLI commands and benchmark coverage for reviewer-facing reports.
artifacts:
  source: src/index.ts, src/node.ts, src/types.ts
  tests: test/smoke.mjs, test/types.ts
  fuzzers: test/fuzz/agent-kit-fuzz.mjs
  benchmarks: benchmarks/agent-kit-benchmark.mjs, benchmarks/results/agent-kit-latest.json, benchmarks/results/startup-import-latest.json, benchmarks/results/package-boundary-gates-latest.json
---

# Planning And Review Workflow

## Goal

Make Frontier Agent Kit feel like a coherent feature-work project rather than a set of low-level record helpers.

## Implemented

- `planFeatureRun()` creates an agent-facing plan from a feature manifest.
- `reviewFeatureRun()` creates a human-facing review with findings and next actions.
- `featureRunReviewToMarkdown()` and `featureRunToMarkdownReport()` produce reviewable Markdown artifacts.
- `iterateFeatureRunJsonlRecords()` exposes a lower-allocation JSONL record iterator.
- CLI commands now support `plan`, `validate-manifest`, `review`, `report`, and `export-jsonl`.
- Tests and fuzzers cover planning, review findings, report generation, and JSONL iterator record counts.

## Current Benchmark Rows

Focused local rows on Node v26.1.0:

- `plan-feature-run-1000`: 661.29 us median, 1005.96 us p95
- `review-run-1000-events`: 2164.83 us median, 2526.54 us p95
- `markdown-report-1000-events`: 2219.08 us median, 2449.46 us p95
- `jsonl-record-iterator-1000-events`: 2164.92 us median, 2691.79 us p95

## Decision

Keep planning and review in the root import because they are pure JSON helpers and do not add optional Frontier runtime dependencies. Node filesystem and CLI behavior remains isolated under `./node`.

## Deferred

- A browser UI for the report.
- Direct storage adapters for run persistence.
- Rich acceptance assertion evaluation against live state; current review checks evidence presence and gate completeness.

