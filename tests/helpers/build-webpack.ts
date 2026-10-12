import { createRequire } from 'node:module';
import webpack from 'webpack';
import { GitRevisionPlugin } from 'git-revision-webpack-plugin';
import type { GitRevisionPluginOptions } from '../../src/plugin.ts';

const require = createRequire(import.meta.url);

export interface WebpackBuildResult {
  buildDir: string;
  plugin: InstanceType<typeof GitRevisionPlugin>;
  publicPath?: string;
}

export async function buildWithWebpack(
  projectDir: string,
  buildDir: string,
  pluginOptions: GitRevisionPluginOptions = {},
): Promise<WebpackBuildResult> {
  const plugin = new GitRevisionPlugin({
    gitWorkTree: projectDir,
    ...pluginOptions,
  });

  // Capture resolved publicPath after webpack's assetPath substitutions.
  let resolvedPublicPath: string | undefined;

  const config = {
    mode: 'production' as const,
    context: projectDir,
    entry: './index.js',
    target: 'web' as const,
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
          type: 'asset/resource' as const,
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
        apply(compiler: webpack.Compiler) {
          compiler.hooks.compilation.tap('CapturePublicPath', (compilation) => {
            compilation.hooks.processAssets.tap('CapturePublicPath', () => {
              const value = compilation.outputOptions.publicPath;
              // webpack keeps the template on outputOptions; resolve via getPath
              // so assetPath substitutions (incl. [git-revision-*]) apply.
              if (typeof value === 'string') {
                resolvedPublicPath = compilation.getPath(value);
              }
            });
          });
        },
      },
    ],
  };

  await new Promise<void>((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      if (stats?.hasErrors()) {
        reject(new Error(stats.toString({ all: false, errors: true })));
        return;
      }
      resolve();
    });
  });

  return { buildDir, plugin, publicPath: resolvedPublicPath };
}
