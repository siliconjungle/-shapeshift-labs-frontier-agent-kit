export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

export type FrontierAgentPathSegment = string | number;
export type FrontierAgentPath = string | readonly FrontierAgentPathSegment[];

export type FrontierPackageTier = 'ga' | 'beta' | 'incubation' | 'hold';
export type FrontierRuntime = 'node' | 'browser';

export interface FrontierPackageSurface {
  readonly id: string;
  readonly name: string;
  readonly tier: FrontierPackageTier;
  readonly runtime: readonly FrontierRuntime[];
  readonly role: string;
  readonly dependsOn: readonly string[];
  readonly surfaces: readonly string[];
  readonly notes?: readonly string[];
}

export interface FeaturePackageRef {
  readonly name: string;
  readonly surface?: string;
  readonly importPath?: string;
  readonly tier?: FrontierPackageTier | string;
  readonly optional?: boolean;
  readonly purpose?: string;
}

export interface FeatureStateSurface {
  readonly id: string;
  readonly path: FrontierAgentPath;
  readonly owner?: string;
  readonly package?: string;
  readonly schema?: JsonValue;
  readonly description?: string;
}

export interface FeatureQuerySurface {
  readonly id: string;
  readonly key?: JsonValue;
  readonly selector?: FrontierAgentPath;
  readonly table?: string;
  readonly entity?: string;
  readonly description?: string;
}

export interface FeatureActionSurface {
  readonly id: string;
  readonly title?: string;
  readonly package?: string;
  readonly input?: JsonValue;
  readonly writes?: readonly FrontierAgentPath[];
  readonly reads?: readonly FrontierAgentPath[];
  readonly description?: string;
}

export interface FeatureUiSurface {
  readonly id: string;
  readonly kind?: 'dom' | 'react' | 'scene' | 'virtual' | 'playwright' | 'custom';
  readonly selector?: string;
  readonly bindingId?: string | number;
  readonly path?: FrontierAgentPath;
  readonly description?: string;
}

export interface FeatureAcceptanceCriterion {
  readonly id: string;
  readonly source: 'state' | 'query' | 'dom' | 'playwright' | 'log' | 'benchmark' | 'test' | 'custom';
  readonly query?: FrontierAgentPath | string;
  readonly expected?: JsonValue;
  readonly matcher?: string;
  readonly required?: boolean;
  readonly description?: string;
}

export interface FeatureGate {
  readonly id: string;
  readonly command: string;
  readonly required?: boolean;
  readonly package?: string;
  readonly category?: 'test' | 'typecheck' | 'fuzz' | 'bench' | 'startup' | 'package-boundary' | 'docs' | 'research' | 'custom';
  readonly timeoutMs?: number;
  readonly description?: string;
}

export interface FeatureManifest {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly owner?: string;
  readonly packages?: readonly FeaturePackageRef[];
  readonly state?: readonly FeatureStateSurface[];
  readonly queries?: readonly FeatureQuerySurface[];
  readonly actions?: readonly FeatureActionSurface[];
  readonly ui?: readonly FeatureUiSurface[];
  readonly acceptance?: readonly FeatureAcceptanceCriterion[];
  readonly gates?: readonly FeatureGate[];
  readonly metadata?: JsonObject;
}

export type FeatureRunStatus =
  | 'planned'
  | 'running'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'needs-review'
  | 'cancelled';

export type FeatureStepStatus =
  | 'planned'
  | 'running'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'skipped';

export type EvidenceSeverity = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface FeatureRunActor {
  readonly id: string;
  readonly kind?: 'ai' | 'human' | 'tool' | 'system';
  readonly label?: string;
  readonly model?: string;
}

export interface FeatureRunContext {
  readonly runId?: string;
  readonly actor?: FeatureRunActor;
  readonly branch?: string;
  readonly commit?: string;
  readonly workspace?: string;
  readonly traceId?: string;
  readonly startedAt?: number;
  readonly metadata?: JsonObject;
}

export interface AgentToolCall {
  readonly id: string;
  readonly name: string;
  readonly input?: JsonValue;
  readonly output?: JsonValue;
  readonly status?: 'ok' | 'error' | 'cancelled';
  readonly durationMs?: number;
  readonly error?: string;
}

