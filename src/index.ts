import {
  FRONTIER_PACKAGE_SURFACES,
  getFrontierPackageSurface,
  listFrontierPackageSurfaces,
  normalizeFrontierPackageName
} from './package-map.js';
import type {
  EvidenceEvent,
  EvidenceEventInput,
  FeatureAcceptanceCriterion,
  FeatureCheckpoint,
  FeatureGate,
  FeatureManifest,
  FeaturePackageRef,
  FeatureRun,
  FeatureRunAcceptanceResult,
  FeatureRunContext,
  FeatureRunIndex,
  FeatureRunJsonlRecord,
  FeatureRunPlan,
  FeatureRunPlanStep,
  FeatureRunProof,
  FeatureRunReview,
  FeatureRunReviewFinding,
  FeatureRunStatus,
  FeatureRunSummary,
  FeatureStep,
  FeatureStepInput,
  FeatureStepStatus,
  FrontierAgentPath,
  GateResult,
  JsonObject,
  JsonValue,
  RedactionPolicy
} from './types.js';

export * from './types.js';
export {
  FRONTIER_PACKAGE_SURFACES,
  getFrontierPackageSurface,
  listFrontierPackageSurfaces,
  normalizeFrontierPackageName
} from './package-map.js';

export interface FeatureRunOptions extends FeatureRunContext {
  readonly now?: () => number;
}

export interface ValidateFeatureManifestResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface FeatureRunQuery {
  readonly kind?: string;
  readonly source?: string;
  readonly stepId?: string;
  readonly package?: string;
  readonly severity?: string;
  readonly since?: number;
  readonly until?: number;
}

const DEFAULT_REDACT_VALUE = '[redacted]';
const DECLARED_PATH_PREFIX_MATCH_DEPTH = 2;

export function createFeatureRun(manifest: FeatureManifest, options: FeatureRunOptions = {}): FeatureRun {
  const validation = validateFeatureManifest(manifest);
  if (!validation.ok) throw new Error('invalid feature manifest: ' + validation.errors.join('; '));
  const now = options.now?.() ?? options.startedAt ?? Date.now();
  const base = {
    kind: 'frontier.agent.feature-run' as const,
    version: 1 as const,
    id: options.runId ?? createStableId('run', manifest.id, now),
    manifest: normalizeFeatureManifest(manifest),
    status: 'planned' as const,
    startedAt: now,
    steps: [],
    evidence: [],
    checkpoints: [],
    gates: [],
    summary: emptySummary('planned')
  };
  const run: FeatureRun = {
    ...base,
    ...(options.actor ? { actor: options.actor } : {}),
    ...(options.traceId ? { traceId: options.traceId } : {}),
    ...(options.branch ? { branch: options.branch } : {}),
    ...(options.commit ? { commit: options.commit } : {}),
    ...(options.workspace ? { workspace: options.workspace } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {})
  };
  return withSummary(run);
}

export function validateFeatureManifest(manifest: FeatureManifest): ValidateFeatureManifestResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!manifest || typeof manifest !== 'object') errors.push('manifest must be an object');
  if (!manifest.id || typeof manifest.id !== 'string') errors.push('manifest.id is required');
  if (!manifest.title || typeof manifest.title !== 'string') errors.push('manifest.title is required');
  for (const pkg of manifest.packages ?? []) {
    if (!pkg.name) errors.push('package reference is missing name');
    if (pkg.name.startsWith('@shapeshift-labs/frontier') && !getFrontierPackageSurface(pkg.name)) {
      warnings.push('unknown Frontier package reference: ' + pkg.name);
    }
  }
  for (const gate of manifest.gates ?? []) {
    if (!gate.id) errors.push('gate is missing id');
    if (!gate.command) errors.push('gate ' + (gate.id || '(unknown)') + ' is missing command');
  }
  for (const criterion of manifest.acceptance ?? []) {
    if (!criterion.id) errors.push('acceptance criterion is missing id');
    if (!criterion.source) errors.push('acceptance criterion ' + (criterion.id || '(unknown)') + ' is missing source');
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function startFeatureRun(run: FeatureRun, now: number = Date.now()): FeatureRun {
  if (run.status !== 'planned') return run;
  return withSummary({ ...run, status: 'running', startedAt: run.startedAt || now });
}

export function finishFeatureRun(run: FeatureRun, status?: FeatureRunStatus, now: number = Date.now()): FeatureRun {
  const nextStatus = status ?? assessFeatureRun(run);
  return withSummary({ ...run, status: nextStatus, endedAt: now });
}

export function recordFeatureStep(run: FeatureRun, input: FeatureStepInput, now: number = Date.now()): FeatureRun {
  const stepId = input.id ?? createStableId('step', input.title, now, run.steps.length);
  const evidence = (input.evidence ?? []).map((event, index) => createEvidenceEvent({
    ...event,
    stepId: event.stepId ?? stepId,
    id: event.id ?? createStableId('ev', stepId, now, index)
  }, now + index));
  const step: FeatureStep = {
    id: stepId,
    title: input.title,
    status: input.status ?? inferStepStatus(input),
    startedAt: input.startedAt ?? now,
    ...(input.endedAt ? { endedAt: input.endedAt } : {}),
    ...(input.actor ? { actor: input.actor } : {}),
    toolCalls: [...(input.toolCalls ?? [])],
    reads: (input.reads ?? []).map(pathToString),
    writes: (input.writes ?? []).map(pathToString),
    packages: (input.packages ?? []).map(normalizePackageRef),
    ...(input.notes ? { notes: input.notes } : {}),
    evidenceIds: evidence.map((event) => event.id),
    ...(input.metadata ? { metadata: input.metadata } : {})
  };
  return withSummary({
    ...run,
    status: run.status === 'planned' ? 'running' : run.status,
    steps: [...run.steps, step],
    evidence: [...run.evidence, ...evidence]
  });
}

export function recordEvidence(run: FeatureRun, input: EvidenceEventInput, now: number = Date.now()): FeatureRun {
  const event = createEvidenceEvent(input, now);
  return withSummary({
    ...run,
    status: run.status === 'planned' ? 'running' : run.status,
    evidence: [...run.evidence, event]
  });
}

export function createEvidenceEvent(input: EvidenceEventInput, now: number = Date.now()): EvidenceEvent {
  return {
    id: input.id ?? createStableId('ev', input.kind, input.source ?? '', now),
    kind: input.kind,
    ...(input.source ? { source: input.source } : {}),
    severity: input.severity ?? 'info',
    time: input.time ?? now,
    ...(input.stepId ? { stepId: input.stepId } : {}),
    ...(input.package ? { package: normalizeFrontierPackageName(input.package) } : {}),
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.data !== undefined ? { data: input.data } : {}),
    refs: [...(input.refs ?? [])],
    ...(input.metadata ? { metadata: input.metadata } : {})
  };
}

