/**
 * Feature-by-feature parity against git-revision-webpack-plugin documented API.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { rspack } from '@rspack/core';
import { GitRevisionPlugin as WebpackGitRevisionPlugin } from 'git-revision-webpack-plugin';
import { GitRevisionRspackPlugin } from '../src/plugin.ts';
import { pluginGitRevision } from '../src/rsbuild-plugin.ts';
import { EXPECTED, prepareFixture, readAsset } from './helpers/fixture.ts';
import { buildWithRspack } from './helpers/build-rspack.ts';
import { buildWithWebpack } from './helpers/build-webpack.ts';

describe('feature parity: public API', () => {
  it('matches webpack getters on the shared fixture', () => {
    const { projectDir } = prepareFixture('api-parity');
    const options = { gitWorkTree: projectDir, branch: true as const };
    const webpackPlugin = new WebpackGitRevisionPlugin(options);
    const rspackPlugin = new GitRevisionRspackPlugin(options);

    expect(rspackPlugin.commithash()).toBe(webpackPlugin.commithash());
    expect(rspackPlugin.version()).toBe(webpackPlugin.version());
    expect(rspackPlugin.branch()).toBe(webpackPlugin.branch());
    expect(rspackPlugin.lastcommitdatetime()).toBe(
      webpackPlugin.lastcommitdatetime(),
    );

    expect(rspackPlugin.commithash()).toBe(EXPECTED.commithash);
    expect(rspackPlugin.version()).toBe(EXPECTED.version);
    expect(rspackPlugin.branch()).toBe(EXPECTED.branch);
  });

  it('rejects lightweightTags + versionCommand like webpack', () => {
    const message = "lightweightTags can't be used together versionCommand";
    expect(
      () =>
        new WebpackGitRevisionPlugin({
          versionCommand: 'describe --always',
          lightweightTags: true,
        }),
    ).toThrow(message);
    expect(
      () =>
        new GitRevisionRspackPlugin({
          versionCommand: 'describe --always',
          lightweightTags: true,
        }),
    ).toThrow(message);
  });
});

describe('feature parity: custom git commands', () => {
  it('honors short hash / pretty format commands identically', () => {
    const { projectDir } = prepareFixture('cmd-parity');
    const options = {
      gitWorkTree: projectDir,
      commithashCommand: 'rev-parse --short HEAD',
      versionCommand: 'describe --always --tags --dirty',
      lastCommitDateTimeCommand: 'log -1 --format=%ci',
      branch: true,
      branchCommand: 'rev-parse --abbrev-ref HEAD',
    };

    const webpackPlugin = new WebpackGitRevisionPlugin(options);
    const rspackPlugin = new GitRevisionRspackPlugin(options);

    expect(rspackPlugin.commithash()).toBe(webpackPlugin.commithash());
    expect(rspackPlugin.version()).toBe(webpackPlugin.version());
    expect(rspackPlugin.branch()).toBe(webpackPlugin.branch());
    expect(rspackPlugin.lastcommitdatetime()).toBe(
      webpackPlugin.lastcommitdatetime(),
    );
    expect(rspackPlugin.commithash()).toMatch(/^[0-9a-f]{7,12}$/);
  });
});

describe('feature parity: emitted assets', () => {
  it('always emits VERSION / COMMITHASH / LASTCOMMITDATETIME', async () => {
    const { projectDir, buildDir } = prepareFixture('emit-default');
    await buildWithRspack(projectDir, buildDir, {});
    expect(readAsset(buildDir, 'VERSION')).toBe(EXPECTED.version);
    expect(readAsset(buildDir, 'COMMITHASH')).toBe(EXPECTED.commithash);
    expect(readAsset(buildDir, 'LASTCOMMITDATETIME').length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(buildDir, 'BRANCH'))).toBe(false);
  }, 60_000);

  it('emits BRANCH only when branch: true', async () => {
    const { projectDir, buildDir } = prepareFixture('emit-branch');
    await buildWithRspack(projectDir, buildDir, { branch: true });
    expect(readAsset(buildDir, 'BRANCH')).toBe(EXPECTED.branch);
  }, 60_000);
});

describe('feature parity: path substitutions', () => {
  it('resolves publicPath identically to webpack', async () => {
    const webpackFx = prepareFixture('path-public-w');
    const rspackFx = prepareFixture('path-public-r');
    const options = { branch: true as const };

    const [webpackResult, rspackResult] = await Promise.all([
      buildWithWebpack(webpackFx.projectDir, webpackFx.buildDir, options),
      buildWithRspack(rspackFx.projectDir, rspackFx.buildDir, options),
    ]);

    const expected = `http://cdn.com/assets/master/${EXPECTED.version}/${EXPECTED.commithash}`;
    expect(webpackResult.publicPath).toBe(expected);
    expect(rspackResult.publicPath).toBe(expected);
  }, 90_000);

  it('supports output.filename as a function', async () => {
    const { projectDir, buildDir } = prepareFixture('filename-fn');
    fs.writeFileSync(path.join(projectDir, 'index.js'), `console.log(1);\n`);
    const plugin = new GitRevisionRspackPlugin({
      gitWorkTree: projectDir,
      branch: true,
    });

    await new Promise<void>((resolve, reject) => {
      rspack(
        {
          mode: 'production',
          context: projectDir,
          entry: './index.js',
          output: {
            path: buildDir,
            clean: true,
            filename: () =>
              `[name]-[git-revision-branch]-[git-revision-version].js`,
          },
          plugins: [plugin],
        },
        (err, stats) => {
          if (err) reject(err);
          else if (stats?.hasErrors())
            reject(new Error(stats.toString({ errors: true })));
          else resolve();
        },
      );
    });

    expect(
      fs.existsSync(path.join(buildDir, `main-master-${EXPECTED.version}.js`)),
    ).toBe(true);
  }, 60_000);

  it('substitutes tokens in cssFilename via getPath patch', async () => {
    const { projectDir, buildDir } = prepareFixture('css-path');
    // Fixture package.json is CommonJS; use require for CSS import.
    fs.writeFileSync(
      path.join(projectDir, 'index.js'),
      `require('./style.css');\nconsole.log('css');\n`,
    );
    fs.writeFileSync(
      path.join(projectDir, 'style.css'),
      `body { color: red; }\n`,
    );

    const plugin = new GitRevisionRspackPlugin({
      gitWorkTree: projectDir,
      branch: true,
    });

    await new Promise<void>((resolve, reject) => {
      rspack(
        {
          mode: 'production',
          context: projectDir,
          entry: './index.js',
          output: {
            path: buildDir,
            clean: true,
            filename: '[name].js',
            cssFilename: '[name]-[git-revision-branch]-[git-revision-hash].css',
          },
          experiments: {
            css: true,
          },
          plugins: [plugin],
        },
        (err, stats) => {
          if (err) reject(err);
          else if (stats?.hasErrors())
            reject(new Error(stats.toString({ errors: true })));
          else resolve();
        },
      );
    });

    const files = fs.readdirSync(buildDir);
    expect(
      files.some(
        (f) =>
          f.includes(`master-${EXPECTED.commithash}`) && f.endsWith('.css'),
      ),
    ).toBe(true);
  }, 60_000);
});

describe('feature parity: Rsbuild wrapper API', () => {
  it('exposes the same getters as the Rspack plugin', () => {
    const { projectDir } = prepareFixture('rsbuild-api');
    const plugin = pluginGitRevision({
      gitWorkTree: projectDir,
      branch: true,
    });
    expect(plugin.version()).toBe(EXPECTED.version);
    expect(plugin.commithash()).toBe(EXPECTED.commithash);
    expect(plugin.branch()).toBe(EXPECTED.branch);
    expect(plugin.lastcommitdatetime().length).toBeGreaterThan(0);
  });
});
