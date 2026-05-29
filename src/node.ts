import fs from 'node:fs';
import path from 'node:path';
import {
  createFeatureRun,
  createStableId,
  createFeatureRunProof,
  featureRunReviewToMarkdown,
  featureRunProofToMarkdown,
  featureRunFromJsonl,
  featureRunToMarkdownReport,
  featureRunToJsonl,
  finishFeatureRun,
  planFeatureRun,
  reviewFeatureRun,
  summarizeFeatureRun,
  validateFeatureManifest
} from './index.js';
import { createFrontierAgentEvidencePlan, createFeatureEvidenceManifest } from './evidence.js';
import { listFrontierPackageSurfaces } from './package-map.js';
import type { FeatureManifest, FeatureRun, JsonObject } from './types.js';

export interface FrontierAgentWorkspaceInitOptions {
  readonly force?: boolean;
  readonly featureId?: string;
  readonly title?: string;
}

export interface FrontierAgentWorkspaceReport {
  readonly rootDir: string;
  readonly packageName?: string;
  readonly hasConfig: boolean;
  readonly featureCount: number;
  readonly runCount: number;
  readonly evidenceScripts: readonly string[];
  readonly frontierPackageCount: number;
}

export interface CliResult {
  readonly status: number;
  readonly output?: JsonObject;
}

export function initFrontierAgentWorkspace(
  rootDir = process.cwd(),
  options: FrontierAgentWorkspaceInitOptions = {}
): { readonly created: readonly string[]; readonly skipped: readonly string[] } {
  const created: string[] = [];
  const skipped: string[] = [];
  const writeJson = (relativePath: string, value: unknown) => {
    writeFile(relativePath, JSON.stringify(value, null, 2) + '\n');
  };
  const writeFile = (relativePath: string, content: string) => {
    const target = path.join(rootDir, relativePath);
    if (fs.existsSync(target) && !options.force) {
      skipped.push(relativePath);
      return;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    created.push(relativePath);
  };

  const plan = createFrontierAgentEvidencePlan();
  writeJson('frontier-agent.config.json', {
    version: 1,
    packageMap: 'frontier-package-family-2026-05-29',
    runDirectory: 'agent-runs',
    featureDirectory: 'features',
    evidence: plan
  });
  writeJson('features/example-feature.json', createFeatureEvidenceManifest(
    options.featureId ?? 'feature.example',
    options.title ?? 'Example observable Frontier feature'
  ));
  writeFile('agent-runs/.gitkeep', '');
  writeFile('research/frontier-agent-kit-sources.json', JSON.stringify({
    version: 1,
    topic: 'frontier-agent-kit',
    sources: [
      {
        name: 'frontier-package-family',
        type: 'inline',
        text: 'Frontier package catalog, package READMEs, package.json exports, and release-train boundaries define the integration map.',
        fileName: 'frontier-package-family.txt'
      },
      {
        name: 'evidence-kit',
        type: 'git',
        url: 'https://github.com/siliconjungle/-shapeshift-labs-evidence-kit.git',
        ref: 'main'
      }
    ]
  }, null, 2) + '\n');
  return { created, skipped };
}

export function inspectFrontierAgentWorkspace(rootDir = process.cwd()): FrontierAgentWorkspaceReport {
  const packageJson = readJsonIfExists(path.join(rootDir, 'package.json')) as { name?: string; scripts?: Record<string, string> } | null;
  const scripts = packageJson?.scripts ?? {};
  const evidenceScripts = Object.keys(scripts).filter((script) => /evidence|fuzz|bench|docs:perf|research|agent/.test(script)).sort();
  return {
    rootDir,
    ...(packageJson?.name ? { packageName: packageJson.name } : {}),
    hasConfig: fs.existsSync(path.join(rootDir, 'frontier-agent.config.json')),
    featureCount: countJsonFiles(path.join(rootDir, 'features')),
    runCount: countJsonFiles(path.join(rootDir, 'agent-runs')),
    evidenceScripts,
    frontierPackageCount: listFrontierPackageSurfaces().length
  };
}

export function readFeatureManifestFile(filePath: string): FeatureManifest {
  const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8')) as FeatureManifest;
  const validation = validateFeatureManifest(manifest);
  if (!validation.ok) throw new Error('invalid manifest ' + filePath + ': ' + validation.errors.join('; '));
  return manifest;
}

export function writeFeatureRunFile(filePath: string, run: FeatureRun): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(finishFeatureRun(run), null, 2) + '\n');
}

export function readFeatureRunFile(filePath: string): FeatureRun {
  const text = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.jsonl')) return featureRunFromJsonl(text);
  return JSON.parse(text) as FeatureRun;
}

export function writeFeatureRunJsonlFile(filePath: string, run: FeatureRun): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, featureRunToJsonl(run));
}

export function createFeatureRunFromManifestFile(filePath: string, options: { readonly runId?: string } = {}): FeatureRun {
  const manifest = readFeatureManifestFile(filePath);
  return createFeatureRun(manifest, {
    runId: options.runId ?? createStableId('run', manifest.id, Date.now())
  });
}

