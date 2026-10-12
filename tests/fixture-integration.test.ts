/**
 * Port of git-revision-webpack-plugin integration.spec.ts against Rspack,
 * using the same fixtures and expected values.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@rstest/core';
import {
  EXPECTED,
  assetExists,
  prepareFixture,
  readAsset,
} from './helpers/fixture.ts';
import {
  buildWithRspack,
  expectedBundleName,
  expectedPublicPath,
  expectedTxtName,
} from './helpers/build-rspack.ts';

describe('rspack fixture: default (branch: true)', () => {
  it('matches upstream VERSION / COMMITHASH / BRANCH and path templates', async () => {
    const { projectDir, buildDir } = prepareFixture('rspack-default');
    const { plugin, publicPath } = await buildWithRspack(projectDir, buildDir, {
      branch: true,
    });

    expect(readAsset(buildDir, 'VERSION')).toBe(EXPECTED.version);
    expect(readAsset(buildDir, 'COMMITHASH')).toBe(EXPECTED.commithash);
    expect(readAsset(buildDir, 'BRANCH')).toBe(EXPECTED.branch);
    expect(readAsset(buildDir, 'LASTCOMMITDATETIME').length).toBeGreaterThan(0);

    const bundle = expectedBundleName(EXPECTED.version);
    expect(fs.existsSync(path.join(buildDir, bundle))).toBe(true);
    expect(publicPath).toBe(
      expectedPublicPath(EXPECTED.version, EXPECTED.commithash),
    );

    expect(
      fs.existsSync(path.join(buildDir, expectedTxtName(EXPECTED.version))),
    ).toBe(true);

    expect(plugin.commithash()).toBe(EXPECTED.commithash);
    expect(plugin.version()).toBe(EXPECTED.version);
    expect(plugin.branch()).toBe(EXPECTED.branch);
  }, 60_000);
});

describe('rspack fixture: lightweightTags', () => {
  it('matches upstream lightweight tag VERSION and templates', async () => {
    const { projectDir, buildDir } = prepareFixture('rspack-lightweight');
    const { plugin, publicPath } = await buildWithRspack(projectDir, buildDir, {
      branch: true,
      lightweightTags: true,
    });

    expect(readAsset(buildDir, 'VERSION')).toBe(EXPECTED.versionLightweight);
    expect(readAsset(buildDir, 'COMMITHASH')).toBe(EXPECTED.commithash);
    expect(readAsset(buildDir, 'BRANCH')).toBe(EXPECTED.branch);

    const bundle = expectedBundleName(EXPECTED.versionLightweight);
    expect(fs.existsSync(path.join(buildDir, bundle))).toBe(true);
    expect(publicPath).toBe(
      expectedPublicPath(EXPECTED.versionLightweight, EXPECTED.commithash),
    );

    expect(plugin.version()).toBe(EXPECTED.versionLightweight);
    expect(plugin.commithash()).toBe(EXPECTED.commithash);
    expect(plugin.branch()).toBe(EXPECTED.branch);
  }, 60_000);
});

describe('rspack fixture: without branch', () => {
  it('emits VERSION / COMMITHASH but not BRANCH', async () => {
    const { projectDir, buildDir } = prepareFixture('rspack-no-branch');
    await buildWithRspack(projectDir, buildDir, {});

    expect(readAsset(buildDir, 'VERSION')).toBe(EXPECTED.version);
    expect(readAsset(buildDir, 'COMMITHASH')).toBe(EXPECTED.commithash);
    expect(assetExists(buildDir, 'BRANCH')).toBe(false);
  }, 60_000);
});