export function recordCheckpoint(run: FeatureRun, checkpoint: Omit<FeatureCheckpoint, 'id' | 'time'> & {
  readonly id?: string;
  readonly time?: number;
}, now: number = Date.now()): FeatureRun {
  const value: FeatureCheckpoint = {
    id: checkpoint.id ?? createStableId('checkpoint', checkpoint.label, now, run.checkpoints.length),
    label: checkpoint.label,
    time: checkpoint.time ?? now,
    ...(checkpoint.stepId ? { stepId: checkpoint.stepId } : {}),
    ...(checkpoint.basis !== undefined ? { basis: checkpoint.basis } : {}),
    ...(checkpoint.heads ? { heads: [...checkpoint.heads] } : {}),
    ...(checkpoint.stateVector ? { stateVector: { ...checkpoint.stateVector } } : {}),
    ...(checkpoint.patchCount !== undefined ? { patchCount: checkpoint.patchCount } : {}),
    ...(checkpoint.data !== undefined ? { data: checkpoint.data } : {}),
    ...(checkpoint.metadata ? { metadata: checkpoint.metadata } : {})
  };
  return withSummary({ ...run, checkpoints: [...run.checkpoints, value] });
}

export function recordGateResult(run: FeatureRun, result: GateResult): FeatureRun {
  return withSummary({ ...run, gates: [...run.gates, normalizeGateResult(run.manifest.gates ?? [], result)] });
}

export function assessFeatureRun(run: FeatureRun): FeatureRunStatus {
  const summary = summarizeFeatureRun(run);
  if (summary.requiredGateFailureCount > 0) return 'failed';
  if (run.steps.some((step) => step.status === 'blocked')) return 'blocked';
  if (run.steps.some((step) => step.status === 'failed')) return 'failed';
  if (run.evidence.some((event) => event.severity === 'fatal' || event.severity === 'error')) return 'needs-review';
  const acceptance = evaluateFeatureRunAcceptance(run);
  if (acceptance.some((result) => result.required && result.status === 'failed')) return 'failed';
  if (acceptance.some((result) => result.required && (result.status === 'missing' || result.status === 'unknown'))) {
    return 'needs-review';
  }
  const requiredGates = (run.manifest.gates ?? []).filter((gate) => gate.required !== false);
  if (requiredGates.length > 0) {
    const passedRequired = new Set(run.gates.filter((gate) => gate.required && gate.status === 'passed').map((gate) => gate.id));
    if (requiredGates.some((gate) => !passedRequired.has(gate.id))) return 'needs-review';
  }
  return 'passed';
}

export function planFeatureRun(manifest: FeatureManifest, now: number = Date.now()): FeatureRunPlan {
  const validation = validateFeatureManifest(manifest);
  const normalized = normalizeFeatureManifest(manifest);
  const packages = (normalized.packages ?? []).map((pkg) => pkg.name).sort();
  const declaredReads = [
    ...(normalized.state ?? []).map((state) => pathToString(state.path)),
    ...(normalized.queries ?? []).flatMap((query) => query.selector ? [pathToString(query.selector)] : [])
  ];
  const declaredWrites = [
    ...(normalized.actions ?? []).flatMap((action) => action.writes ?? []).map(pathToString),
    ...(normalized.state ?? []).map((state) => pathToString(state.path))
  ];
  const requiredEvidenceKinds = requiredEvidenceKindsForManifest(normalized);
  const steps: FeatureRunPlanStep[] = [
    {
      id: 'inspect-manifest',
      kind: 'inspect',
      title: 'Inspect feature manifest and package boundaries',
      required: true,
      reads: declaredReads,
      writes: [],
      description: 'Confirm packages, state/query/action/UI surfaces, acceptance criteria, and gates before editing.'
    },
    {
      id: 'baseline-checkpoint',
      kind: 'checkpoint',
      title: 'Capture baseline state and visible evidence',
      required: true,
      evidenceKind: 'frontier.checkpoint',
      reads: declaredReads,
      writes: []
    },
    {
      id: 'implement-feature',
      kind: 'implement',
      title: 'Apply feature change through declared Frontier surfaces',
      required: true,
      reads: declaredReads,
      writes: declaredWrites
    },
    ...requiredEvidenceKinds.map((kind) => ({
      id: 'observe-' + kind.replace(/[^a-z0-9]+/gi, '-'),
      kind: 'observe' as const,
      title: 'Capture ' + kind + ' evidence',
      required: true,
      evidenceKind: kind,
      reads: declaredReads,
      writes: []
    })),
    ...(normalized.gates ?? []).map((gate) => ({
      id: 'gate-' + gate.id,
      kind: 'gate' as const,
      title: 'Run ' + gate.id,
      required: gate.required !== false,
      command: gate.command,
      reads: [],
      writes: [],
      ...(gate.package ? { package: gate.package } : {}),
      ...(gate.description ? { description: gate.description } : {})
    })),
    {
      id: 'review-run',
      kind: 'review',
      title: 'Review run evidence and gate results',
      required: true,
      reads: declaredReads,
      writes: []
    }
  ];
  return {
    kind: 'frontier.agent.feature-plan',
    version: 1,
    featureId: normalized.id,
    title: normalized.title,
    generatedAt: now,
    packages,
    steps,
    gates: [...(normalized.gates ?? [])],
    requiredEvidenceKinds,
    warnings: validation.warnings
  };
}

