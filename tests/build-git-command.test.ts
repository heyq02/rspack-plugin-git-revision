import path from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { buildGitCommand } from '../src/helpers/run-git-command.ts';

describe('buildGitCommand', () => {
  it('builds a plain shell command without gitWorkTree', () => {
    expect(buildGitCommand(undefined, 'rev-parse HEAD')).toBe(
      'git rev-parse HEAD',
    );
  });

  it('adds --git-dir / --work-tree when gitWorkTree is set', () => {
    const workTree = path.join('/tmp', 'repo');
    expect(buildGitCommand(workTree, 'rev-parse HEAD')).toBe(
      [
        'git',
        `--git-dir=${path.join(workTree, '.git')}`,
        `--work-tree=${workTree}`,
        'rev-parse HEAD',
      ].join(' '),
    );
  });

  it('appends shell-y custom commands unsanitized (upstream parity)', () => {
    const workTree = path.join(path.sep, 'repo');
    const command = 'rev-list --max-count=1 --no-merges HEAD && echo done';
    expect(buildGitCommand(workTree, command)).toBe(
      [
        'git',
        `--git-dir=${path.join(workTree, '.git')}`,
        `--work-tree=${workTree}`,
        command,
      ].join(' '),
    );
  });
});
