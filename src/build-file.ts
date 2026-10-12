import type { Compiler, Compilation } from '@rspack/core';
import { sources } from '@rspack/core';
import { runGitCommand } from './helpers/run-git-command.ts';

export interface BuildFileOptions {
  compiler: Compiler;
  gitWorkTree?: string;
  command: string;
  replacePattern: RegExp;
  asset: string;
}

function applyPathSubstitutions(
  compiler: Compiler,
  replacePattern: RegExp,
  data: string,
): void {
  const { output } = compiler.options;
  if (!output || !data) return;

  const keys = [
    'filename',
    'chunkFilename',
    'cssFilename',
    'cssChunkFilename',
    'publicPath',
    'hotUpdateChunkFilename',
    'hotUpdateMainFilename',
  ] as const;

  for (const key of keys) {
    const current = output[key as keyof typeof output];
    if (typeof current === 'string') {
      Object.assign(output, {
        [key]: current.replace(replacePattern, data),
      });
    }
  }
}

export function buildFile({
  compiler,
  gitWorkTree,
  command,
  replacePattern,
  asset,
}: BuildFileOptions): void {
  let data = '';

  // Resolve early so path substitutions work even when Rspack lacks assetPath.
  try {
    data = runGitCommand(gitWorkTree, command) ?? '';
    applyPathSubstitutions(compiler, replacePattern, data);
  } catch {
    // Defer error to the compilation phase so builds can surface it as a warning/error.
  }

  compiler.hooks.compilation.tap(
    'GitRevisionRspackPlugin',
    (compilation: Compilation) => {
      compilation.hooks.optimizeTree.tapAsync(
        'GitRevisionRspackPlugin',
        (_chunks, _modules, callback) => {
          runGitCommand(gitWorkTree, command, (err, res) => {
            if (err) {
              callback(err);
              return;
            }
            data = res;
            applyPathSubstitutions(compiler, replacePattern, data);
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
