import type { Compiler, Compilation } from '@rspack/core';
import { sources } from '@rspack/core';
import { runGitCommand } from './helpers/run-git-command.ts';
import {
  applyPathSubstitutions,
  patchCompilationPathHelpers,
} from './path-substitutions.ts';

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

  const substituteConfig = (value: string) => {
    applyPathSubstitutions(
      compiler.options as unknown as Record<string, unknown>,
      replacePattern,
      value,
    );
  };

  // Resolve early so string/function output templates are rewritten before emit.
  try {
    data = runGitCommand(gitWorkTree, command) ?? '';
    substituteConfig(data);
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
            substituteConfig(data);
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
