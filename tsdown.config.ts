import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  deps: {
    neverBundle: ['@rspack/core', '@rsbuild/core'],
  },
  target: 'node18',
  shims: true,
});