export function indexFeatureRun(run: FeatureRun): FeatureRunIndex {
  const evidenceById: Record<string, EvidenceEvent> = {};
  const evidenceByKind: Record<string, string[]> = {};
  const evidenceBySource: Record<string, string[]> = {};
  const evidenceByPackage: Record<string, string[]> = {};
  const evidenceByStep: Record<string, string[]> = {};
  const gatesById: Record<string, GateResult> = {};
  const stepsById: Record<string, FeatureStep> = {};
  const declaredPackages = new Set<string>();
  const observedPackages = new Set<string>();
  const declaredPaths = new Set<string>();
  const touchedPaths = new Set<string>();

  for (const pkg of run.manifest.packages ?? []) declaredPackages.add(normalizePackageRef(pkg).name);
  for (const state of run.manifest.state ?? []) declaredPaths.add(pathToString(state.path));
  for (const query of run.manifest.queries ?? []) if (query.selector) declaredPaths.add(pathToString(query.selector));
  for (const action of run.manifest.actions ?? []) {
    for (const read of action.reads ?? []) declaredPaths.add(pathToString(read));
    for (const write of action.writes ?? []) declaredPaths.add(pathToString(write));
  }

  for (const step of run.steps) {
    stepsById[step.id] = step;
    for (const pkg of step.packages) observedPackages.add(normalizePackageRef(pkg).name);
    for (const path of step.reads) touchedPaths.add(path);
    for (const path of step.writes) touchedPaths.add(path);
  }
  for (const event of run.evidence) {
    evidenceById[event.id] = event;
    pushIndexed(evidenceByKind, event.kind, event.id);
    if (event.source) pushIndexed(evidenceBySource, event.source, event.id);
    if (event.package) {
      const pkg = normalizeFrontierPackageName(event.package);
      observedPackages.add(pkg);
      pushIndexed(evidenceByPackage, pkg, event.id);
    }
    if (event.stepId) pushIndexed(evidenceByStep, event.stepId, event.id);
  }
  for (const gate of run.gates) gatesById[gate.id] = gate;

  const latestCheckpoint = run.checkpoints.reduce<FeatureCheckpoint | undefined>((latest, checkpoint) => {
    if (!latest || checkpoint.time >= latest.time) return checkpoint;
    return latest;
  }, undefined);
  const packages = new Set([...declaredPackages, ...observedPackages]);
  const base: FeatureRunIndex = {
    evidenceById,
    evidenceByKind,
    evidenceBySource,
    evidenceByPackage,
    evidenceByStep,
    gatesById,
    stepsById,
    declaredPackages: [...declaredPackages].sort(),
    observedPackages: [...observedPackages].sort(),
    packages: [...packages].sort(),
    declaredPaths: [...declaredPaths].sort(),
    touchedPaths: [...touchedPaths].sort()
  };
  return latestCheckpoint ? { ...base, latestCheckpoint } : base;
}

export function evaluateFeatureRunAcceptance(run: FeatureRun): readonly FeatureRunAcceptanceResult[] {
  const index = indexFeatureRun(run);
  return (run.manifest.acceptance ?? []).map((criterion) => evaluateAcceptanceCriterion(run, index, criterion));
}

export function createFeatureRunProof(run: FeatureRun, now: number = Date.now()): FeatureRunProof {
  const index = indexFeatureRun(run);
  const review = reviewFeatureRun(run, now);
  const checkpointSummary = {
    count: run.checkpoints.length,
    ...(index.latestCheckpoint ? {
      latestId: index.latestCheckpoint.id,
      latestLabel: index.latestCheckpoint.label,
      latestTime: index.latestCheckpoint.time
    } : {})
  };
  return {
    kind: 'frontier.agent.feature-proof',
    version: 1,
    runId: run.id,
    featureId: run.manifest.id,
    generatedAt: now,
    status: run.status,
    ready: review.ready,
    summary: review.summary,
    acceptance: review.acceptance,
    gates: [...run.gates],
    evidence: {
      count: run.evidence.length,
      kinds: Object.keys(index.evidenceByKind).sort(),
      sources: Object.keys(index.evidenceBySource).sort(),
      packages: Object.keys(index.evidenceByPackage).sort()
    },
    checkpoints: checkpointSummary,
    findings: review.findings,
    nextActions: review.nextActions
  };
}

export function featureRunProofToMarkdown(proof: FeatureRunProof): string {
  const lines = [
    '# Frontier Feature Proof',
    '',
    '- Run: `' + proof.runId + '`',
    '- Feature: `' + proof.featureId + '`',
    '- Status: `' + proof.status + '`',
    '- Ready: `' + String(proof.ready) + '`',
    '- Evidence: `' + proof.evidence.count + '`',
    '- Checkpoints: `' + proof.checkpoints.count + '`',
    '- Gates: `' + proof.gates.length + '`',
    ''
  ];
  if (proof.acceptance.length > 0) {
    lines.push('## Acceptance', '');
    for (const result of proof.acceptance) {
      lines.push('- `' + result.status + '` `' + result.id + '` ' + result.message);
    }
  } else {
    lines.push('## Acceptance', '', 'No acceptance criteria declared.');
  }
  lines.push('', '## Evidence Kinds', '');
  if (proof.evidence.kinds.length > 0) {
    for (const kind of proof.evidence.kinds) lines.push('- `' + kind + '`');
  } else {
    lines.push('No evidence recorded.');
  }
  lines.push('', '## Gates', '');
  if (proof.gates.length > 0) {
    for (const gate of proof.gates) lines.push('- `' + gate.status + '` `' + gate.id + '` `' + gate.command + '`');
  } else {
    lines.push('No gates recorded.');
  }
  if (proof.findings.length > 0) {
    lines.push('', '## Findings', '');
    for (const item of proof.findings) lines.push('- `' + item.severity + '` `' + item.kind + '` ' + item.message);
  }
  if (proof.nextActions.length > 0) {
    lines.push('', '## Next Actions', '');
    for (const action of proof.nextActions) lines.push('- ' + action);
  }
  return lines.join('\n') + '\n';
}

