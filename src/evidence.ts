import type {
  FeatureGate,
  FeatureManifest,
  JsonObject
} from './types.js';

export interface EvidenceKitScriptPlan {
  readonly scripts: Record<string, string>;
  readonly gates: readonly FeatureGate[];
  readonly notes: readonly string[];
}

export interface EvidenceKitCommandPlan {
  readonly inspect: string;
  readonly initialize: string;
  readonly test: string;
  readonly fuzz: string;
  readonly bench: string;
  readonly startup: string;
  readonly packageBoundary: string;
  readonly docs: string;
  readonly search: string;
  readonly full: string;
}

export function createEvidenceKitCommandPlan(packageManager = 'npm'): EvidenceKitCommandPlan {
  const run = packageManager === 'pnpm' ? 'pnpm' : packageManager === 'yarn' ? 'yarn' : 'npm run';
  return {
    inspect: 'npx evidence-kit inspect --json',
    initialize: 'npx evidence-kit init --language ts',
    test: `${run} test:evidence`,
    fuzz: `${run} fuzz`,
    bench: `${run} bench:evidence`,
    startup: `${run} bench:startup:check`,
    packageBoundary: `${run} bench:package:gates`,
    docs: `${run} docs:perf`,
    search: `${run} docs:perf:search -- frontier agent evidence`,
    full: `${run} evidence:full`
  };
}

export function createFrontierAgentEvidencePlan(manifest?: FeatureManifest): EvidenceKitScriptPlan {
  const scripts: Record<string, string> = {
    'agent:inspect': 'frontier-agent-kit inspect --json',
    'agent:init': 'frontier-agent-kit init',
    'agent:feature:new': 'frontier-agent-kit init-feature',
    'agent:run:summarize': 'frontier-agent-kit summarize',
    'test:evidence': 'npm test && npm run fuzz -- --cases 200',
    fuzz: 'node test/fuzz/agent-kit-fuzz.mjs --cases 1000',
    'bench:evidence': 'node benchmarks/agent-kit-benchmark.mjs --out benchmarks/results/agent-kit-latest.json',
    'bench:startup:check': 'node benchmarks/startup-import.mjs --check --out benchmarks/results/startup-import-latest.json',
    'bench:package:gates': 'node benchmarks/package-boundary-gates.mjs --check --out benchmarks/results/package-boundary-gates-latest.json',
    'docs:perf': 'evidence-kit docs',
    'docs:perf:search': 'evidence-kit search',
    'evidence:full': 'npm run test:evidence && npm run bench:evidence && npm run bench:startup:check && npm run bench:package:gates && npm run docs:perf && npm run docs:perf -- --check'
  };
  const gates: FeatureGate[] = [
    { id: 'test', command: 'npm test', required: true, category: 'test' },
    { id: 'fuzz', command: 'npm run fuzz -- --cases 1000', required: true, category: 'fuzz' },
    { id: 'bench', command: 'npm run bench:evidence', required: true, category: 'bench' },
    { id: 'startup', command: 'npm run bench:startup:check', required: true, category: 'startup' },
    { id: 'package-boundary', command: 'npm run bench:package:gates', required: true, category: 'package-boundary' },
    { id: 'perf-docs', command: 'npm run docs:perf && npm run docs:perf -- --check', required: true, category: 'docs' }
  ];
  return {
    scripts,
    gates: mergeManifestGates(gates, manifest?.gates),
    notes: [
      'Evidence Kit owns generic research, fuzz, benchmark, package-boundary, startup, and perf-wiki mechanisms.',
      'Frontier Agent Kit owns feature-run manifests, cross-package evidence timelines, and Frontier-specific adapters.',
      'Keep optional integrations behind subpaths; root imports should stay JSON-only and dependency-light.'
    ]
  };
}

export function createFeatureEvidenceManifest(id: string, title: string, options: {
  readonly packages?: readonly string[];
  readonly gates?: readonly FeatureGate[];
  readonly metadata?: JsonObject;
} = {}): FeatureManifest {
  return {
    id,
    title,
    packages: (options.packages ?? [
      '@shapeshift-labs/frontier',
      '@shapeshift-labs/frontier-logging',
      '@shapeshift-labs/frontier-playwright'
    ]).map((name) => ({ name })),
    acceptance: [
      {
        id: 'evidence-present',
        source: 'custom',
        matcher: 'run.evidence.length > 0',
        required: true,
        description: 'Feature work must attach replayable evidence.'
      }
    ],
    gates: options.gates ?? createFrontierAgentEvidencePlan().gates,
    ...(options.metadata ? { metadata: options.metadata } : {})
  };
}

function mergeManifestGates(defaults: readonly FeatureGate[], manifestGates: readonly FeatureGate[] | undefined): readonly FeatureGate[] {
  if (!manifestGates || manifestGates.length === 0) return defaults;
  const byId = new Map<string, FeatureGate>();
  for (const gate of defaults) byId.set(gate.id, gate);
  for (const gate of manifestGates) byId.set(gate.id, gate);
  return [...byId.values()];
}

