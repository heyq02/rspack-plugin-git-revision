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

export interface RspackBuildExtras {
  /** Merge into default `output` (path / clean stay owned by the helper). */
  output?: Record<string, unknown>;
  entry?: Configuration['entry'];
  plugins?: Configuration['plugins'];
}

export async function buildWithRspack(
  projectDir: string,
  buildDir: string,
  pluginOptions: GitRevisionPluginOptions = {},
  extras: RspackBuildExtras = {},
): Promise<RspackBuildResult> {
  const plugin = new GitRevisionRspackPlugin({
    gitWorkTree: projectDir,
    ...pluginOptions,
  });

  let resolvedPublicPath: string | undefined;

  const config: Configuration = {
    mode: 'production',
    context: projectDir,
    entry: extras.entry ?? './index.js',
    target: 'web',
    output: {
      path: buildDir,
      clean: true,
      publicPath:
        'http://cdn.com/assets/[git-revision-branch]/[git-revision-version]/[git-revision-hash]',
      filename: '[name]-[git-revision-branch]-[git-revision-version].js',
      ...extras.output,
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
      ...(extras.plugins ?? []),
      {
        name: 'CapturePublicPath',
        apply(compiler: Compiler) {
          compiler.hooks.compilation.tap('CapturePublicPath', (compilation) => {
            compilation.hooks.processAssets.tap('CapturePublicPath', () => {
              const value = compilation.outputOptions.publicPath;
              const template =
                typeof value === 'function'
                  ? (value as (data: object) => string)({})
                  : value;
              if (typeof template === 'string') {
                resolvedPublicPath = compilation.getPath(template);
              }
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
