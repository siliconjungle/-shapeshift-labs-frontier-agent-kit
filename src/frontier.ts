import {
  createEvidenceEvent,
  createStableId,
  pathToString,
  recordEvidence
} from './index.js';
import type {
  EvidenceEvent,
  EvidenceEventInput,
  FeatureCheckpoint,
  FeatureRun,
  FrontierAgentPathSegment,
  JsonObject,
  JsonValue
} from './types.js';

export type FrontierPatchOperationLike = readonly unknown[];
export type FrontierPatchLike = readonly FrontierPatchOperationLike[];

export interface FrontierPatchSummary {
  readonly kind: 'frontier.patch.summary';
  readonly opCount: number;
  readonly byteLength: number;
  readonly operationTypes: JsonObject;
  readonly pathCount: number;
  readonly maxPathDepth: number;
  readonly pathSamples: readonly string[];
}

export interface FrontierStateSourceLike {
  get?(): unknown;
  toJSON?(): unknown;
  getBasis?(): number | string | undefined;
  getHeads?(): readonly string[] | undefined;
  getStateVector?(): Record<string, number> | undefined;
  getHydrationBasis?(): unknown;
}

export interface FrontierPatchEvidenceOptions {
  readonly id?: string;
  readonly stepId?: string;
  readonly source?: string;
  readonly package?: string;
  readonly summary?: string;
  readonly time?: number;
  readonly includePatch?: boolean;
  readonly metadata?: JsonObject;
}

export function summarizeFrontierPatch(patch: FrontierPatchLike): FrontierPatchSummary {
  const operationTypes: JsonObject = {};
  const samples: string[] = [];
  let pathCount = 0;
  let maxPathDepth = 0;
  for (const operation of patch) {
    const op = String(operation[0] ?? 'unknown');
    operationTypes[op] = Number(operationTypes[op] ?? 0) + 1;
    const path = operation[1];
    if (Array.isArray(path)) {
      pathCount++;
      maxPathDepth = Math.max(maxPathDepth, path.length);
      if (samples.length < 8) samples.push(pathToString(path as readonly FrontierAgentPathSegment[]));
    }
  }
  return {
    kind: 'frontier.patch.summary',
    opCount: patch.length,
    byteLength: encodedByteLength(patch),
    operationTypes,
    pathCount,
    maxPathDepth,
    pathSamples: samples
  };
}

export function createFrontierPatchEvidence(
  patch: FrontierPatchLike,
  options: FrontierPatchEvidenceOptions = {}
): EvidenceEvent {
  const summary = summarizeFrontierPatch(patch);
  const data: JsonObject = {
    summary: summary as unknown as JsonValue
  };
  if (options.includePatch === true) data.patch = patch as unknown as JsonValue;
  return createEvidenceEvent({
    kind: 'frontier.patch',
    source: options.source ?? 'frontier',
    package: options.package ?? '@shapeshift-labs/frontier',
    severity: 'info',
    summary: options.summary ?? `${summary.opCount} patch operations across ${summary.pathCount} paths`,
    data,
    ...(options.id ? { id: options.id } : {}),
    ...(options.stepId ? { stepId: options.stepId } : {}),
    ...(options.time !== undefined ? { time: options.time } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {})
  });
}

export function addFrontierPatchEvidence(
  run: FeatureRun,
  patch: FrontierPatchLike,
  options: FrontierPatchEvidenceOptions = {}
): FeatureRun {
  return recordEvidence(run, createFrontierPatchEvidence(patch, options));
}

export function createFrontierStateCheckpoint(
  label: string,
  source: FrontierStateSourceLike,
  options: {
    readonly id?: string;
    readonly stepId?: string;
    readonly time?: number;
    readonly includeSnapshot?: boolean;
    readonly metadata?: JsonObject;
  } = {}
): FeatureCheckpoint {
  const now = options.time ?? Date.now();
  const data = options.includeSnapshot === true ? readStateSnapshot(source) : undefined;
  const basis = source.getBasis?.();
  const heads = source.getHeads?.();
  const stateVector = source.getStateVector?.();
  return {
    id: options.id ?? createStableId('checkpoint', label, now),
    label,
    time: now,
    ...(options.stepId ? { stepId: options.stepId } : {}),
    ...(basis !== undefined ? { basis } : {}),
    ...(heads ? { heads } : {}),
    ...(stateVector ? { stateVector } : {}),
    ...(data !== undefined ? { data } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {})
  };
}

export function patchSummaryToEvidenceInput(
  summary: FrontierPatchSummary,
  options: Omit<FrontierPatchEvidenceOptions, 'includePatch'> = {}
): EvidenceEventInput {
  return {
    kind: 'frontier.patch.summary',
    source: options.source ?? 'frontier',
    package: options.package ?? '@shapeshift-labs/frontier',
    severity: 'info',
    summary: options.summary ?? `${summary.opCount} Frontier patch ops`,
    data: summary as unknown as JsonValue,
    ...(options.id ? { id: options.id } : {}),
    ...(options.stepId ? { stepId: options.stepId } : {}),
    ...(options.time !== undefined ? { time: options.time } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {})
  };
}

function readStateSnapshot(source: FrontierStateSourceLike): JsonValue | undefined {
  const raw = source.get?.() ?? source.toJSON?.();
  return sanitizeUnknown(raw);
}

function sanitizeUnknown(value: unknown): JsonValue | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeUnknown(item) ?? null);
  if (typeof value === 'object') {
    const out: JsonObject = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizeUnknown(child);
      if (sanitized !== undefined) out[key] = sanitized;
    }
    return out;
  }
  return String(value);
}

function encodedByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
