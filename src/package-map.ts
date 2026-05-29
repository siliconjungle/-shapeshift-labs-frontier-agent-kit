import type { FrontierPackageSurface } from './types.js';

export const FRONTIER_PACKAGE_SURFACES: readonly FrontierPackageSurface[] = [
  {
    id: 'frontier',
    name: '@shapeshift-labs/frontier',
    tier: 'ga',
    runtime: ['node', 'browser'],
    role: 'Core JSON diff/apply, compact patch tuples, JSON Pointer, equality, clone, validation, Unicode helpers, and tiny dependency-free runtime budget/scheduler primitives.',
    dependsOn: [],
    surfaces: ['diff', 'apply', 'patch', 'pointer', 'equal', 'clone', 'validate', 'unicode', 'runtime', 'registry']
  },
  {
    id: 'frontier-query',
    name: '@shapeshift-labs/frontier-query',
    tier: 'ga',
    runtime: ['node', 'browser'],
    role: 'Shared query-key, selector path, condition, entity identity, and table-shape primitives.',
    dependsOn: [],
    surfaces: ['query-key', 'selector-path', 'condition', 'entity-identity', 'table-shape', 'sync-plan']
  },
  {
    id: 'frontier-codec',
    name: '@shapeshift-labs/frontier-codec',
    tier: 'ga',
    runtime: ['node', 'browser'],
    role: 'Patch serialization, binary frames, canonical JSON, and patch-history codecs.',
    dependsOn: ['@shapeshift-labs/frontier'],
    surfaces: ['codec', 'history', 'frame', 'canonical', 'content-address', 'op-log', 'binary-core']
  },
  {
    id: 'frontier-engine',
    name: '@shapeshift-labs/frontier-engine',
    tier: 'ga',
    runtime: ['node', 'browser'],
    role: 'Stateful planned diff engine, adaptive profiles, schema plans, and engine-level history helpers.',
    dependsOn: ['@shapeshift-labs/frontier', '@shapeshift-labs/frontier-codec'],
    surfaces: ['engine', 'profile', 'patcher', 'history']
  },
  {
    id: 'frontier-state',
    name: '@shapeshift-labs/frontier-state',
    tier: 'ga',
    runtime: ['node', 'browser'],
    role: 'Patch-routed app-state subscriptions, owned commits, maintained views, and path mapping.',
    dependsOn: ['@shapeshift-labs/frontier', '@shapeshift-labs/frontier-engine'],
    surfaces: ['state', 'path-map', 'commit', 'subscription', 'maintained-view']
  },
  {
    id: 'frontier-state-cache',
    name: '@shapeshift-labs/frontier-state-cache',
    tier: 'ga',
    runtime: ['node', 'browser'],
    role: 'Normalized query-result cache with entity/query watchers, persistence, change logs, optimistic layers, scheduled persistence, and mutation bridge.',
    dependsOn: ['@shapeshift-labs/frontier', '@shapeshift-labs/frontier-query'],
    surfaces: ['cache', 'query-watch', 'entity-watch', 'persistence', 'change-log', 'optimistic-layer', 'mutation-bridge'],
    notes: ['Optional peer bridge to frontier-mutation; structural scheduler for persistence work.']
  },
  {
    id: 'frontier-state-cache-idb',
    name: '@shapeshift-labs/frontier-state-cache-idb',
    tier: 'ga',
    runtime: ['browser'],
    role: 'IndexedDB persistence adapter for Frontier state-cache snapshots and durable change logs.',
    dependsOn: ['@shapeshift-labs/frontier-state-cache'],
    surfaces: ['indexeddb-adapter', 'snapshot-persistence', 'durable-change-log'],
    notes: ['Browser IndexedDB runtime kept out of the state-cache root import.']
  },
  {
    id: 'frontier-state-cache-file',
    name: '@shapeshift-labs/frontier-state-cache-file',
    tier: 'ga',
    runtime: ['node'],
    role: 'Structured file persistence adapter for Frontier state-cache snapshots and change logs.',
    dependsOn: ['@shapeshift-labs/frontier-state-cache'],
    surfaces: ['file-adapter', 'snapshot-persistence', 'change-log']
  },
  {
    id: 'frontier-state-cache-sql',
    name: '@shapeshift-labs/frontier-state-cache-sql',
    tier: 'ga',
    runtime: ['node'],
    role: 'SQL persistence adapter for Frontier state-cache snapshots and change logs.',
    dependsOn: ['@shapeshift-labs/frontier-state-cache'],
    surfaces: ['sql-adapter', 'snapshot-persistence', 'change-log', 'structural-executor']
  },
  {
    id: 'frontier-schema',
    name: '@shapeshift-labs/frontier-schema',
    tier: 'ga',
    runtime: ['node', 'browser'],
    role: 'JSON Schema validation, Frontier profile generation, CloudEvent envelopes, and query/table schema helpers.',
    dependsOn: ['@shapeshift-labs/frontier', '@shapeshift-labs/frontier-query', '@shapeshift-labs/frontier-engine'],
    surfaces: ['json-schema', 'event', 'query', 'lint', 'profile-generation']
  },
  {
    id: 'frontier-event-log',
    name: '@shapeshift-labs/frontier-event-log',
    tier: 'ga',
    runtime: ['node', 'browser'],
    role: 'Bounded event logs, replay cursors, consumer acknowledgements, keyed compaction, checkpoints, and Frontier patch event records.',
    dependsOn: ['@shapeshift-labs/frontier'],
    surfaces: ['event-log', 'replay-cursor', 'acknowledgement', 'compaction', 'checkpoint', 'patch-event']
  },
  {
    id: 'frontier-scheduler',
    name: '@shapeshift-labs/frontier-scheduler',
    tier: 'incubation',
    runtime: ['node', 'browser'],
    role: 'Deterministic work scheduling, lanes, cancellation, backpressure, frame policies, replay snapshots, and work graphs.',
    dependsOn: [],
    surfaces: ['scheduler', 'lane', 'cancellation', 'backpressure', 'frame-policy', 'replay-snapshot', 'work-graph']
  },
  {
    id: 'frontier-logging',
    name: '@shapeshift-labs/frontier-logging',
    tier: 'ga',
    runtime: ['node', 'browser'],
    role: 'Opt-in structured logging, browser telemetry, scheduled sinks, file sinks, exporters, benchmark traces, and Frontier patch/update summaries.',
    dependsOn: ['@shapeshift-labs/frontier', '@shapeshift-labs/frontier-codec'],
    surfaces: ['logging', 'browser', 'frontier', 'node', 'exporters', 'benchmark', 'redaction', 'sampling', 'span']
  },
  {
    id: 'frontier-mutation',
    name: '@shapeshift-labs/frontier-mutation',
    tier: 'ga',
    runtime: ['node', 'browser'],
    role: 'Explicit mutation and selector plans compiled to Frontier patches or CRDT operations.',
    dependsOn: ['peer:@shapeshift-labs/frontier', 'peer:@shapeshift-labs/frontier-query'],
    surfaces: ['mutation-plan', 'selector-plan', 'patch-compile', 'crdt-compile', 'action-registry']
  },
  {
    id: 'frontier-virtual',
    name: '@shapeshift-labs/frontier-virtual',
    tier: 'incubation',
    runtime: ['node', 'browser'],
    role: 'DOM-neutral virtualization, layout providers, range materialization, grids, spatial/frustum indexes, patch invalidation, camera anchors, and serializable layout state.',
    dependsOn: ['@shapeshift-labs/frontier'],
    surfaces: ['virtualization', 'layout-provider', 'range-materialization', 'grid', 'frustum', 'spatial-index']
  },
  {
    id: 'frontier-scene',
    name: '@shapeshift-labs/frontier-scene',
    tier: 'incubation',
    runtime: ['node', 'browser'],
    role: 'Patch-native 2D/3D scene graph, transform propagation, bounds queries, virtual/culling adapters, spatial invalidation, and camera/frustum materialization.',
    dependsOn: ['@shapeshift-labs/frontier'],
    surfaces: ['scene-graph', 'transform', 'bounds', 'culling', 'camera', 'spatial-invalidation']
  },
  {
    id: 'frontier-pathfinding',
    name: '@shapeshift-labs/frontier-pathfinding',
    tier: 'incubation',
    runtime: ['node', 'browser'],
    role: 'Patch-native grid pathfinding, typed-array A*/Dijkstra search, flow fields, connected components, line-of-sight smoothing, dirty-cell invalidation, and scheduler-friendly path jobs.',
    dependsOn: ['@shapeshift-labs/frontier'],
    surfaces: ['astar', 'dijkstra', 'flow-field', 'connected-components', 'line-of-sight', 'dirty-cell', 'path-job']
  },
  {
    id: 'frontier-dom',
    name: '@shapeshift-labs/frontier-dom',
    tier: 'incubation',
    runtime: ['browser'],
    role: 'Patch-native DOM and host renderer bindings, manifest hydration, JSX runtime/compiler helpers, SSR, devtools, and logging bridges.',
    dependsOn: ['@shapeshift-labs/frontier', '@shapeshift-labs/frontier-state', '@shapeshift-labs/frontier-virtual'],
    surfaces: ['core', 'jsx-runtime', 'compiler', 'vite', 'logging', 'devtools', 'ssr', 'hydration', 'manifest']
  },
  {
    id: 'frontier-playwright',
    name: '@shapeshift-labs/frontier-playwright',
    tier: 'incubation',
    runtime: ['node', 'browser'],
    role: 'Playwright/headless automation probes for Frontier state, DOM, devtools, marks, and timeline queries.',
    dependsOn: ['peer:playwright'],
    surfaces: ['probe', 'ai-session', 'timeline', 'evidence', 'jsonl', 'report', 'log-records']
  },
  {
    id: 'frontier-crdt',
    name: '@shapeshift-labs/frontier-crdt',
    tier: 'beta',
    runtime: ['node', 'browser'],
    role: 'Native CRDT documents, update tooling, awareness, branches, conflict introspection, version frames, and undo.',
    dependsOn: ['@shapeshift-labs/frontier', '@shapeshift-labs/frontier-codec', '@shapeshift-labs/frontier-engine', '@shapeshift-labs/frontier-state'],
    surfaces: ['document', 'update', 'state', 'lattice', 'awareness', 'branch', 'undo', 'rich-text']
  },
  {
    id: 'frontier-crdt-sync',
    name: '@shapeshift-labs/frontier-crdt-sync',
    tier: 'beta',
    runtime: ['node', 'browser'],
    role: 'CRDT sync endpoints, repo/storage/provider contracts, scheduled sync work, document URLs, local networks, model checking, forensics, and text binding contracts.',
    dependsOn: ['@shapeshift-labs/frontier-crdt', '@shapeshift-labs/frontier-event-log', '@shapeshift-labs/frontier'],
    surfaces: ['sync', 'repo', 'storage', 'provider', 'lazy-body', 'model', 'forensics', 'text-binding']
  },
  {
    id: 'frontier-crdt-websocket',
    name: '@shapeshift-labs/frontier-crdt-websocket',
    tier: 'beta',
    runtime: ['node', 'browser'],
    role: 'WebSocket client/server transports for Frontier CRDT sync providers.',
    dependsOn: ['@shapeshift-labs/frontier-crdt-sync', 'ws'],
    surfaces: ['client', 'server', 'wire', 'room-transport']
  },
  {
    id: 'frontier-react',
    name: '@shapeshift-labs/frontier-react',
    tier: 'beta',
    runtime: ['browser'],
    role: 'React external-store hooks and adapters for Frontier state, cache, and CRDT surfaces.',
    dependsOn: ['@shapeshift-labs/frontier', 'peer:react'],
    surfaces: ['store', 'hooks', 'adapters', 'external-store']
  },
  {
    id: 'frontier-richtext',
    name: '@shapeshift-labs/frontier-richtext',
    tier: 'hold',
    runtime: ['node', 'browser'],
    role: 'Rich text Delta normalization/application, marks, embeds, ranges, and cursor/selection transforms for local editor integrations.',
    dependsOn: [],
    surfaces: ['delta', 'mark', 'embed', 'range', 'cursor', 'selection-transform']
  },
  {
    id: 'frontier-realtime',
    name: '@shapeshift-labs/frontier-realtime',
    tier: 'incubation',
    runtime: ['node', 'browser'],
    role: 'Shared realtime command, tick, snapshot, prediction, reconciliation, interpolation, rollback, message, and delta primitives.',
    dependsOn: ['peer:@shapeshift-labs/frontier', 'peer:@shapeshift-labs/frontier-codec'],
    surfaces: ['command', 'messages', 'binary', 'codec', 'delta', 'frontier', 'prediction', 'rollback', 'snapshot-buffer', 'tick']
  },
  {
    id: 'frontier-realtime-server',
    name: '@shapeshift-labs/frontier-realtime-server',
    tier: 'incubation',
    runtime: ['node'],
    role: 'Authoritative realtime room, tick, command validation, rate-limit, session, and snapshot-history runtime.',
    dependsOn: ['@shapeshift-labs/frontier-realtime', 'peer:@shapeshift-labs/frontier-event-log'],
    surfaces: ['room', 'session', 'history', 'event-log', 'rate-limit', 'command-validation']
  },
  {
    id: 'frontier-realtime-websocket',
    name: '@shapeshift-labs/frontier-realtime-websocket',
    tier: 'incubation',
    runtime: ['node', 'browser'],
    role: 'WebSocket client, wire, and Node room-server transport for Frontier realtime.',
    dependsOn: ['@shapeshift-labs/frontier-realtime', 'ws'],
    surfaces: ['client', 'server', 'wire', 'room-transport']
  },
  {
    id: 'frontier-game',
    name: '@shapeshift-labs/frontier-game',
    tier: 'incubation',
    runtime: ['node', 'browser'],
    role: 'Game-facing entity, component, player, room, ownership, spatial interest, rollback, physics, and replication helpers above realtime.',
    dependsOn: ['@shapeshift-labs/frontier-realtime', 'peer:@shapeshift-labs/frontier-query'],
    surfaces: ['commands', 'ecs', 'lag', 'physics', 'query', 'replication', 'room', 'rollback', 'world', 'spatial']
  }
];

const BY_ID_OR_NAME = new Map<string, FrontierPackageSurface>(
  FRONTIER_PACKAGE_SURFACES.flatMap((surface) => [
    [surface.id, surface],
    [surface.name, surface]
  ])
);

export function listFrontierPackageSurfaces(): readonly FrontierPackageSurface[] {
  return FRONTIER_PACKAGE_SURFACES;
}

export function getFrontierPackageSurface(idOrName: string): FrontierPackageSurface | undefined {
  return BY_ID_OR_NAME.get(idOrName);
}

export function requireFrontierPackageSurface(idOrName: string): FrontierPackageSurface {
  const surface = getFrontierPackageSurface(idOrName);
  if (!surface) throw new Error('unknown Frontier package: ' + idOrName);
  return surface;
}

export function normalizeFrontierPackageName(idOrName: string): string {
  return getFrontierPackageSurface(idOrName)?.name ?? idOrName;
}

