import { createEvidenceEvent, createStableId } from './index.js';
import type { EvidenceEvent, JsonObject, JsonValue } from './types.js';

export interface FrontierDomDevtoolsSnapshotLike {
  readonly kind?: string;
  readonly version?: number;
  readonly generatedAt?: number;
  readonly trace?: readonly FrontierDomTraceEventLike[];
  readonly patchStream?: readonly unknown[];
  readonly dirtyBindings?: readonly unknown[];
  readonly domWrites?: readonly unknown[];
  readonly virtualRanges?: readonly unknown[];
  readonly actionProvenance?: readonly unknown[];
  readonly hydration?: { readonly issues?: readonly unknown[] };
  readonly summary?: Record<string, unknown>;
}

export interface FrontierDomTraceEventLike {
  readonly kind?: string;
  readonly bindingId?: number;
  readonly bindingKind?: string;
  readonly path?: readonly (string | number)[];
  readonly paths?: readonly (readonly (string | number)[])[];
  readonly patchItems?: number;
  readonly [key: string]: unknown;
}

export interface DomDevtoolsEvidenceOptions {
  readonly stepId?: string;
  readonly includeTrace?: boolean;
  readonly time?: number;
}

export interface DomDevtoolsSummary {
  readonly traceCount: number;
  readonly patchCount: number;
  readonly dirtyBindingCount: number;
  readonly domWriteCount: number;
  readonly virtualRangeCount: number;
  readonly actionCount: number;
  readonly hydrationIssueCount: number;
  readonly eventKinds: JsonObject;
}

export function summarizeDomDevtoolsSnapshot(snapshot: FrontierDomDevtoolsSnapshotLike): DomDevtoolsSummary {
  const eventKinds: JsonObject = {};
  for (const event of snapshot.trace ?? []) {
    const kind = String(event.kind ?? 'unknown');
    eventKinds[kind] = Number(eventKinds[kind] ?? 0) + 1;
  }
  return {
    traceCount: snapshot.trace?.length ?? 0,
    patchCount: snapshot.patchStream?.length ?? countTraceKind(snapshot, 'patch'),
    dirtyBindingCount: snapshot.dirtyBindings?.length ?? countTraceKind(snapshot, 'binding-dirty'),
    domWriteCount: snapshot.domWrites?.length ?? countTraceKind(snapshot, 'dom-write'),
    virtualRangeCount: snapshot.virtualRanges?.length ?? countTraceKind(snapshot, 'virtual-range'),
    actionCount: snapshot.actionProvenance?.length ?? countTraceKind(snapshot, 'action'),
    hydrationIssueCount: snapshot.hydration?.issues?.length ?? 0,
    eventKinds
  };
}

export function domDevtoolsSnapshotToEvidence(
  snapshot: FrontierDomDevtoolsSnapshotLike,
  options: DomDevtoolsEvidenceOptions = {}
): EvidenceEvent {
  const summary = summarizeDomDevtoolsSnapshot(snapshot);
  const data: JsonObject = {
    summary: summary as unknown as JsonValue
  };
  if (options.includeTrace === true && snapshot.trace) data.trace = snapshot.trace as unknown as JsonValue;
  return createEvidenceEvent({
    id: createStableId('ev', 'dom.devtools', snapshot.generatedAt ?? Date.now()),
    kind: 'frontier.dom.devtools',
    source: 'dom',
    package: '@shapeshift-labs/frontier-dom',
    severity: summary.hydrationIssueCount > 0 ? 'warn' : 'info',
    summary: `${summary.traceCount} DOM trace events, ${summary.domWriteCount} DOM writes`,
    data,
    ...(options.stepId ? { stepId: options.stepId } : {}),
    ...(options.time ?? snapshot.generatedAt ? { time: options.time ?? snapshot.generatedAt } : {})
  });
}

function countTraceKind(snapshot: FrontierDomDevtoolsSnapshotLike, kind: string): number {
  let count = 0;
  for (const event of snapshot.trace ?? []) {
    if (event.kind === kind) count++;
  }
  return count;
}