export function reviewFeatureRun(run: FeatureRun, now: number = Date.now()): FeatureRunReview {
  const findings: FeatureRunReviewFinding[] = [];
  const index = indexFeatureRun(run);
  const acceptance = (run.manifest.acceptance ?? []).map((criterion) => evaluateAcceptanceCriterion(run, index, criterion));
  const validation = validateFeatureManifest(run.manifest);
  for (const error of validation.errors) findings.push(finding('manifest', 'error', error));
  for (const warning of validation.warnings) findings.push(finding('manifest', 'warning', warning));

  const declaredPackages = new Set(index.declaredPackages);
  for (const pkg of index.observedPackages) {
    if (declaredPackages.size > 0 && !declaredPackages.has(pkg)) {
      findings.push(finding('package', 'warning', 'Observed undeclared package ' + pkg, { package: pkg }));
    }
  }

  const declaredPaths = new Set(index.declaredPaths);
  for (const step of run.steps) {
    for (const write of step.writes) {
      if (declaredPaths.size > 0 && !pathMatchesDeclared(write, declaredPaths)) {
        findings.push(finding('path', 'warning', 'Step writes undeclared path ' + write, { stepId: step.id, path: write }));
      }
    }
    if (step.status === 'failed') findings.push(finding('status', 'error', 'Step failed: ' + step.title, { stepId: step.id }));
    if (step.status === 'blocked') findings.push(finding('status', 'warning', 'Step blocked: ' + step.title, { stepId: step.id }));
    if (step.status === 'running') findings.push(finding('status', 'warning', 'Step is still running: ' + step.title, { stepId: step.id }));
  }

  for (const kind of requiredEvidenceKindsForManifest(run.manifest)) {
    if (!index.evidenceByKind[kind]) findings.push(finding('evidence', 'warning', 'Missing expected evidence kind ' + kind));
  }

  for (const result of acceptance) {
    if (!result.required && result.status !== 'failed') continue;
    if (result.status === 'passed') continue;
    const severity = result.required ? 'error' : 'warning';
    findings.push(finding('acceptance', severity, 'Acceptance criterion ' + result.id + ' is ' + result.status + ': ' + result.message, {
      ...(result.gateId ? { gateId: result.gateId } : {})
    }));
    if (result.status === 'missing') {
      findings.push(finding('evidence', severity, 'No evidence found for acceptance criterion ' + result.id));
    }
  }

  for (const gate of run.manifest.gates ?? []) {
    if (gate.required === false) continue;
    const result = index.gatesById[gate.id];
    if (!result) {
      findings.push(finding('gate', 'error', 'Missing required gate result ' + gate.id, { gateId: gate.id }));
    } else if (result.status !== 'passed') {
      findings.push(finding('gate', 'error', 'Required gate did not pass: ' + gate.id, { gateId: gate.id }));
    }
  }
  for (const result of run.gates) {
    if (result.status === 'failed' || result.status === 'missing') {
      findings.push(finding('gate', result.required ? 'error' : 'warning', 'Gate ' + result.id + ' status is ' + result.status, { gateId: result.id }));
    }
  }

  if (run.status === 'running') findings.push(finding('status', 'warning', 'Run has not been finished'));
  const summary = summarizeFeatureRun(run);
  const ready = findings.every((item) => item.severity !== 'error') && (run.status === 'passed' || run.status === 'needs-review');
  return {
    kind: 'frontier.agent.review',
    version: 1,
    runId: run.id,
    featureId: run.manifest.id,
    status: run.status,
    ready,
    generatedAt: now,
    summary,
    acceptance,
    findings,
    nextActions: nextActionsForFindings(findings, run)
  };
}

export function featureRunReviewToMarkdown(review: FeatureRunReview): string {
  const lines = [
    '# Feature Run Review',
    '',
    '- Run: `' + review.runId + '`',
    '- Feature: `' + review.featureId + '`',
    '- Status: `' + review.status + '`',
    '- Ready: `' + String(review.ready) + '`',
    '- Steps: `' + review.summary.stepCount + '`',
    '- Evidence: `' + review.summary.evidenceCount + '`',
    '- Gates: `' + review.summary.gateCount + '`',
    ''
  ];
  if (review.findings.length === 0) {
    lines.push('## Findings', '', 'No findings.');
  } else {
    lines.push('## Findings', '');
    for (const item of review.findings) {
      lines.push('- `' + item.severity + '` `' + item.kind + '` ' + item.message);
    }
  }
  if (review.acceptance.length > 0) {
    lines.push('', '## Acceptance', '');
    for (const result of review.acceptance) {
      lines.push('- `' + result.status + '` `' + result.id + '` ' + result.message);
    }
  }
  if (review.nextActions.length > 0) {
    lines.push('', '## Next Actions', '');
    for (const action of review.nextActions) lines.push('- ' + action);
  }
  return lines.join('\n') + '\n';
}

export function featureRunToMarkdownReport(run: FeatureRun): string {
  const review = reviewFeatureRun(run);
  const lines = [
    '# Frontier Feature Run',
    '',
    '- Run: `' + run.id + '`',
    '- Feature: `' + run.manifest.id + '`',
    '- Title: ' + run.manifest.title,
    '- Status: `' + run.status + '`',
    '- Started: `' + new Date(run.startedAt).toISOString() + '`',
    ...(run.endedAt ? ['- Ended: `' + new Date(run.endedAt).toISOString() + '`'] : []),
    '',
    '## Packages',
    '',
    ...(run.summary.packages.length ? run.summary.packages.map((pkg) => '- `' + pkg + '`') : ['No packages recorded.']),
    '',
    '## Steps',
    '',
    ...(run.steps.length ? run.steps.map((step) => '- `' + step.status + '` `' + step.id + '` ' + step.title) : ['No steps recorded.']),
    '',
    '## Evidence',
    '',
    ...(run.evidence.length ? run.evidence.map((event) => '- `' + event.severity + '` `' + event.kind + '` ' + (event.summary ?? event.id)) : ['No evidence recorded.']),
    '',
    '## Gates',
    '',
    ...(run.gates.length ? run.gates.map((gate) => '- `' + gate.status + '` `' + gate.id + '` `' + gate.command + '`') : ['No gates recorded.']),
    '',
    featureRunReviewToMarkdown(review).trim()
  ];
  return lines.join('\n') + '\n';
}

