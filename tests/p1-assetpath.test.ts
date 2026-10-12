/**
 * P1 architecture hardening for issue #5:
 * late getPath, upstream file-loader query form, early options mutation / watch,
 * and a full Rsbuild build (not only getters).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { createRsbuild } from '@rsbuild/core';
import { rspack, sources, type Compiler } from '@rspack/core';
import { GitRevisionRspackPlugin } from '../src/plugin.ts';
import { pluginGitRevision } from '../src/rsbuild-plugin.ts';
import { applyPathSubstitutions } from '../src/path-substitutions.ts';
import { EXPECTED, prepareFixture, readAsset } from './helpers/fixture.ts';

describe('P1: late getPath path helpers', () => {
  it('substitutes tokens when a plugin emits via compilation.getPath only', async () => {
    const { projectDir, buildDir } = prepareFixture('p1-late-getpath');
    fs.writeFileSync(path.join(projectDir, 'index.js'), `console.log(1);\n`);

    const gitPlugin = new GitRevisionRspackPlugin({
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
            // Keep output templates free of git tokens so the only
            // substitution path is the getPath patch.
            filename: '[name].js',
          },
          plugins: [
            gitPlugin,
            {
              name: 'EmitViaGetPath',
              apply(compiler: Compiler) {
                compiler.hooks.thisCompilation.tap(
                  'EmitViaGetPath',
                  (compilation) => {
                    compilation.hooks.processAssets.tap(
                      {
                        name: 'EmitViaGetPath',
                        stage:
                          compiler.webpack.Compilation
                            .PROCESS_ASSETS_STAGE_ADDITIONAL,
                      },
                      () => {
                        const name = compilation.getPath(
                          'late-[git-revision-branch]-[git-revision-hash].txt',
                        );
                        compilation.emitAsset(
                          name,
                          new sources.RawSource('via-getPath'),
                        );
                      },
                    );
                  },
                );
              },
            },
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

    const expected = `late-master-${EXPECTED.commithash}.txt`;
    expect(fs.existsSync(path.join(buildDir, expected))).toBe(true);
    expect(fs.readFileSync(path.join(buildDir, expected), 'utf8')).toBe(
      'via-getPath',
    );
    // Token must not leak into the emitted name.
    expect(expected.includes('[git-revision-')).toBe(false);
  }, 60_000);
});

describe('P1: upstream file-loader query form', () => {
  it('rewrites file-loader?name=... string use in applyPathSubstitutions', () => {
    const options = {
      module: {
        rules: [
          {
            test: /\.txt$/,
            use: 'file-loader?name=[name]-[git-revision-branch]-[git-revision-version].[ext]',
          },
        ],
      },
    };

    applyPathSubstitutions(options, /\[git-revision-branch\]/gi, 'master');
    applyPathSubstitutions(options, /\[git-revision-version\]/gi, 'v1.0.0');

    const rule = options.module.rules[0] as { use: string };
    expect(rule.use).toBe('file-loader?name=[name]-master-v1.0.0.[ext]');
  });

  it('emits file-loader assets with substituted names (rspack build)', async () => {
    const { projectDir, buildDir } = prepareFixture('p1-file-loader');
    // Match fixtures/project/webpack.config.js query form.
    fs.writeFileSync(
      path.join(projectDir, 'index.js'),
      `require('./outside-resource.txt');\nconsole.log('file-loader');\n`,
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
          },
          module: {
            rules: [
              {
                test: /\.txt$/,
                type: 'javascript/auto',
                use: 'file-loader?name=[name]-[git-revision-branch]-[git-revision-version].[ext]',
              },
            ],
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

    const expectedTxt = `outside-resource-master-${EXPECTED.version}.txt`;
    expect(fs.existsSync(path.join(buildDir, expectedTxt))).toBe(true);
  }, 60_000);
});

describe('P1: early options mutation and watch rebuild', () => {
  it('mutates compiler.options output templates during apply/build', async () => {
    const { projectDir, buildDir } = prepareFixture('p1-early-mutate');
    fs.writeFileSync(path.join(projectDir, 'index.js'), `console.log(1);\n`);

    const plugin = new GitRevisionRspackPlugin({
      gitWorkTree: projectDir,
      branch: true,
    });

    const compiler = rspack({
      mode: 'production',
      context: projectDir,
      entry: './index.js',
      output: {
        path: buildDir,
        clean: true,
        filename: '[name]-[git-revision-hash].js',
        publicPath: 'https://cdn/[git-revision-version]/',
      },
      plugins: [plugin],
    });

    await new Promise<void>((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) reject(err);
        else if (stats?.hasErrors())
          reject(new Error(stats.toString({ errors: true })));
        else resolve();
      });
    });

    const filename = String(compiler.options.output.filename);
    const publicPath = String(compiler.options.output.publicPath);
    expect(filename).toBe(`[name]-${EXPECTED.commithash}.js`);
    expect(publicPath).toBe(`https://cdn/${EXPECTED.version}/`);
    expect(filename.includes('[git-revision-')).toBe(false);
    expect(
      fs.existsSync(path.join(buildDir, `main-${EXPECTED.commithash}.js`)),
    ).toBe(true);

    await new Promise<void>((resolve) => {
      compiler.close(() => resolve());
    });
  }, 60_000);

  it('watch rebuild still emits VERSION after a second compile', async () => {
    const { projectDir, buildDir } = prepareFixture('p1-watch');
    const entry = path.join(projectDir, 'index.js');
    fs.writeFileSync(entry, `console.log('watch-1');\n`);

    const plugin = new GitRevisionRspackPlugin({
      gitWorkTree: projectDir,
      branch: true,
    });

    const compiler = rspack({
      mode: 'development',
      context: projectDir,
      entry: './index.js',
      watch: true,
      output: {
        path: buildDir,
        clean: false,
        filename: '[name]-[git-revision-version].js',
      },
      plugins: [plugin],
    });

    let builds = 0;

    await new Promise<void>((resolve, reject) => {
      const watching = compiler.watch({}, (err, stats) => {
        if (err) {
          watching.close(() => reject(err));
          return;
        }
        if (stats?.hasErrors()) {
          watching.close(() =>
            reject(new Error(stats.toString({ errors: true }))),
          );
          return;
        }

        builds += 1;
        try {
          expect(readAsset(buildDir, 'VERSION')).toBe(EXPECTED.version);
          expect(
            fs.existsSync(path.join(buildDir, `main-${EXPECTED.version}.js`)),
          ).toBe(true);
        } catch (assertionError) {
          watching.close(() => reject(assertionError));
          return;
        }

        if (builds === 1) {
          // Trigger a second compilation.
          fs.writeFileSync(entry, `console.log('watch-2');\n`);
          return;
        }

        watching.close((closeErr) => {
          if (closeErr) reject(closeErr);
          else resolve();
        });
      });
    });

    expect(builds).toBeGreaterThanOrEqual(2);
  }, 90_000);
});

describe('P1: full Rsbuild build', () => {
  it('emits VERSION and substitutes filename tokens via pluginGitRevision', async () => {
    const { projectDir, buildDir } = prepareFixture('p1-rsbuild');
    fs.writeFileSync(
      path.join(projectDir, 'index.js'),
      `console.log('rsbuild');\n`,
    );

    const plugin = pluginGitRevision({
      gitWorkTree: projectDir,
      branch: true,
    });

    const rsbuild = await createRsbuild({
      cwd: projectDir,
      rsbuildConfig: {
        source: {
          entry: {
            index: './index.js',
          },
        },
        output: {
          distPath: {
            root: buildDir,
          },
          filename: {
            js: '[name]-[git-revision-hash].js',
          },
          // Avoid HTML extras for a minimal assert.
          cleanDistPath: true,
        },
        tools: {
          htmlPlugin: false,
        },
        plugins: [plugin],
      },
    });

    await rsbuild.build();

    expect(readAsset(buildDir, 'VERSION')).toBe(EXPECTED.version);
    expect(readAsset(buildDir, 'COMMITHASH')).toBe(EXPECTED.commithash);
    expect(readAsset(buildDir, 'BRANCH')).toBe(EXPECTED.branch);
    expect(plugin.version()).toBe(EXPECTED.version);

    // Rsbuild nests JS under static/js by default.
    const jsPath = path.join(
      buildDir,
      'static',
      'js',
      `index-${EXPECTED.commithash}.js`,
    );
    expect(fs.existsSync(jsPath)).toBe(true);
  }, 90_000);
});
