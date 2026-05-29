# 002 Acceptance Proof Index

## Goal

Make feature runs easier for agents and humans to inspect without repeatedly scanning the full run payload.

## Changes

- Added `indexFeatureRun` for evidence, step, gate, package, checkpoint, and path lookups.
- Added `evaluateFeatureRunAcceptance` for state checkpoints, gates, evidence kinds, and simple custom run predicates.
- Added `createFeatureRunProof` plus Markdown rendering as a compact handoff artifact.
- Added CLI `proof` output for JSON or Markdown review flows.
- Folded required acceptance failures into run assessment and review readiness.

## Boundary Notes

The new APIs live on the root JSON-only import and do not introduce optional Frontier runtime imports. Optional DOM, Playwright, logging, Frontier patch, Evidence Kit, and Node filesystem helpers remain behind their existing subpaths.