export function summarizeFeatureRun(run: FeatureRun): FeatureRunSummary {
  const packageSet = new Set<string>();
  const pathSet = new Set<string>();
  const warnings: string[] = [];
  for (const pkg of run.manifest.packages ?? []) packageSet.add(normalizePackageRef(pkg).name);
  for (const step of run.steps) {
    for (const pkg of step.packages) packageSet.add(normalizePackageRef(pkg).name);
    for (const path of step.reads) pathSet.add(path);
    for (const path of step.writes) pathSet.add(path);
  }
  for (const state of run.manifest.state ?? []) pathSet.add(pathToString(state.path));
  for (const event of run.evidence) {
    if (event.package) packageSet.add(normalizeFrontierPackageName(event.package));
    if (event.severity === 'warn') warnings.push(event.summary ?? event.kind);
  }
  const failedGates = run.gates.filter((gate) => gate.status === 'failed' || gate.status === 'missing');
  return {
    status: run.status,
    stepCount: run.steps.length,
    evidenceCount: run.evidence.length,
    checkpointCount: run.checkpoints.length,
    gateCount: run.gates.length,
    failedGateCount: failedGates.length,
    requiredGateFailureCount: failedGates.filter((gate) => gate.required).length,
    packages: [...packageSet].sort(),
    touchedPaths: [...pathSet].sort(),
    warnings
  };
}

export function queryFeatureEvidence(run: FeatureRun, query: FeatureRunQuery): readonly EvidenceEvent[] {
  return run.evidence.filter((event) => {
    if (query.kind && event.kind !== query.kind) return false;
    if (query.source && event.source !== query.source) return false;
    if (query.stepId && event.stepId !== query.stepId) return false;
    if (query.package && event.package !== normalizeFrontierPackageName(query.package)) return false;
    if (query.severity && event.severity !== query.severity) return false;
    if (query.since !== undefined && event.time < query.since) return false;
    if (query.until !== undefined && event.time > query.until) return false;
    return true;
  });
}

export function iterateFeatureRunJsonlRecords(run: FeatureRun): IterableIterator<FeatureRunJsonlRecord> {
  return featureRunJsonlRecordIterator(run);
}

export function featureRunToJsonl(run: FeatureRun): string {
  let out = '';
  for (const record of iterateFeatureRunJsonlRecords(run)) out += JSON.stringify(record) + '\n';
  return out;
}

export function featureRunFromJsonl(input: string): FeatureRun {
  const records = input.split(/\r?\n/g).filter(Boolean).map((line) => JSON.parse(line) as FeatureRunJsonlRecord);
  const header = records.find((record) => record.kind === 'frontier.agent.run');
  if (!header) throw new Error('feature run JSONL is missing run header');
  const base = header.value as unknown as FeatureRun;
  const run: FeatureRun = {
    ...base,
    steps: records.filter((record) => record.kind === 'frontier.agent.step').map((record) => record.value as unknown as FeatureStep),
    evidence: records.filter((record) => record.kind === 'frontier.agent.evidence').map((record) => record.value as unknown as EvidenceEvent),
    checkpoints: records.filter((record) => record.kind === 'frontier.agent.checkpoint').map((record) => record.value as unknown as FeatureCheckpoint),
    gates: records.filter((record) => record.kind === 'frontier.agent.gate').map((record) => record.value as unknown as GateResult)
  };
  return withSummary(run);
}

export function redactFeatureRun(run: FeatureRun, policy: RedactionPolicy = {}): FeatureRun {
  return sanitizeValue(run as unknown as JsonValue, createRedactionState(policy), []) as unknown as FeatureRun;
}

