/**
 * Side-by-side parity: same fixture + options → webpack plugin vs Rspack plugin
 * must emit the same git assets and public API values.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@rstest/core';
import {
  EXPECTED,
  assetExists,
  listBuildFiles,
  prepareFixture,
  readAsset,
} from './helpers/fixture.ts';
import { buildWithRspack } from './helpers/build-rspack.ts';
import { buildWithWebpack } from './helpers/build-webpack.ts';
import type { GitRevisionPluginOptions } from '../src/plugin.ts';

async function runParity(
  label: string,
  options: GitRevisionPluginOptions,
): Promise<void> {
  const webpackFx = prepareFixture(`${label}-webpack`);
  const rspackFx = prepareFixture(`${label}-rspack`);

  const [webpackResult, rspackResult] = await Promise.all([
    buildWithWebpack(webpackFx.projectDir, webpackFx.buildDir, options),
    buildWithRspack(rspackFx.projectDir, rspackFx.buildDir, options),
  ]);

  for (const name of ['VERSION', 'COMMITHASH', 'LASTCOMMITDATETIME'] as const) {
    expect(readAsset(rspackFx.buildDir, name)).toBe(
      readAsset(webpackFx.buildDir, name),
    );
  }

  if (options.branch) {
    expect(readAsset(rspackFx.buildDir, 'BRANCH')).toBe(
      readAsset(webpackFx.buildDir, 'BRANCH'),
    );
  } else {
    expect(assetExists(rspackFx.buildDir, 'BRANCH')).toBe(false);
    expect(assetExists(webpackFx.buildDir, 'BRANCH')).toBe(false);
  }

  expect(rspackResult.plugin.commithash()).toBe(
    webpackResult.plugin.commithash(),
  );
  expect(rspackResult.plugin.version()).toBe(webpackResult.plugin.version());
  expect(rspackResult.plugin.lastcommitdatetime()).toBe(
    webpackResult.plugin.lastcommitdatetime(),
  );
  if (options.branch) {
    expect(rspackResult.plugin.branch()).toBe(webpackResult.plugin.branch());
  }

  // Bundles that embed the substituted publicPath CDN URL.
  const webpackFiles = listBuildFiles(webpackFx.buildDir).filter((f) =>
    f.endsWith('.js'),
  );
  const rspackFiles = listBuildFiles(rspackFx.buildDir).filter((f) =>
    f.endsWith('.js'),
  );

  // Filename template should resolve identically when branch is enabled.
  if (options.branch) {
    const version = options.lightweightTags
      ? EXPECTED.versionLightweight
      : EXPECTED.version;
    const expectedJs = `main-master-${version}.js`;
    expect(webpackFiles).toContain(expectedJs);
    expect(rspackFiles).toContain(expectedJs);

    // Path substitution parity: same resolved filenames for JS + asset modules.
    // (Modern webpack/rspack may not embed publicPath as a string literal.)
    const expectedTxt = `outside-resource-master-${version}.txt`;
    expect(assetExists(webpackFx.buildDir, expectedTxt)).toBe(true);
    expect(assetExists(rspackFx.buildDir, expectedTxt)).toBe(true);

    expect(fs.statSync(path.join(webpackFx.buildDir, expectedJs)).size).toBeGreaterThan(
      0,
    );
    expect(fs.statSync(path.join(rspackFx.buildDir, expectedJs)).size).toBeGreaterThan(
      0,
    );
  }
}

describe('webpack ↔ rspack parity', () => {
  it('default branch: true', async () => {
    await runParity('parity-default', { branch: true });
  }, 90_000);

  it('lightweightTags + branch', async () => {
    await runParity('parity-lightweight', {
      branch: true,
      lightweightTags: true,
    });
  }, 90_000);

  it('without branch', async () => {
    await runParity('parity-no-branch', {});
  }, 90_000);
});
