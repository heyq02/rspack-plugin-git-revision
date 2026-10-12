import { execFileSync } from 'node:child_process';
import { describe, expect, it } from '@rstest/core';
import { GitRevisionRspackPlugin } from '../src/plugin.ts';
import { initTempGitRepo } from './helpers/temp-git.ts';

describe('git edge cases', () => {
  it('reports branch as HEAD when detached', () => {
    const gitWorkTree = initTempGitRepo({ detach: true });
    const plugin = new GitRevisionRspackPlugin({
      gitWorkTree,
      branch: true,
    });

    expect(plugin.branch()).toBe('HEAD');
    expect(plugin.commithash()).toMatch(/^[0-9a-f]{40}$/);
  });

  it('describe --always works on an untagged single-commit repo', () => {
    const gitWorkTree = initTempGitRepo();
    // No tags by default — describe --always should still return a short id.
    const tags = execFileSync('git', ['tag'], {
      cwd: gitWorkTree,
      encoding: 'utf8',
    }).trim();
    expect(tags).toBe('');

    const plugin = new GitRevisionRspackPlugin({ gitWorkTree });
    const version = plugin.version();
    expect(version.length).toBeGreaterThan(0);
    expect(version).toMatch(/^[0-9a-f]+$/i);
  });

  it('lightweightTags can resolve an annotated-less lightweight tag', () => {
    const gitWorkTree = initTempGitRepo();
    execFileSync('git', ['tag', 'v0.0.1-lite'], { cwd: gitWorkTree });

    const without = new GitRevisionRspackPlugin({ gitWorkTree });
    const withLite = new GitRevisionRspackPlugin({
      gitWorkTree,
      lightweightTags: true,
    });

    // Without --tags, lightweight tags are ignored by describe.
    expect(without.version()).not.toBe('v0.0.1-lite');
    expect(withLite.version()).toBe('v0.0.1-lite');
  });
});
