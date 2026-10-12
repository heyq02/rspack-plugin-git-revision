import { rspack, type Configuration, type Compiler } from '@rspack/core';
import {
  GitRevisionRspackPlugin,
  type GitRevisionPluginOptions,
} from '../../src/plugin.ts';

export interface RspackBuildResult {
  buildDir: string;
  plugin: GitRevisionRspackPlugin;
  publicPath?: string;
  statsJson: {
    assets?: { name: string }[];
  };
}

export async function buildWithRspack(
  projectDir: string,
  buildDir: string,
  pluginOptions: GitRevisionPluginOptions = {},
): Promise<RspackBuildResult> {
  const plugin = new GitRevisionRspackPlugin({
    gitWorkTree: projectDir,
    ...pluginOptions,
  });

  let resolvedPublicPath: string | undefined;

  const config: Configuration = {
    mode: 'production',
    context: projectDir,
    entry: './index.js',
    target: 'web',
    output: {
      path: buildDir,
      clean: true,
      publicPath:
        'http://cdn.com/assets/[git-revision-branch]/[git-revision-version]/[git-revision-hash]',
      filename: '[name]-[git-revision-branch]-[git-revision-version].js',
    },
    module: {
      rules: [
        {
          test: /\.txt$/,
          type: 'asset/resource',
          generator: {
            filename:
              '[name]-[git-revision-branch]-[git-revision-version][ext]',
          },
        },
      ],
    },
    plugins: [
      plugin,
      {
        name: 'CapturePublicPath',
        apply(compiler: Compiler) {
          compiler.hooks.compilation.tap('CapturePublicPath', (compilation) => {
            compilation.hooks.processAssets.tap('CapturePublicPath', () => {
              const value = compilation.outputOptions.publicPath;
              if (typeof value === 'string') resolvedPublicPath = value;
            });
          });
        },
      },
    ],
  };

  const statsJson = await new Promise<RspackBuildResult['statsJson']>(
    (resolve, reject) => {
      rspack(config, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        if (stats?.hasErrors()) {
          reject(new Error(stats.toString({ all: false, errors: true })));
          return;
        }
        resolve(stats?.toJson({ all: false, assets: true }) ?? {});
      });
    },
  );

  return {
    buildDir,
    plugin,
    publicPath: resolvedPublicPath,
    statsJson,
  };
}

export function expectedBundleName(version: string, branch = 'master'): string {
  return `main-${branch}-${version}.js`;
}

export function expectedPublicPath(
  version: string,
  hash: string,
  branch = 'master',
): string {
  return `http://cdn.com/assets/${branch}/${version}/${hash}`;
}

export function expectedTxtName(version: string, branch = 'master'): string {
  return `outside-resource-${branch}-${version}.txt`;
}
