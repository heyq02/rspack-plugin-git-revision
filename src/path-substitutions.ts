/**
 * Apply `[git-revision-*]` substitutions to bundler config fields that affect
 * output paths.
 *
 * Rspack has no `compilation.hooks.assetPath`, so we:
 * 1. Keep the original tokenized templates and re-materialize substituted
 *    strings on each git refresh (so watch rebuilds pick up new commits)
 * 2. Also patch `compilation.getPath*` (see `build-file.ts`) for late paths
 *    such as CSS / asset modules (parity with webpack's assetPath waterfall).
 */

export type PathSubstitutionData = string | (() => string);

interface PatternEntry {
  re: RegExp;
  getData: () => string;
}

interface StringFieldState {
  kind: 'string';
  original: string;
  patterns: Map<string, PatternEntry>;
}

interface FunctionFieldState {
  kind: 'function';
  original: (...args: unknown[]) => unknown;
  patterns: Map<string, PatternEntry>;
  wrapped: (...args: unknown[]) => unknown;
}

type FieldState = StringFieldState | FunctionFieldState;

const fieldStates = new WeakMap<object, Map<string, FieldState>>();

function resolveData(data: PathSubstitutionData): () => string {
  return typeof data === 'function' ? data : () => data;
}

function applyPatterns(
  input: string,
  patterns: Map<string, PatternEntry>,
): string {
  let result = input;
  for (const { re, getData } of patterns.values()) {
    const value = getData();
    if (value) result = result.replace(re, value);
  }
  return result;
}

/** Fields where Rspack accepts `(pathData) => string` templates. */
const FUNCTION_TEMPLATE_KEYS = new Set([
  'filename',
  'chunkFilename',
  'cssFilename',
  'cssChunkFilename',
  'hotUpdateChunkFilename',
  'hotUpdateMainFilename',
  'assetModuleFilename',
]);

function materializeStringField(
  target: Record<string, unknown>,
  key: string,
  state: StringFieldState,
): void {
  const resolved = applyPatterns(state.original, state.patterns);

  // Filename-like fields: live function so watch rebuilds re-resolve after
  // optimizeTree updates git data (plain strings get snapshotted by Rspack).
  // publicPath stays a string — Rspack / consumers often require string | 'auto'.
  const value = FUNCTION_TEMPLATE_KEYS.has(key)
    ? () => applyPatterns(state.original, state.patterns)
    : resolved;

  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

/**
 * Rewrite path-related config fields. Pass a getter so watch rebuilds see
 * updated git values without permanently burning tokens out of templates.
 */
export function applyPathSubstitutions(
  options: Record<string, unknown>,
  replacePattern: RegExp,
  data: PathSubstitutionData,
): void {
  const getData = resolveData(data);

  const output = options.output as Record<string, unknown> | undefined;
  if (output) {
    for (const key of [
      'filename',
      'chunkFilename',
      'cssFilename',
      'cssChunkFilename',
      'publicPath',
      'hotUpdateChunkFilename',
      'hotUpdateMainFilename',
      'assetModuleFilename',
    ]) {
      replaceField(output, key, replacePattern, getData);
    }
  }

  const module = options.module as { rules?: unknown[] } | undefined;
  if (module?.rules) {
    walkRules(module.rules, replacePattern, getData);
  }
}

function replaceField(
  target: Record<string, unknown>,
  key: string,
  replacePattern: RegExp,
  getData: () => string,
): void {
  let keyMap = fieldStates.get(target);
  if (!keyMap) {
    keyMap = new Map();
    fieldStates.set(target, keyMap);
  }

  const existing = keyMap.get(key);
  if (existing) {
    existing.patterns.set(replacePattern.source, {
      re: replacePattern,
      getData,
    });
    if (existing.kind === 'string') {
      materializeStringField(target, key, existing);
    }
    return;
  }

  const current = target[key];
  if (typeof current === 'string') {
    const state: StringFieldState = {
      kind: 'string',
      original: current,
      patterns: new Map([
        [replacePattern.source, { re: replacePattern, getData }],
      ]),
    };
    keyMap.set(key, state);
    materializeStringField(target, key, state);
    return;
  }

  // webpack issue #39: output.filename as function
  if (typeof current === 'function') {
    const original = current as (...args: unknown[]) => unknown;
    const patterns = new Map<string, PatternEntry>([
      [replacePattern.source, { re: replacePattern, getData }],
    ]);
    const wrapped = (...args: unknown[]) => {
      const result = original(...args);
      return typeof result === 'string'
        ? applyPatterns(result, patterns)
        : result;
    };
    const state: FunctionFieldState = {
      kind: 'function',
      original,
      patterns,
      wrapped,
    };
    keyMap.set(key, state);
    target[key] = wrapped;
  }
}

function walkRules(
  rules: unknown[],
  replacePattern: RegExp,
  getData: () => string,
): void {
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue;
    const r = rule as Record<string, unknown>;

    if (Array.isArray(r.oneOf)) walkRules(r.oneOf, replacePattern, getData);
    if (Array.isArray(r.rules)) walkRules(r.rules, replacePattern, getData);

    const generator = r.generator as Record<string, unknown> | undefined;
    if (generator) {
      replaceField(generator, 'filename', replacePattern, getData);
    }

    for (const use of normalizeUse(r.use ?? r.loader)) {
      if (typeof use === 'string') continue;
      if (use && typeof use === 'object') {
        const u = use as Record<string, unknown>;
        const opts = (u.options ?? u.query) as
          Record<string, unknown> | string | undefined;
        if (opts && typeof opts === 'object') {
          replaceField(opts, 'name', replacePattern, getData);
          replaceField(opts, 'filename', replacePattern, getData);
        } else if (typeof opts === 'string' && /\[git-revision-/i.test(opts)) {
          const next = opts.replace(replacePattern, getData());
          if (u.options !== undefined) u.options = next;
          else if (u.query !== undefined) u.query = next;
        }
        if (typeof u.loader === 'string' && /\[git-revision-/i.test(u.loader)) {
          u.loader = u.loader.replace(replacePattern, getData());
        }
      }
    }

    if (typeof r.loader === 'string' && /\[git-revision-/i.test(r.loader)) {
      r.loader = r.loader.replace(replacePattern, getData());
    }
    if (typeof r.use === 'string' && /\[git-revision-/i.test(r.use)) {
      r.use = r.use.replace(replacePattern, getData());
    }
  }
}

function normalizeUse(use: unknown): unknown[] {
  if (!use) return [];
  return Array.isArray(use) ? use : [use];
}

/**
 * Patch Rspack compilation path helpers to behave like webpack's
 * `compilation.hooks.assetPath` waterfall for `[git-revision-*]` tokens.
 */
export function patchCompilationPathHelpers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Rspack Compilation path helpers
  compilation: any,
  replacePattern: RegExp,
  getData: () => string,
): void {
  const rewrite = (filename: string) => {
    const git = getData();
    return typeof filename === 'string' && git
      ? filename.replace(replacePattern, git)
      : filename;
  };

  for (const method of [
    'getPath',
    'getAssetPath',
    'getPathWithInfo',
    'getAssetPathWithInfo',
  ] as const) {
    if (typeof compilation[method] !== 'function') continue;
    const original = compilation[method].bind(compilation);
    compilation[method] = (filename: string, data?: unknown) =>
      original(rewrite(filename), data);
  }
}
