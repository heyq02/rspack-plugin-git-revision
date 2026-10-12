import type { RsbuildPlugin } from '@rsbuild/core';
import {
  GitRevisionRspackPlugin,
  type GitRevisionPluginOptions,
} from './plugin.ts';

/**
 * Rsbuild plugin wrapper around {@link GitRevisionRspackPlugin}.
 */
export function pluginGitRevision(
  options: GitRevisionPluginOptions = {},
): RsbuildPlugin {
  const rspackPlugin = new GitRevisionRspackPlugin(options);

  return {
    name: 'plugin-git-revision',
    setup(api) {
      api.modifyRspackConfig((config) => {
        config.plugins ??= [];
        config.plugins.push(rspackPlugin);
        return config;
      });
    },
  };
}

export type { GitRevisionPluginOptions };
