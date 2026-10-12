/**
 * P0 drop-in confidence cases for issue #4:
 * chunkFilename + datetime path tokens, negative git failures, DefinePlugin smoke.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { DefinePlugin, rspack } from '@rspack/core';
import { GitRevisionPlugin as WebpackGitRevisionPlugin } from 'git-revision-webpack-plugin';
import { GitRevisionRspackPlugin } from '../src/plugin.ts';
import {
  EXPECTED,
  listBuildFiles,
  prepareFixture,
  repoRoot,
} from './helpers/fixture.ts';
import { buildWithRspack } from './helpers/build-rspack.ts';
import { buildWithWebpack } from './helpers/build-webpack.ts';

function writeLazyEntry(projectDir: string): void {
  // Fixture package.json is CommonJS — keep chunk modules CJS-compatible.
  fs.writeFileSync(
    path.join(projectDir, 'index.js'),
    `import(/* webpackChunkName: "lazy" */ './lazy.js').then((m) => console.log(m));\n`,
  );
  fs.writeFileSync(
    path.join(projectDir, 'lazy.js'),
    `module.exports = 'lazy-chunk';\n`,
  );
}

describe('P0: chunkFilename path tokens', () => {
  it('resolves chunkFilename identically for webpack and rspack', async () => {
    const webpackFx = prepareFixture('p0-chunk-w');
    const rspackFx = prepareFixture('p0-chunk-r');
    writeLazyEntry(webpackFx.projectDir);
    writeLazyEntry(rspackFx.projectDir);

    const options = { branch: true as const };
    const output = {
      filename: '[name].js',
      chunkFilename:
        'chunks/[name]-[git-revision-branch]-[git-revision-hash].js',
      publicPath: 'auto',
    };

    await Promise.all([
      buildWithWebpack(webpackFx.projectDir, webpackFx.buildDir, options, {
        output,
      }),
      buildWithRspack(rspackFx.projectDir, rspackFx.buildDir, options, {
        output,
      }),
    ]);

    const expectedChunk = `chunks/lazy-master-${EXPECTED.commithash}.js`;
    const webpackFiles = listBuildFiles(webpackFx.buildDir);
    const rspackFiles = listBuildFiles(rspackFx.buildDir);

    // Nested chunks/ dir — listBuildFiles is flat; check via readdir recursive.
    const webpackHas = fs.existsSync(
      path.join(webpackFx.buildDir, expectedChunk),
    );
    const rspackHas = fs.existsSync(
      path.join(rspackFx.buildDir, expectedChunk),
    );
    expect(webpackHas).toBe(true);
    expect(rspackHas).toBe(true);
    expect(webpackFiles).toContain('main.js');
    expect(rspackFiles).toContain('main.js');
  }, 90_000);
});

describe('P0: last-commit-datetime path tokens', () => {
  it('resolves datetime tokens in filename and publicPath side-by-side', async () => {
    const webpackFx = prepareFixture('p0-dt-w');
    const rspackFx = prepareFixture('p0-dt-r');
    fs.writeFileSync(
      path.join(webpackFx.projectDir, 'index.js'),
      `console.log(1);\n`,
    );
    fs.writeFileSync(
      path.join(rspackFx.projectDir, 'index.js'),
      `console.log(1);\n`,
    );

    const probe = new GitRevisionRspackPlugin({
      gitWorkTree: webpackFx.projectDir,
    });
    const datetime = probe.lastcommitdatetime();
    expect(datetime.length).toBeGreaterThan(0);

    const options = {};
    const output = {
      filename: '[name]-[git-revision-last-commit-datetime].js',
      publicPath: 'https://cdn.example/[git-revision-last-commit-datetime]/',
    };

    const [webpackResult, rspackResult] = await Promise.all([
      buildWithWebpack(webpackFx.projectDir, webpackFx.buildDir, options, {
        output,
      }),
      buildWithRspack(rspackFx.projectDir, rspackFx.buildDir, options, {
        output,
      }),
    ]);

    const expectedJs = `main-${datetime}.js`;
    expect(fs.existsSync(path.join(webpackFx.buildDir, expectedJs))).toBe(true);
    expect(fs.existsSync(path.join(rspackFx.buildDir, expectedJs))).toBe(true);
    expect(webpackResult.publicPath).toBe(`https://cdn.example/${datetime}/`);
    expect(rspackResult.publicPath).toBe(`https://cdn.example/${datetime}/`);
  }, 90_000);
});

