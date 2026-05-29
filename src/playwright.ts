import { createEvidenceEvent, createStableId } from './index.js';
import type { EvidenceEvent, EvidenceEventInput, JsonObject, JsonValue } from './types.js';

export interface FrontierPlaywrightAiEvidenceLike {
  readonly kind?: string;
  readonly version?: number;
  readonly generatedAt?: string;
  readonly runId?: string;
  readonly report?: FrontierPlaywrightTimelineReportLike;
  readonly jsonl?: string;
  readonly logRecords?: readonly unknown[];
}

export interface FrontierPlaywrightTimelineReportLike {
  readonly kind?: string;
  readonly version?: number;
  readonly generatedAt?: string;
  readonly summary?: Record<string, number>;
  readonly queries?: readonly FrontierPlaywrightTimelineQueryReportLike[];
  readonly timeline?: readonly unknown[];
}

export interface FrontierPlaywrightTimelineQueryReportLike {
  readonly id: string;
  readonly description?: string;
  readonly count?: number;
  readonly matches?: readonly unknown[];
}

export interface PlaywrightEvidenceOptions {
  readonly stepId?: string;
  readonly includeTimeline?: boolean;
  readonly includeJsonl?: boolean;
  readonly includeLogRecords?: boolean;
  readonly time?: number;
}

export function frontierPlaywrightEvidenceToEvents(
  evidence: FrontierPlaywrightAiEvidenceLike,
  options: PlaywrightEvidenceOptions = {}
): readonly EvidenceEvent[] {
  const now = options.time ?? parseGeneratedAt(evidence.generatedAt) ?? Date.now();
  const events: EvidenceEvent[] = [];
  const report = evidence.report;
  if (report) {
    events.push(createEvidenceEvent(playwrightReportToEvidenceInput(report, {
      time: now,
      ...(options.stepId ? { stepId: options.stepId } : {}),
      ...(options.includeTimeline !== undefined ? { includeTimeline: options.includeTimeline } : {})
    })));
    for (const query of report.queries ?? []) {
      events.push(createEvidenceEvent({
        id: createStableId('ev', 'playwright.query', query.id, now),
        kind: 'frontier.playwright.query',
        source: 'playwright',
        package: '@shapeshift-labs/frontier-playwright',
        time: now,
        severity: query.count === 0 ? 'warn' : 'info',
        summary: `${query.id}: ${query.count ?? 0} matches`,
        data: sanitizeUnknown(query) ?? null,
        ...(options.stepId ? { stepId: options.stepId } : {})
      }));
    }
  }
  if (options.includeJsonl === true && evidence.jsonl) {
    events.push(createEvidenceEvent({
      id: createStableId('ev', 'playwright.jsonl', evidence.runId ?? '', now),
      kind: 'frontier.playwright.jsonl',
      source: 'playwright',
      package: '@shapeshift-labs/frontier-playwright',
      time: now,
      severity: 'debug',
      summary: 'Frontier Playwright JSONL export',
      data: { lineCount: evidence.jsonl.split(/\r?\n/g).filter(Boolean).length, jsonl: evidence.jsonl },
      ...(options.stepId ? { stepId: options.stepId } : {})
    }));
  }
  if (options.includeLogRecords === true && evidence.logRecords) {
    events.push(createEvidenceEvent({
      id: createStableId('ev', 'playwright.logRecords', evidence.runId ?? '', now),
      kind: 'frontier.playwright.log-records',
      source: 'playwright',
      package: '@shapeshift-labs/frontier-playwright',
      time: now,
      severity: 'debug',
      summary: `${evidence.logRecords.length} Frontier Playwright log records`,
      data: evidence.logRecords as unknown as JsonValue,
      ...(options.stepId ? { stepId: options.stepId } : {})
    }));
  }
  return events;
}

export function playwrightReportToEvidenceInput(
  report: FrontierPlaywrightTimelineReportLike,
  options: { readonly stepId?: string; readonly time?: number; readonly includeTimeline?: boolean } = {}
): EvidenceEventInput {
  const summary = report.summary ?? {};
  const data: JsonObject = {
    summary: summary as unknown as JsonValue,
    queryCount: report.queries?.length ?? 0
  };
  if (options.includeTimeline === true && report.timeline) data.timeline = report.timeline as unknown as JsonValue;
  return {
    id: createStableId('ev', 'playwright.report', report.generatedAt ?? '', options.time ?? Date.now()),
    kind: 'frontier.playwright.report',
    source: 'playwright',
    package: '@shapeshift-labs/frontier-playwright',
    severity: 'info',
    summary: `${report.queries?.length ?? 0} timeline queries; ${Object.keys(summary).length} summary buckets`,
    data,
    ...(options.stepId ? { stepId: options.stepId } : {}),
    ...(options.time !== undefined ? { time: options.time } : {})
  };
}

function parseGeneratedAt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
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