export function pathToString(path: FrontierAgentPath): string {
  if (typeof path === 'string') return path;
  return '/' + path.map((segment) => String(segment).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
}

export function normalizePackageRef(ref: FeaturePackageRef): FeaturePackageRef {
  const surface = getFrontierPackageSurface(ref.name);
  const name = surface?.name ?? ref.name;
  const tier = ref.tier ?? surface?.tier;
  return {
    name,
    ...(ref.surface ? { surface: ref.surface } : {}),
    ...(ref.importPath ? { importPath: ref.importPath } : {}),
    ...(tier ? { tier } : {}),
    ...(ref.optional !== undefined ? { optional: ref.optional } : {}),
    ...(ref.purpose ? { purpose: ref.purpose } : {})
  };
}

export function createStableId(prefix: string, ...parts: readonly unknown[]): string {
  const text = parts.map((part) => {
    if (part === null || part === undefined) return '';
    if (typeof part === 'string' || typeof part === 'number' || typeof part === 'boolean') return String(part);
    return JSON.stringify(part);
  }).join(':');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return prefix + '-' + (hash >>> 0).toString(36);
}

function evaluateAcceptanceCriterion(
  run: FeatureRun,
  index: FeatureRunIndex,
  criterion: FeatureAcceptanceCriterion
): FeatureRunAcceptanceResult {
  if (criterion.source === 'state') return evaluateStateAcceptance(index, criterion);
  if (criterion.source === 'test') return evaluateGateAcceptance(run, index, criterion);
  if (criterion.source === 'custom') {
    const custom = evaluateCustomAcceptance(run, index, criterion);
    if (custom) return custom;
  }
  return evaluateEvidenceAcceptance(run, index, criterion);
}

function evaluateStateAcceptance(
  index: FeatureRunIndex,
  criterion: FeatureAcceptanceCriterion
): FeatureRunAcceptanceResult {
  if (!index.latestCheckpoint || index.latestCheckpoint.data === undefined) {
    return acceptanceResult(criterion, 'missing', 'No checkpoint data is available for state acceptance.');
  }
  const observed = criterion.query ? readJsonPath(index.latestCheckpoint.data, criterion.query) : index.latestCheckpoint.data;
  const match = matchAcceptanceValue(observed, criterion);
  return acceptanceResult(criterion, match.status, match.message, {
    ...(observed !== undefined ? { observed } : {}),
    checkpointId: index.latestCheckpoint.id
  });
}

function evaluateGateAcceptance(
  run: FeatureRun,
  index: FeatureRunIndex,
  criterion: FeatureAcceptanceCriterion
): FeatureRunAcceptanceResult {
  const gateId = acceptanceGateId(criterion);
  if (gateId) return acceptanceForGateStatus(index, criterion, gateId);

  const declaredTestGates = (run.manifest.gates ?? []).filter((gate) => gate.category === 'test' || /test/i.test(gate.id));
  const results: GateResult[] = [];
  for (const gate of declaredTestGates) {
    const result = index.gatesById[gate.id];
    if (result) results.push(result);
  }
  if (results.some((gate) => gate.status === 'passed')) {
    const gate = results.find((item) => item.status === 'passed') as GateResult;
    return acceptanceResult(criterion, 'passed', 'Test gate passed: ' + gate.id, {
      observed: gate.status,
      gateId: gate.id
    });
  }
  const failed = results.find((gate) => gate.status === 'failed' || gate.status === 'missing' || gate.status === 'skipped');
  if (failed) {
    return acceptanceResult(criterion, 'failed', 'Test gate did not pass: ' + failed.id + ' is ' + failed.status, {
      observed: failed.status,
      gateId: failed.id
    });
  }
  if (declaredTestGates.length > 0) {
    return acceptanceResult(criterion, 'missing', 'No recorded result for declared test gates.');
  }
  return evaluateEvidenceAcceptance(run, index, criterion);
}

function acceptanceForGateStatus(
  index: FeatureRunIndex,
  criterion: FeatureAcceptanceCriterion,
  gateId: string
): FeatureRunAcceptanceResult {
  const gate = index.gatesById[gateId];
  if (!gate) return acceptanceResult(criterion, 'missing', 'No recorded gate result for ' + gateId + '.', { gateId });
  if (gate.status === 'passed') {
    return acceptanceResult(criterion, 'passed', 'Gate passed: ' + gateId, { observed: gate.status, gateId });
  }
  return acceptanceResult(criterion, 'failed', 'Gate did not pass: ' + gateId + ' is ' + gate.status, {
    observed: gate.status,
    gateId
  });
}

function evaluateCustomAcceptance(
  run: FeatureRun,
  index: FeatureRunIndex,
  criterion: FeatureAcceptanceCriterion
): FeatureRunAcceptanceResult | undefined {
  const matcher = criterion.matcher?.trim();
  if (matcher === 'run.evidence.length > 0') {
    const status = run.evidence.length > 0 ? 'passed' : 'missing';
    return acceptanceResult(criterion, status, status === 'passed' ? 'Run has recorded evidence.' : 'Run has no recorded evidence.', {
      observed: run.evidence.length
    });
  }
  if (matcher === 'run.steps.length > 0') {
    const status = run.steps.length > 0 ? 'passed' : 'missing';
    return acceptanceResult(criterion, status, status === 'passed' ? 'Run has recorded steps.' : 'Run has no recorded steps.', {
      observed: run.steps.length
    });
  }
  if (matcher === 'run.checkpoints.length > 0') {
    const status = run.checkpoints.length > 0 ? 'passed' : 'missing';
    return acceptanceResult(criterion, status, status === 'passed' ? 'Run has recorded checkpoints.' : 'Run has no recorded checkpoints.', {
      observed: run.checkpoints.length
    });
  }
  if (matcher?.startsWith('gate:')) return acceptanceForGateStatus(index, criterion, matcher.slice('gate:'.length).trim());
  return undefined;
}

function evaluateEvidenceAcceptance(
  run: FeatureRun,
  index: FeatureRunIndex,
  criterion: FeatureAcceptanceCriterion
): FeatureRunAcceptanceResult {
  const matcher = criterion.matcher?.trim();
  if (matcher?.startsWith('evidence-kind:')) {
    const kind = matcher.slice('evidence-kind:'.length).trim();
    const ids = index.evidenceByKind[kind] ?? [];
    if (ids.length > 0) {
      return acceptanceResult(criterion, 'passed', 'Found evidence kind ' + kind + '.', { evidenceIds: ids });
    }
    return acceptanceResult(criterion, 'missing', 'Missing evidence kind ' + kind + '.');
  }

  const ids = relatedEvidenceIds(run, index, criterion);
  if (ids.length === 0) return acceptanceResult(criterion, 'missing', 'No related evidence was recorded.');
  if (!criterion.query && criterion.expected === undefined && !isValueMatcher(matcher)) {
    return acceptanceResult(criterion, 'passed', 'Related evidence was recorded.', { evidenceIds: ids });
  }

  let firstObserved: JsonValue | undefined;
  let sawValue = false;
  for (const id of ids) {
    const event = index.evidenceById[id];
    if (!event || event.data === undefined) continue;
    const observed = criterion.query ? readJsonPath(event.data, criterion.query) : event.data;
    if (observed === undefined) continue;
    if (!sawValue) firstObserved = observed;
    sawValue = true;
    const match = matchAcceptanceValue(observed, criterion);
    if (match.status === 'passed') {
      return acceptanceResult(criterion, 'passed', match.message, {
        observed,
        evidenceIds: ids
      });
    }
  }
  if (!sawValue) {
    return acceptanceResult(criterion, 'missing', 'Related evidence exists but does not contain the requested value.', {
      evidenceIds: ids
    });
  }
  const match = matchAcceptanceValue(firstObserved, criterion);
  return acceptanceResult(criterion, match.status, match.message, {
    ...(firstObserved !== undefined ? { observed: firstObserved } : {}),
    evidenceIds: ids
  });
}

function relatedEvidenceIds(
  run: FeatureRun,
  index: FeatureRunIndex,
  criterion: FeatureAcceptanceCriterion
): readonly string[] {
  const ids = new Set<string>();
  const source = criterion.source;
  for (const id of index.evidenceBySource[source] ?? []) ids.add(id);
  for (const [kind, kindIds] of Object.entries(index.evidenceByKind)) {
    if (kind.includes(source)) for (const id of kindIds) ids.add(id);
  }
  if (criterion.query && typeof criterion.query === 'string' && !criterion.query.startsWith('/')) {
    for (const id of index.evidenceByKind[criterion.query] ?? []) ids.add(id);
    for (const id of index.evidenceBySource[criterion.query] ?? []) ids.add(id);
  }
  if (source === 'benchmark') {
    for (const [kind, kindIds] of Object.entries(index.evidenceByKind)) {
      if (/bench|perf/i.test(kind)) for (const id of kindIds) ids.add(id);
    }
  }
  if (source === 'query') {
    for (const [kind, kindIds] of Object.entries(index.evidenceByKind)) {
      if (/query|selector|cache/i.test(kind)) for (const id of kindIds) ids.add(id);
    }
  }
  if (source === 'custom' && run.evidence.length > 0) {
    for (const event of run.evidence) ids.add(event.id);
  }
  return [...ids];
}

interface AcceptanceValueMatch {
  readonly status: FeatureRunAcceptanceResult['status'];
  readonly message: string;
}

function matchAcceptanceValue(observed: JsonValue | undefined, criterion: FeatureAcceptanceCriterion): AcceptanceValueMatch {
  const matcher = criterion.matcher?.trim();
  if (matcher === 'missing') {
    return observed === undefined
      ? { status: 'passed', message: 'Value is missing as expected.' }
      : { status: 'failed', message: 'Value exists but was expected to be missing.' };
  }
  if (observed === undefined) return { status: 'missing', message: 'Expected value was not observed.' };
  if (matcher === 'exists' || (!matcher && criterion.expected === undefined)) {
    return { status: 'passed', message: 'Value exists.' };
  }
  if (matcher === 'truthy') {
    return Boolean(observed)
      ? { status: 'passed', message: 'Value is truthy.' }
      : { status: 'failed', message: 'Value is not truthy.' };
  }
  if (matcher === 'falsy') {
    return !observed
      ? { status: 'passed', message: 'Value is falsy.' }
      : { status: 'failed', message: 'Value is not falsy.' };
  }
  if (matcher === 'not-equals') {
    if (criterion.expected === undefined) return { status: 'unknown', message: 'not-equals matcher requires expected.' };
    return jsonEqual(observed, criterion.expected)
      ? { status: 'failed', message: 'Observed value equals the disallowed expected value.' }
      : { status: 'passed', message: 'Observed value differs from expected.' };
  }
  if (matcher === 'includes' || matcher?.startsWith('includes:')) {
    const expected = matcher.startsWith('includes:')
      ? parseMatcherValue(matcher.slice('includes:'.length))
      : criterion.expected;
    if (expected === undefined) return { status: 'unknown', message: 'includes matcher requires expected.' };
    return jsonIncludes(observed, expected)
      ? { status: 'passed', message: 'Observed value includes expected.' }
      : { status: 'failed', message: 'Observed value does not include expected.' };
  }
  if (matcher && matcher !== 'equals') return { status: 'unknown', message: 'Unsupported matcher: ' + matcher };
  if (criterion.expected === undefined) return { status: 'unknown', message: 'No expected value or matcher was provided.' };
  return jsonEqual(observed, criterion.expected)
    ? { status: 'passed', message: 'Observed value equals expected.' }
    : { status: 'failed', message: 'Observed value does not equal expected.' };
}

function isValueMatcher(matcher: string | undefined): boolean {
  return Boolean(matcher && (
    matcher === 'exists' ||
    matcher === 'missing' ||
    matcher === 'equals' ||
    matcher === 'not-equals' ||
    matcher === 'truthy' ||
    matcher === 'falsy' ||
    matcher === 'includes' ||
    matcher.startsWith('includes:')
  ));
}

function acceptanceGateId(criterion: FeatureAcceptanceCriterion): string | undefined {
  if (criterion.matcher?.startsWith('gate:')) return criterion.matcher.slice('gate:'.length).trim();
  if (typeof criterion.query === 'string' && criterion.query && !criterion.query.startsWith('/')) return criterion.query;
  return undefined;
}

function acceptanceResult(
  criterion: FeatureAcceptanceCriterion,
  status: FeatureRunAcceptanceResult['status'],
  message: string,
  extra: Omit<FeatureRunAcceptanceResult, 'id' | 'source' | 'required' | 'status' | 'message'> = {}
): FeatureRunAcceptanceResult {
  return {
    id: criterion.id,
    source: criterion.source,
    required: criterion.required !== false,
    status,
    message,
    ...(criterion.expected !== undefined ? { expected: criterion.expected } : {}),
    ...extra
  };
}

function pushIndexed(map: Record<string, string[]>, key: string, value: string): void {
  (map[key] ??= []).push(value);
}

function readJsonPath(value: JsonValue, path: FrontierAgentPath): JsonValue | undefined {
  let current: JsonValue | undefined = value;
  for (const segment of pathSegments(path)) {
    if (current === undefined || current === null || typeof current !== 'object') return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
    } else {
      current = current[segment];
    }
  }
  return current;
}

