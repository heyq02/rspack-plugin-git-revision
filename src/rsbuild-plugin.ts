import type { RsbuildPlugin } from '@rsbuild/core';
import {
  GitRevisionRspackPlugin,
  type GitRevisionPluginOptions,
} from './plugin.ts';

export type PluginGitRevision = RsbuildPlugin & {
  version: () => string;
  commithash: () => string;
  branch: () => string;
  lastcommitdatetime: () => string;
};

/**
 * Rsbuild plugin wrapper around {@link GitRevisionRspackPlugin}.
 * Exposes the same public API getters for use with DefinePlugin-style defines.
 */
export function pluginGitRevision(
  options: GitRevisionPluginOptions = {},
): PluginGitRevision {
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
    version: () => rspackPlugin.version(),
    commithash: () => rspackPlugin.commithash(),
    branch: () => rspackPlugin.branch(),
    lastcommitdatetime: () => rspackPlugin.lastcommitdatetime(),
  };
}

export type { GitRevisionPluginOptions };
