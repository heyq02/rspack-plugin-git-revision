import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from '@rstest/core';
import { GitRevisionRspackPlugin } from '../src/plugin.ts';

function initTempGitRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-revision-unit-'));
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

describe('GitRevisionRspackPlugin', () => {
  it('throws when lightweightTags is combined with versionCommand', () => {
    expect(
      () =>
        new GitRevisionRspackPlugin({
          versionCommand: 'describe --always --tags',
          lightweightTags: true,
        }),
    ).toThrow("lightweightTags can't be used together versionCommand");
  });

  it('reads git metadata from gitWorkTree', () => {
    const gitWorkTree = initTempGitRepo();
    const plugin = new GitRevisionRspackPlugin({ gitWorkTree, branch: true });
    expect(plugin.commithash()).toMatch(/^[0-9a-f]{40}$/);
    expect(plugin.version().length).toBeGreaterThan(0);
    expect(plugin.branch()).toBe('main');
    expect(plugin.lastcommitdatetime()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