export interface FeatureStepInput {
  readonly id?: string;
  readonly title: string;
  readonly status?: FeatureStepStatus;
  readonly startedAt?: number;
  readonly endedAt?: number;
  readonly actor?: FeatureRunActor;
  readonly toolCalls?: readonly AgentToolCall[];
  readonly reads?: readonly FrontierAgentPath[];
  readonly writes?: readonly FrontierAgentPath[];
  readonly packages?: readonly FeaturePackageRef[];
  readonly notes?: string;
  readonly evidence?: readonly EvidenceEventInput[];
  readonly metadata?: JsonObject;
}

export interface FeatureStep {
  readonly id: string;
  readonly title: string;
  readonly status: FeatureStepStatus;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly actor?: FeatureRunActor;
  readonly toolCalls: readonly AgentToolCall[];
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  readonly packages: readonly FeaturePackageRef[];
  readonly notes?: string;
  readonly evidenceIds: readonly string[];
  readonly metadata?: JsonObject;
}

export interface EvidenceEventInput {
  readonly id?: string;
  readonly kind: string;
  readonly source?: string;
  readonly severity?: EvidenceSeverity;
  readonly time?: number;
  readonly stepId?: string;
  readonly package?: string;
  readonly summary?: string;
  readonly data?: JsonValue;
  readonly refs?: readonly EvidenceRef[];
  readonly metadata?: JsonObject;
}

export interface EvidenceRef {
  readonly kind: 'file' | 'url' | 'command' | 'package' | 'commit' | 'artifact' | 'trace' | 'custom';
  readonly value: string;
  readonly label?: string;
}

export interface EvidenceEvent {
  readonly id: string;
  readonly kind: string;
  readonly source?: string;
  readonly severity: EvidenceSeverity;
  readonly time: number;
  readonly stepId?: string;
  readonly package?: string;
  readonly summary?: string;
  readonly data?: JsonValue;
  readonly refs: readonly EvidenceRef[];
  readonly metadata?: JsonObject;
}

export interface FeatureCheckpoint {
  readonly id: string;
  readonly label: string;
  readonly time: number;
  readonly stepId?: string;
  readonly basis?: string | number;
  readonly heads?: readonly string[];
  readonly stateVector?: Record<string, number>;
  readonly patchCount?: number;
  readonly data?: JsonValue;
  readonly metadata?: JsonObject;
}

export interface GateResult {
  readonly id: string;
  readonly command: string;
  readonly status: 'passed' | 'failed' | 'skipped' | 'missing';
  readonly required: boolean;
  readonly durationMs?: number;
  readonly exitCode?: number;
  readonly output?: string;
  readonly artifact?: string;
  readonly metadata?: JsonObject;
}

export interface FeatureRunSummary {
  readonly status: FeatureRunStatus;
  readonly stepCount: number;
  readonly evidenceCount: number;
  readonly checkpointCount: number;
  readonly gateCount: number;
  readonly failedGateCount: number;
  readonly requiredGateFailureCount: number;
  readonly packages: readonly string[];
  readonly touchedPaths: readonly string[];
  readonly warnings: readonly string[];
}

export interface FeatureRun {
  readonly kind: 'frontier.agent.feature-run';
  readonly version: 1;
  readonly id: string;
  readonly manifest: FeatureManifest;
  readonly status: FeatureRunStatus;
  readonly actor?: FeatureRunActor;
  readonly traceId?: string;
  readonly branch?: string;
  readonly commit?: string;
  readonly workspace?: string;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly steps: readonly FeatureStep[];
  readonly evidence: readonly EvidenceEvent[];
  readonly checkpoints: readonly FeatureCheckpoint[];
  readonly gates: readonly GateResult[];
  readonly metadata?: JsonObject;
  readonly summary: FeatureRunSummary;
}

export interface RedactionPolicy {
  readonly keys?: readonly (string | RegExp)[];
  readonly paths?: readonly (string | RegExp)[];
  readonly value?: JsonValue;
  readonly maxStringLength?: number;
  readonly maxDepth?: number;
}

export interface FeatureRunJsonlRecord {
  readonly kind:
    | 'frontier.agent.run'
    | 'frontier.agent.step'
    | 'frontier.agent.evidence'
    | 'frontier.agent.checkpoint'
    | 'frontier.agent.gate';
  readonly runId: string;
  readonly value: JsonValue;
}
