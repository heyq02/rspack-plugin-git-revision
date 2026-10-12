import { describe, expect, it, rstest } from '@rstest/core';
import { GitRevisionRspackPlugin } from '../src/plugin.ts';
import * as runGitModule from '../src/helpers/run-git-command.ts';

describe('custom command options', () => {
  it('rejects lightweightTags with custom versionCommand', () => {
    expect(
      () =>
        new GitRevisionRspackPlugin({
          versionCommand: 'custom',
          lightweightTags: true,
        }),
    ).toThrow("lightweightTags can't be used together versionCommand");
  });

  it('forwards custom commands to runGitCommand for public API', () => {
    const spy = rstest
      .spyOn(runGitModule, 'runGitCommand')
      .mockReturnValue('ok');

    const plugin = new GitRevisionRspackPlugin({
      branch: true,
      commithashCommand: 'custom-hash',
      versionCommand: 'custom-version',
      branchCommand: 'custom-branch',
      lastCommitDateTimeCommand: 'custom-datetime',
    });

    expect(plugin.commithash()).toBe('ok');
    expect(plugin.version()).toBe('ok');
    expect(plugin.branch()).toBe('ok');
    expect(plugin.lastcommitdatetime()).toBe('ok');

    expect(spy).toHaveBeenCalledWith(undefined, 'custom-hash');
    expect(spy).toHaveBeenCalledWith(undefined, 'custom-version');
    expect(spy).toHaveBeenCalledWith(undefined, 'custom-branch');
    expect(spy).toHaveBeenCalledWith(undefined, 'custom-datetime');

    spy.mockRestore();
  });
});