function pathSegments(path: FrontierAgentPath): readonly string[] {
  if (typeof path !== 'string') return path.map(String);
  if (path === '' || path === '/') return [];
  if (path.startsWith('/')) {
    return path.split('/').slice(1).map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  }
  return path.includes('.') ? path.split('.').filter(Boolean) : [path];
}

function parseMatcherValue(input: string): JsonValue {
  try {
    return JSON.parse(input) as JsonValue;
  } catch {
    return input;
  }
}

function jsonIncludes(value: JsonValue, expected: JsonValue): boolean {
  if (typeof value === 'string') return value.includes(String(expected));
  if (Array.isArray(value)) return value.some((item) => jsonEqual(item, expected));
  if (value && typeof value === 'object' && typeof expected === 'string') return Object.prototype.hasOwnProperty.call(value, expected);
  return false;
}

function jsonEqual(left: JsonValue, right: JsonValue): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => jsonEqual(item, right[index] as JsonValue));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index++) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];
    if (leftKey === undefined || rightKey === undefined || leftKey !== rightKey) return false;
    if (!jsonEqual(left[leftKey] as JsonValue, right[rightKey] as JsonValue)) return false;
  }
  return true;
}

function normalizeFeatureManifest(manifest: FeatureManifest): FeatureManifest {
  return {
    ...manifest,
    ...(manifest.packages ? { packages: manifest.packages.map(normalizePackageRef) } : {})
  };
}

function requiredEvidenceKindsForManifest(manifest: FeatureManifest): readonly string[] {
  const kinds = new Set<string>();
  for (const pkg of manifest.packages ?? []) {
    const name = normalizePackageRef(pkg).name;
    if (name === '@shapeshift-labs/frontier') kinds.add('frontier.patch.summary');
    if (name === '@shapeshift-labs/frontier-logging') kinds.add('frontier.agent.log-records');
    if (name === '@shapeshift-labs/frontier-playwright') kinds.add('frontier.playwright.report');
    if (name === '@shapeshift-labs/frontier-dom') kinds.add('frontier.dom.devtools');
    if (name.includes('crdt')) kinds.add('frontier.crdt.checkpoint');
    if (name.includes('state-cache')) kinds.add('frontier.cache.checkpoint');
  }
  for (const criterion of manifest.acceptance ?? []) {
    if (criterion.source === 'state') kinds.add('frontier.checkpoint');
    if (criterion.source === 'dom') kinds.add('frontier.dom.devtools');
    if (criterion.source === 'playwright') kinds.add('frontier.playwright.report');
    if (criterion.source === 'log') kinds.add('frontier.agent.log-records');
    if (criterion.source === 'benchmark') kinds.add('frontier.benchmark');
    if (criterion.source === 'test') kinds.add('frontier.gate');
  }
  return [...kinds].sort();
}

