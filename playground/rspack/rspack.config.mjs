import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefinePlugin } from '@rspack/core';
import { GitRevisionRspackPlugin } from '@heyq02/rspack-plugin-git-revision';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Use the monorepo root as the git work tree.
const gitWorkTree = path.resolve(__dirname, '../..');
const gitRevisionPlugin = new GitRevisionRspackPlugin({
  gitWorkTree,
  branch: true,
});

export default {
  mode: 'production',
  context: __dirname,
  entry: './src/index.js',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'main-[git-revision-hash].js',
    clean: true,
  },
  plugins: [
    gitRevisionPlugin,
    new DefinePlugin({
      __GIT_VERSION__: JSON.stringify(gitRevisionPlugin.version()),
      __GIT_COMMITHASH__: JSON.stringify(gitRevisionPlugin.commithash()),
      __GIT_BRANCH__: JSON.stringify(gitRevisionPlugin.branch()),
    }),
  ],
};
