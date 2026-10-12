import type { Compiler, Compilation } from '@rspack/core';
import { sources } from '@rspack/core';
import { runGitCommand } from './helpers/run-git-command.ts';
import { applyPathSubstitutions } from './path-substitutions.ts';

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

  const substitute = (value: string) => {
    applyPathSubstitutions(
      compiler.options as unknown as Record<string, unknown>,
      replacePattern,
      value,
    );
  };

  // Resolve early so path substitutions work even when Rspack lacks assetPath.
  try {
    data = runGitCommand(gitWorkTree, command) ?? '';
    substitute(data);
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
            substitute(data);
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
