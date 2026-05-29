import {
  FRONTIER_PACKAGE_SURFACES,
  getFrontierPackageSurface,
  listFrontierPackageSurfaces,
  normalizeFrontierPackageName
} from './package-map.js';
import type {
  EvidenceEvent,
  EvidenceEventInput,
  FeatureCheckpoint,
  FeatureGate,
  FeatureManifest,
  FeaturePackageRef,
  FeatureRun,
  FeatureRunContext,
  FeatureRunJsonlRecord,
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
  const requiredGates = (run.manifest.gates ?? []).filter((gate) => gate.required !== false);
  if (requiredGates.length > 0) {
    const passedRequired = new Set(run.gates.filter((gate) => gate.required && gate.status === 'passed').map((gate) => gate.id));
    if (requiredGates.some((gate) => !passedRequired.has(gate.id))) return 'needs-review';
  }
  return 'passed';
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

export function featureRunToJsonl(run: FeatureRun): string {
  const records: FeatureRunJsonlRecord[] = [
    { kind: 'frontier.agent.run', runId: run.id, value: stripRunCollections(run) as unknown as JsonValue },
    ...run.steps.map((value) => ({ kind: 'frontier.agent.step' as const, runId: run.id, value: value as unknown as JsonValue })),
    ...run.evidence.map((value) => ({ kind: 'frontier.agent.evidence' as const, runId: run.id, value: value as unknown as JsonValue })),
    ...run.checkpoints.map((value) => ({ kind: 'frontier.agent.checkpoint' as const, runId: run.id, value: value as unknown as JsonValue })),
    ...run.gates.map((value) => ({ kind: 'frontier.agent.gate' as const, runId: run.id, value: value as unknown as JsonValue }))
  ];
  return records.map((record) => JSON.stringify(record)).join('\n') + '\n';
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

function normalizeFeatureManifest(manifest: FeatureManifest): FeatureManifest {
  return {
    ...manifest,
    ...(manifest.packages ? { packages: manifest.packages.map(normalizePackageRef) } : {})
  };
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
