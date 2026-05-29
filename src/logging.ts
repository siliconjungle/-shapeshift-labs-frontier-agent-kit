import type {
  EvidenceEvent,
  FeatureRun,
  FeatureStep,
  GateResult,
  JsonObject,
  JsonValue
} from './types.js';

export interface FrontierAgentLogRecord {
  readonly time: number;
  readonly level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  readonly severityNumber: number;
  readonly name: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly attributes?: JsonObject;
  readonly telemetry?: JsonObject;
  readonly message?: string;
}

export interface FrontierLoggerLike {
  record?(
    level: string | number,
    name: string,
    options?: { readonly attributes?: JsonObject; readonly telemetry?: JsonObject; readonly message?: string; readonly observedTime?: number }
  ): unknown;
  info?(name: string, attributes?: JsonObject, message?: string): unknown;
  warn?(name: string, attributes?: JsonObject, message?: string): unknown;
  error?(name: string, attributes?: JsonObject, message?: string): unknown;
}

export interface FeatureRunLogRecordOptions {
  readonly traceId?: string;
  readonly scope?: string;
  readonly includeEvidenceData?: boolean;
}

export function featureRunToLogRecords(run: FeatureRun, options: FeatureRunLogRecordOptions = {}): FrontierAgentLogRecord[] {
  const traceId = options.traceId ?? run.traceId ?? run.id;
  const records: FrontierAgentLogRecord[] = [
    makeRecord('info', 'frontier.agent.run.start', run.startedAt, traceId, {
      runId: run.id,
      featureId: run.manifest.id,
      title: run.manifest.title,
      status: run.status,
      scope: options.scope ?? 'frontier-agent-kit'
    })
  ];
  for (const step of run.steps) records.push(stepToRecord(step, traceId));
  for (const event of run.evidence) records.push(evidenceToRecord(event, traceId, options.includeEvidenceData === true));
  for (const gate of run.gates) records.push(gateToRecord(gate, traceId));
  records.push(makeRecord(run.summary.requiredGateFailureCount > 0 ? 'error' : 'info', 'frontier.agent.run.summary', run.endedAt ?? Date.now(), traceId, {
    runId: run.id,
    featureId: run.manifest.id,
    status: run.status,
    summary: run.summary as unknown as JsonValue
  }));
  return records;
}

export function writeFeatureRunToLogger(
  logger: FrontierLoggerLike,
  run: FeatureRun,
  options: FeatureRunLogRecordOptions = {}
): number {
  const records = featureRunToLogRecords(run, options);
  for (const record of records) {
    if (typeof logger.record === 'function') {
      logger.record(record.level, record.name, {
        ...(record.attributes ? { attributes: record.attributes } : {}),
        ...(record.telemetry ? { telemetry: record.telemetry } : {}),
        ...(record.message ? { message: record.message } : {}),
        observedTime: record.time
      });
    } else if (record.level === 'error' && typeof logger.error === 'function') {
      logger.error(record.name, record.attributes, record.message);
    } else if (record.level === 'warn' && typeof logger.warn === 'function') {
      logger.warn(record.name, record.attributes, record.message);
    } else if (typeof logger.info === 'function') {
      logger.info(record.name, record.attributes, record.message);
    }
  }
  return records.length;
}

function stepToRecord(step: FeatureStep, traceId: string): FrontierAgentLogRecord {
  return makeRecord(step.status === 'failed' ? 'error' : step.status === 'blocked' ? 'warn' : 'info', 'frontier.agent.step', step.endedAt ?? step.startedAt, traceId, {
    stepId: step.id,
    title: step.title,
    status: step.status,
    reads: step.reads as unknown as JsonValue,
    writes: step.writes as unknown as JsonValue,
    packages: step.packages.map((pkg) => pkg.name) as unknown as JsonValue,
    toolCallCount: step.toolCalls.length
  }, step.notes);
}

function evidenceToRecord(event: EvidenceEvent, traceId: string, includeData: boolean): FrontierAgentLogRecord {
  return makeRecord(event.severity, 'frontier.agent.evidence.' + event.kind, event.time, traceId, {
    evidenceId: event.id,
    stepId: event.stepId ?? '',
    source: event.source ?? '',
    package: event.package ?? '',
    summary: event.summary ?? '',
    refs: event.refs as unknown as JsonValue
  }, event.summary, includeData && event.data !== undefined ? { data: event.data } : undefined);
}

function gateToRecord(gate: GateResult, traceId: string): FrontierAgentLogRecord {
  return makeRecord(gate.status === 'failed' || gate.status === 'missing' ? 'error' : 'info', 'frontier.agent.gate', Date.now(), traceId, {
    gateId: gate.id,
    command: gate.command,
    status: gate.status,
    required: gate.required,
    durationMs: gate.durationMs ?? 0,
    exitCode: gate.exitCode ?? 0,
    artifact: gate.artifact ?? ''
  }, gate.output);
}

function makeRecord(
  level: FrontierAgentLogRecord['level'],
  name: string,
  time: number,
  traceId: string,
  attributes: JsonObject,
  message?: string,
  telemetry?: JsonObject
): FrontierAgentLogRecord {
  return {
    time,
    level,
    severityNumber: severityNumber(level),
    name,
    traceId,
    attributes,
    ...(message ? { message } : {}),
    ...(telemetry ? { telemetry } : {})
  };
}

function severityNumber(level: FrontierAgentLogRecord['level']): number {
  switch (level) {
    case 'trace': return 1;
    case 'debug': return 5;
    case 'info': return 9;
    case 'warn': return 13;
    case 'error': return 17;
    case 'fatal': return 21;
  }
}
