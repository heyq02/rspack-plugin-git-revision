import { execFile, execFileSync } from 'node:child_process';
import path from 'node:path';
import { removeEmptyLines } from './remove-empty-lines.ts';

export type GitCommandCallback = (err: Error | null, output: string) => void;

function buildGitArgs(gitWorkTree: string | undefined, command: string): string[] {
  const commandArgs = command.trim().split(/\s+/).filter(Boolean);
  if (!gitWorkTree) {
    return commandArgs;
  }

  return [
    `--git-dir=${path.join(gitWorkTree, '.git')}`,
    `--work-tree=${gitWorkTree}`,
    ...commandArgs,
  ];
}

export function runGitCommand(
  gitWorkTree: string | undefined,
  command: string,
  callback?: GitCommandCallback,
): string | null {
  const args = buildGitArgs(gitWorkTree, command);

  if (callback) {
    execFile('git', args, (err, stdout) => {
      if (err) {
        callback(err, '');
        return;
      }
      callback(null, removeEmptyLines(String(stdout)));
    });
    return null;
  }

  return removeEmptyLines(String(execFileSync('git', args, { encoding: 'utf8' })));
}
