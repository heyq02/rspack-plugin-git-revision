import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from '@rstest/core';
import { rspack } from '@rspack/core';
import { GitRevisionRspackPlugin } from '../src/plugin.ts';

function initTempGitRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-revision-'));
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], {
    cwd: dir,
  });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'README.md'), 'hello\n');
  execFileSync('git', ['add', 'README.md'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir });
  execFileSync('git', ['branch', '-M', 'main'], { cwd: dir });
  return dir;
}

describe('GitRevisionRspackPlugin integration', () => {
  it('emits VERSION / COMMITHASH / BRANCH / LASTCOMMITDATETIME', async () => {
    const gitWorkTree = initTempGitRepo();
    const outDir = path.join(gitWorkTree, 'dist');
    const entry = path.join(gitWorkTree, 'index.js');
    fs.writeFileSync(entry, 'export default 1;\n');

    const plugin = new GitRevisionRspackPlugin({
      gitWorkTree,
      branch: true,
    });

    await new Promise<void>((resolve, reject) => {
      rspack(
        {
          mode: 'production',
          entry,
          output: {
            path: outDir,
            filename: 'main.js',
            clean: true,
          },
          plugins: [plugin],
        },
        (err, stats) => {
          if (err) {
            reject(err);
            return;
          }
          if (stats?.hasErrors()) {
            reject(new Error(stats.toString({ all: false, errors: true })));
            return;
          }
          resolve();
        },
      );
    });

    const version = fs.readFileSync(path.join(outDir, 'VERSION'), 'utf8');
    const hash = fs.readFileSync(path.join(outDir, 'COMMITHASH'), 'utf8');
    const branch = fs.readFileSync(path.join(outDir, 'BRANCH'), 'utf8');
    const datetime = fs.readFileSync(
      path.join(outDir, 'LASTCOMMITDATETIME'),
      'utf8',
    );

    expect(hash).toMatch(/^[0-9a-f]{40}$/);
    expect(version.length).toBeGreaterThan(0);
    expect(branch).toBe('main');
    expect(datetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(plugin.commithash()).toBe(hash);
    expect(plugin.version()).toBe(version);
    expect(plugin.branch()).toBe(branch);
  }, 60_000);
});