function finding(
  kind: FeatureRunReviewFinding['kind'],
  severity: FeatureRunReviewFinding['severity'],
  message: string,
  extra: Omit<FeatureRunReviewFinding, 'id' | 'kind' | 'severity' | 'message'> = {}
): FeatureRunReviewFinding {
  return {
    id: createStableId('finding', kind, severity, message, extra),
    kind,
    severity,
    message,
    ...extra
  };
}

function nextActionsForFindings(findings: readonly FeatureRunReviewFinding[], run: FeatureRun): readonly string[] {
  const actions = new Set<string>();
  for (const item of findings) {
    if (item.kind === 'gate') actions.add('Run or fix required gates, then record updated gate results.');
    if (item.kind === 'evidence') actions.add('Capture the missing evidence and attach it to the run.');
    if (item.kind === 'acceptance') actions.add('Record evidence or state checkpoints that satisfy required acceptance criteria.');
    if (item.kind === 'path') actions.add('Update the feature manifest or constrain writes to declared paths.');
    if (item.kind === 'package') actions.add('Declare observed packages in the feature manifest or remove unintended integration work.');
    if (item.kind === 'status') actions.add('Finish or repair incomplete/failed steps before handoff.');
    if (item.kind === 'manifest') actions.add('Fix manifest errors before using the run as review evidence.');
  }
  if (run.evidence.length === 0) actions.add('Attach at least one evidence event before review.');
  return [...actions];
}

function pathMatchesDeclared(path: string, declaredPaths: ReadonlySet<string>): boolean {
  if (declaredPaths.has(path)) return true;
  const pathParts = path.split('/').filter(Boolean);
  for (const declared of declaredPaths) {
    const declaredParts = declared.split('/').filter(Boolean);
    const depth = Math.min(DECLARED_PATH_PREFIX_MATCH_DEPTH, declaredParts.length, pathParts.length);
    let matches = depth > 0;
    for (let index = 0; index < depth; index++) {
      if (declaredParts[index] !== pathParts[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

function* featureRunJsonlRecordIterator(run: FeatureRun): IterableIterator<FeatureRunJsonlRecord> {
  yield { kind: 'frontier.agent.run', runId: run.id, value: stripRunCollections(run) as unknown as JsonValue };
  for (const value of run.steps) yield { kind: 'frontier.agent.step', runId: run.id, value: value as unknown as JsonValue };
  for (const value of run.evidence) yield { kind: 'frontier.agent.evidence', runId: run.id, value: value as unknown as JsonValue };
  for (const value of run.checkpoints) yield { kind: 'frontier.agent.checkpoint', runId: run.id, value: value as unknown as JsonValue };
  for (const value of run.gates) yield { kind: 'frontier.agent.gate', runId: run.id, value: value as unknown as JsonValue };
}

function withSummary(run: FeatureRun): FeatureRun {
  return { ...run, summary: summarizeFeatureRun(run) };
}

function emptySummary(status: FeatureRunStatus): FeatureRunSummary {
  return {
    status,
    stepCount: 0,
    evidenceCount: 0,
    checkpointCount: 0,
    gateCount: 0,
    failedGateCount: 0,
    requiredGateFailureCount: 0,
    packages: [],
    touchedPaths: [],
    warnings: []
  };
}

function inferStepStatus(input: FeatureStepInput): FeatureStepStatus {
  if (input.endedAt !== undefined) return 'passed';
  return 'running';
}

function normalizeGateResult(gates: readonly FeatureGate[], result: GateResult): GateResult {
  const gate = gates.find((candidate) => candidate.id === result.id);
  return {
    id: result.id,
    command: result.command || gate?.command || '',
    status: result.status,
    required: result.required,
    ...(result.durationMs !== undefined ? { durationMs: result.durationMs } : {}),
    ...(result.exitCode !== undefined ? { exitCode: result.exitCode } : {}),
    ...(result.output ? { output: result.output } : {}),
    ...(result.artifact ? { artifact: result.artifact } : {}),
    ...(result.metadata ? { metadata: result.metadata } : {})
  };
}

function stripRunCollections(run: FeatureRun): Omit<FeatureRun, 'steps' | 'evidence' | 'checkpoints' | 'gates'> {
  const { steps: _steps, evidence: _evidence, checkpoints: _checkpoints, gates: _gates, ...header } = run;
  void _steps;
  void _evidence;
  void _checkpoints;
  void _gates;
  return header;
}

interface RedactionState {
  readonly keys: readonly (string | RegExp)[];
  readonly paths: readonly (string | RegExp)[];
  readonly value: JsonValue;
  readonly maxStringLength: number;
  readonly maxDepth: number;
}

function createRedactionState(policy: RedactionPolicy): RedactionState {
  return {
    keys: policy.keys ?? [/token/i, /password/i, /secret/i, /authorization/i, /cookie/i],
    paths: policy.paths ?? [],
    value: policy.value ?? DEFAULT_REDACT_VALUE,
    maxStringLength: policy.maxStringLength ?? 512,
    maxDepth: policy.maxDepth ?? 12
  };
}

function sanitizeValue(value: JsonValue, policy: RedactionState, path: readonly string[], depth = 0): JsonValue {
  if (depth > policy.maxDepth) return '[max-depth]';
  if (typeof value === 'string') return value.length > policy.maxStringLength ? value.slice(0, policy.maxStringLength) + '...' : value;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item, index) => sanitizeValue(item, policy, [...path, String(index)], depth + 1));
  const out: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    if (matchesAny(key, policy.keys) || matchesAny(childPath.join('.'), policy.paths)) {
      out[key] = policy.value;
    } else {
      out[key] = sanitizeValue(child, policy, childPath, depth + 1);
    }
  }
  return out;
}

function matchesAny(value: string, matchers: readonly (string | RegExp)[]): boolean {
  return matchers.some((matcher) => typeof matcher === 'string' ? matcher === value : matcher.test(value));
}