export async function runCli(argv = process.argv.slice(2), cwd = process.cwd()): Promise<CliResult> {
  const args = parseArgs(argv);
  const command = args._[0] ?? 'help';
  const root = String(args.cwd ?? cwd);
  if (command === 'inspect') {
    const output = inspectFrontierAgentWorkspace(root) as unknown as JsonObject;
    print(output, Boolean(args.json));
    return { status: 0, output };
  }
  if (command === 'init') {
    const output = initFrontierAgentWorkspace(root, { force: Boolean(args.force) }) as unknown as JsonObject;
    print(output, Boolean(args.json));
    return { status: 0, output };
  }
  if (command === 'init-feature') {
    const id = String(args.id ?? 'feature.' + Date.now().toString(36));
    const title = String(args.title ?? id);
    const manifest = createFeatureEvidenceManifest(id, title);
    const target = path.join(root, 'features', id.replace(/[^a-zA-Z0-9_.-]/g, '-') + '.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n');
    const output = { created: [path.relative(root, target)] };
    print(output, Boolean(args.json));
    return { status: 0, output };
  }
  if (command === 'new-run') {
    const manifestPath = args._[1];
    if (!manifestPath) throw new Error('missing manifest path');
    const run = createFeatureRunFromManifestFile(path.resolve(root, manifestPath));
    const target = String(args.out ? path.resolve(root, String(args.out)) : path.join(root, 'agent-runs', run.id + '.json'));
    writeFeatureRunFile(target, run);
    const output = { runId: run.id, path: path.relative(root, target) };
    print(output, Boolean(args.json));
    return { status: 0, output };
  }
  if (command === 'plan') {
    const manifestPath = args._[1];
    if (!manifestPath) throw new Error('missing manifest path');
    const manifest = readFeatureManifestFile(path.resolve(root, manifestPath));
    const output = planFeatureRun(manifest) as unknown as JsonObject;
    print(output, Boolean(args.json));
    return { status: 0, output };
  }
  if (command === 'validate-manifest') {
    const manifestPath = args._[1];
    if (!manifestPath) throw new Error('missing manifest path');
    const manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestPath), 'utf8')) as FeatureManifest;
    const validation = validateFeatureManifest(manifest);
    const output = validation as unknown as JsonObject;
    print(output, Boolean(args.json));
    return { status: validation.ok ? 0 : 1, output };
  }
  if (command === 'summarize') {
    const runPath = args._[1];
    if (!runPath) throw new Error('missing run path');
    const run = readFeatureRunFile(path.resolve(root, runPath));
    const output = summarizeFeatureRun(run) as unknown as JsonObject;
    print(output, Boolean(args.json));
    return { status: 0, output };
  }
  if (command === 'review') {
    const runPath = args._[1];
    if (!runPath) throw new Error('missing run path');
    const run = readFeatureRunFile(path.resolve(root, runPath));
    const review = reviewFeatureRun(run);
    if (args.markdown) {
      console.log(featureRunReviewToMarkdown(review));
    } else {
      print(review, Boolean(args.json));
    }
    return { status: review.ready ? 0 : 1, output: review as unknown as JsonObject };
  }
  if (command === 'proof') {
    const runPath = args._[1];
    if (!runPath) throw new Error('missing run path');
    const run = readFeatureRunFile(path.resolve(root, runPath));
    const proof = createFeatureRunProof(run);
    if (args.markdown) {
      console.log(featureRunProofToMarkdown(proof));
    } else {
      print(proof, Boolean(args.json));
    }
    return { status: proof.ready ? 0 : 1, output: proof as unknown as JsonObject };
  }
  if (command === 'report') {
    const runPath = args._[1];
    if (!runPath) throw new Error('missing run path');
    const run = readFeatureRunFile(path.resolve(root, runPath));
    const markdown = featureRunToMarkdownReport(run);
    if (args.out) {
      const target = path.resolve(root, String(args.out));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, markdown);
      const output = { path: path.relative(root, target) };
      print(output, Boolean(args.json));
      return { status: 0, output };
    }
    console.log(markdown);
    return { status: 0 };
  }
  if (command === 'export-jsonl') {
    const runPath = args._[1];
    if (!runPath) throw new Error('missing run path');
    const run = readFeatureRunFile(path.resolve(root, runPath));
    const jsonl = featureRunToJsonl(run);
    if (args.out) {
      const target = path.resolve(root, String(args.out));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, jsonl);
      const output = { path: path.relative(root, target) };
      print(output, Boolean(args.json));
      return { status: 0, output };
    }
    process.stdout.write(jsonl);
    return { status: 0 };
  }
  printHelp();
  return { status: command === 'help' || command === '--help' || command === '-h' ? 0 : 1 };
}

function countJsonFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((file) => file.endsWith('.json') || file.endsWith('.jsonl')).length;
}

function readJsonIfExists(filePath: string): unknown {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv: readonly string[]): Record<string, unknown> & { _: string[] } {
  const out: Record<string, unknown> & { _: string[] } = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      out[toCamel(arg.slice(2, eq))] = arg.slice(eq + 1);
      continue;
    }
    const key = toCamel(arg.slice(2));
    if (key === 'json' || key === 'force' || key === 'markdown') out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

function toCamel(value: string): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function print(value: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

function printHelp(): void {
  console.log(`Usage:
  frontier-agent-kit inspect [--json]
  frontier-agent-kit init [--force] [--json]
  frontier-agent-kit init-feature --id <id> --title <title>
  frontier-agent-kit new-run <features/feature.json> [--out agent-runs/run.json]
  frontier-agent-kit plan <features/feature.json> [--json]
  frontier-agent-kit validate-manifest <features/feature.json> [--json]
  frontier-agent-kit summarize <agent-runs/run.json> [--json]
  frontier-agent-kit review <agent-runs/run.json> [--json|--markdown]
  frontier-agent-kit proof <agent-runs/run.json> [--json|--markdown]
  frontier-agent-kit report <agent-runs/run.json> [--out report.md]
  frontier-agent-kit export-jsonl <agent-runs/run.json> [--out run.jsonl]
`);
}
