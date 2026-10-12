/**
 * Apply `[git-revision-*]` substitutions to bundler config fields that affect
 * output paths. Rspack has no `compilation.hooks.assetPath`, so we rewrite
 * string templates on the compiler options (mirroring what webpack's assetPath
 * waterfall would resolve later).
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
      replaceStringField(output, key, replacePattern, data);
    }
  }

  const module = options.module as { rules?: unknown[] } | undefined;
  if (module?.rules) {
    walkRules(module.rules, replacePattern, data);
  }
}

function replaceStringField(
  target: Record<string, unknown>,
  key: string,
  replacePattern: RegExp,
  data: string,
): void {
  const current = target[key];
  if (typeof current === 'string') {
    target[key] = current.replace(replacePattern, data);
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
      replaceStringField(generator, 'filename', replacePattern, data);
    }

    // webpack file-loader query / options.name
    for (const use of normalizeUse(r.use ?? r.loader)) {
      if (typeof use === 'string') {
        // e.g. file-loader?name=[name]-[git-revision-version].[ext]
        continue;
      }
      if (use && typeof use === 'object') {
        const u = use as Record<string, unknown>;
        const opts = (u.options ?? u.query) as Record<string, unknown> | string | undefined;
        if (opts && typeof opts === 'object') {
          replaceStringField(opts, 'name', replacePattern, data);
          replaceStringField(opts, 'filename', replacePattern, data);
        } else if (typeof opts === 'string' && opts.includes('name=')) {
          u.options = opts.replace(replacePattern, data);
        }
        if (typeof u.loader === 'string' && u.loader.includes('name=')) {
          u.loader = u.loader.replace(replacePattern, data);
        }
      }
    }

    if (typeof r.loader === 'string' && r.loader.includes('name=')) {
      r.loader = r.loader.replace(replacePattern, data);
    }
  }
}

function normalizeUse(use: unknown): unknown[] {
  if (!use) return [];
  return Array.isArray(use) ? use : [use];
}
