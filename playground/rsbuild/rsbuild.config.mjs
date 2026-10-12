import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rsbuild/core';
import { pluginGitRevision } from '@heyq02/rspack-plugin-git-revision';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gitWorkTree = path.resolve(__dirname, '../..');

export default defineConfig({
  source: {
    entry: {
      index: './src/index.js',
    },
  },
  output: {
    distPath: {
      root: 'dist',
    },
  },
  plugins: [
    pluginGitRevision({
      gitWorkTree,
      branch: true,
    }),
  ],
});
