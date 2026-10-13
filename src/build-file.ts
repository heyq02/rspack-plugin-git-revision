import type { Compiler, Compilation } from '@rspack/core';
import { sources } from '@rspack/core';
import { runGitCommand } from './helpers/run-git-command.ts';
import {
  applyPathSubstitutions,
  patchCompilationPathHelpers,
} from './path-substitutions.ts';

const OUTPUT_PATH_KEYS = [
  'filename',
  'chunkFilename',
  'cssFilename',
  'cssChunkFilename',
  'publicPath',
  'hotUpdateChunkFilename',
  'hotUpdateMainFilename',
  'assetModuleFilename',
] as const;

function syncCompilationOutputOptions(
  compiler: Compiler,
  compilation: Compilation,
): void {
  const from = compiler.options.output as Record<string, unknown>;
  const to = (compilation as Compilation & {
    outputOptions?: Record<string, unknown>;
  }).outputOptions;
  if (!from || !to) return;

  for (const key of OUTPUT_PATH_KEYS) {
    if (from[key] !== undefined) {
      to[key] = from[key];
    }
  }
}

export interface BuildFileOptions {
  compiler: Compiler;
  gitWorkTree?: string;
  command: string;
  replacePattern: RegExp;
  asset: string;
}

export function buildFile({
  compiler,
  gitWorkTree,
  command,
  replacePattern,
  asset,
}: BuildFileOptions): void {
  let data = '';

  // Live getter so watch rebuilds re-read fresh git values (not one-shot strings).
  const substituteConfig = () => {
    applyPathSubstitutions(
      compiler.options as unknown as Record<string, unknown>,
      replacePattern,
      () => data,
    );
  };

  // Resolve early so string/function output templates are rewritten before emit.
  try {
    data = runGitCommand(gitWorkTree, command) ?? '';
    substituteConfig();
  } catch {
    // Defer error to the compilation phase so builds can surface it.
  }

  compiler.hooks.compilation.tap(
    'GitRevisionRspackPlugin',
    (compilation: Compilation) => {
      // Parity with webpack `compilation.hooks.assetPath` — covers CSS / assets
      // and any late path formatting (see upstream issues #39 / #86).
      patchCompilationPathHelpers(compilation, replacePattern, () => data);

      compilation.hooks.optimizeTree.tapAsync(
        'GitRevisionRspackPlugin',
        (_chunks, _modules, callback) => {
          runGitCommand(gitWorkTree, command, (err, res) => {
            if (err) {
              callback(err);
              return;
            }
            data = res;
            // Re-install / refresh live getters; values resolve via () => data.
            substituteConfig();
            // Rspack snapshots output templates onto the compilation; push
            // fresh substituted values so watch rebuilds don't keep stale hashes.
            syncCompilationOutputOptions(compiler, compilation);
            callback();
          });
        },
      );

      compilation.hooks.processAssets.tap(
        {
          name: 'GitRevisionRspackPlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          compilation.emitAsset(asset, new sources.RawSource(data));
        },
      );
    },
  );
}
