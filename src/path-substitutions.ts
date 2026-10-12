/**
 * Apply `[git-revision-*]` substitutions to bundler config fields that affect
 * output paths.
 *
 * Rspack has no `compilation.hooks.assetPath`, so we:
 * 1. Rewrite string / function templates on compiler options up front
 * 2. Also patch `compilation.getPath*` (see `build-file.ts`) for late paths
 *    such as CSS / asset modules (parity with webpack's assetPath waterfall).
 */
export function applyPathSubstitutions(
  options: Record<string, unknown>,
  replacePattern: RegExp,
  data: string,
): void {
  if (!data) return;

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
      replaceField(output, key, replacePattern, data);
    }
  }

  const module = options.module as { rules?: unknown[] } | undefined;
  if (module?.rules) {
    walkRules(module.rules, replacePattern, data);
  }
}

function replaceField(
  target: Record<string, unknown>,
  key: string,
  replacePattern: RegExp,
  data: string,
): void {
  const current = target[key];
  if (typeof current === 'string') {
    target[key] = current.replace(replacePattern, data);
    return;
  }
  // webpack issue #39: output.filename as function
  if (typeof current === 'function') {
    const original = current as (...args: unknown[]) => unknown;
    target[key] = (...args: unknown[]) => {
      const result = original(...args);
      return typeof result === 'string'
        ? result.replace(replacePattern, data)
        : result;
    };
  }
}

function walkRules(
  rules: unknown[],
  replacePattern: RegExp,
  data: string,
): void {
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue;
    const r = rule as Record<string, unknown>;

    if (Array.isArray(r.oneOf)) walkRules(r.oneOf, replacePattern, data);
    if (Array.isArray(r.rules)) walkRules(r.rules, replacePattern, data);

    const generator = r.generator as Record<string, unknown> | undefined;
    if (generator) {
      replaceField(generator, 'filename', replacePattern, data);
    }

    for (const use of normalizeUse(r.use ?? r.loader)) {
      if (typeof use === 'string') continue;
      if (use && typeof use === 'object') {
        const u = use as Record<string, unknown>;
        const opts = (u.options ?? u.query) as
          | Record<string, unknown>
          | string
          | undefined;
        if (opts && typeof opts === 'object') {
          replaceField(opts, 'name', replacePattern, data);
          replaceField(opts, 'filename', replacePattern, data);
        } else if (typeof opts === 'string' && opts.includes('[')) {
          const next = opts.replace(replacePattern, data);
          if (u.options !== undefined) u.options = next;
          else if (u.query !== undefined) u.query = next;
        }
        if (typeof u.loader === 'string' && u.loader.includes('[')) {
          u.loader = u.loader.replace(replacePattern, data);
        }
      }
    }

    if (typeof r.loader === 'string' && r.loader.includes('[')) {
      r.loader = r.loader.replace(replacePattern, data);
    }
    if (typeof r.use === 'string' && r.use.includes('[')) {
      r.use = r.use.replace(replacePattern, data);
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