describe('P0: negative git failures', () => {
  it('getters throw when gitWorkTree is not a git repository', () => {
    const base = path.join(repoRoot, 'tmp', 'p0-no-git');
    fs.rmSync(base, { recursive: true, force: true });
    fs.mkdirSync(base, { recursive: true });

    const webpackPlugin = new WebpackGitRevisionPlugin({ gitWorkTree: base });
    const rspackPlugin = new GitRevisionRspackPlugin({ gitWorkTree: base });

    expect(() => webpackPlugin.version()).toThrow();
    expect(() => rspackPlugin.version()).toThrow();
    expect(() => rspackPlugin.commithash()).toThrow();
    expect(() => rspackPlugin.lastcommitdatetime()).toThrow();
  });

  it('getters throw on a failing custom command', () => {
    const { projectDir } = prepareFixture('p0-bad-cmd-api');
    const options = {
      gitWorkTree: projectDir,
      commithashCommand: 'rev-parse NOT_A_REAL_REF_xyz',
    };
    const webpackPlugin = new WebpackGitRevisionPlugin(options);
    const rspackPlugin = new GitRevisionRspackPlugin(options);

    expect(() => webpackPlugin.commithash()).toThrow();
    expect(() => rspackPlugin.commithash()).toThrow();
  });

  it('build fails in optimizeTree when custom command fails', async () => {
    const { projectDir, buildDir } = prepareFixture('p0-bad-cmd-build');
    fs.writeFileSync(path.join(projectDir, 'index.js'), `console.log(1);\n`);

    const plugin = new GitRevisionRspackPlugin({
      gitWorkTree: projectDir,
      commithashCommand: 'rev-parse NOT_A_REAL_REF_xyz',
    });

    await expect(
      new Promise<void>((resolve, reject) => {
        rspack(
          {
            mode: 'production',
            context: projectDir,
            entry: './index.js',
            output: {
              path: buildDir,
              clean: true,
              filename: '[name].js',
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
      }),
    ).rejects.toThrow();
  }, 60_000);

  it('build fails when gitWorkTree has no .git directory', async () => {
    const base = path.join(repoRoot, 'tmp', 'p0-no-git-build');
    const projectDir = path.join(base, 'project');
    const buildDir = path.join(base, 'build');
    fs.rmSync(base, { recursive: true, force: true });
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'index.js'), `console.log(1);\n`);

    const plugin = new GitRevisionRspackPlugin({ gitWorkTree: projectDir });

    await expect(
      new Promise<void>((resolve, reject) => {
        rspack(
          {
            mode: 'production',
            context: projectDir,
            entry: './index.js',
            output: {
              path: buildDir,
              clean: true,
              filename: '[name].js',
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
      }),
    ).rejects.toThrow();
  }, 60_000);
});

describe('P0: DefinePlugin smoke', () => {
  it('inlines getter values into the bundle', async () => {
    const { projectDir, buildDir } = prepareFixture('p0-define');
    const plugin = new GitRevisionRspackPlugin({
      gitWorkTree: projectDir,
      branch: true,
    });

    const version = plugin.version();
    const hash = plugin.commithash();
    const branch = plugin.branch();
    const datetime = plugin.lastcommitdatetime();

    fs.writeFileSync(
      path.join(projectDir, 'index.js'),
      [
        'console.log(GIT_VERSION);',
        'console.log(GIT_COMMITHASH);',
        'console.log(GIT_BRANCH);',
        'console.log(GIT_LASTCOMMITDATETIME);',
      ].join('\n'),
    );

    await new Promise<void>((resolve, reject) => {
      rspack(
        {
          mode: 'production',
          context: projectDir,
          entry: './index.js',
          output: {
            path: buildDir,
            clean: true,
            filename: 'main.js',
          },
          plugins: [
            plugin,
            new DefinePlugin({
              GIT_VERSION: JSON.stringify(version),
              GIT_COMMITHASH: JSON.stringify(hash),
              GIT_BRANCH: JSON.stringify(branch),
              GIT_LASTCOMMITDATETIME: JSON.stringify(datetime),
            }),
          ],
        },
        (err, stats) => {
          if (err) reject(err);
          else if (stats?.hasErrors())
            reject(new Error(stats.toString({ errors: true })));
          else resolve();
        },
      );
    });

    const bundle = fs.readFileSync(path.join(buildDir, 'main.js'), 'utf8');
    expect(bundle).toContain(version);
    expect(bundle).toContain(hash);
    expect(bundle).toContain(branch);
    expect(bundle).toContain(datetime);
    expect(version).toBe(EXPECTED.version);
    expect(hash).toBe(EXPECTED.commithash);
    expect(branch).toBe(EXPECTED.branch);
  }, 60_000);
});
