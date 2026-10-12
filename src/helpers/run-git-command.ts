import { exec, execSync } from 'node:child_process';
import path from 'node:path';
import { removeEmptyLines } from './remove-empty-lines.ts';

export type GitCommandCallback = (err: Error | null, output: string) => void;

/**
 * Build the same shell command string as git-revision-webpack-plugin.
 * Custom `*Command` options are appended as-is (unsanitized), matching upstream.
 */
export function buildGitCommand(
  gitWorkTree: string | undefined,
  command: string,
): string {
  return gitWorkTree
    ? [
        'git',
        `--git-dir=${path.join(gitWorkTree, '.git')}`,
        `--work-tree=${gitWorkTree}`,
        command,
      ].join(' ')
    : ['git', command].join(' ');
}

/**
 * Run a git command. Behavior matches git-revision-webpack-plugin
 * (`child_process.exec` / `execSync` with a shell command string).
 */
export function runGitCommand(
  gitWorkTree: string | undefined,
  command: string,
  callback?: GitCommandCallback,
): string | null {
  const gitCommand = buildGitCommand(gitWorkTree, command);

  if (callback) {
    exec(gitCommand, (err, stdout) => {
      if (err) {
        callback(err, '');
        return;
      }
      callback(null, removeEmptyLines(String(stdout)));
    });
    return null;
  }

  return removeEmptyLines(String(execSync(gitCommand)));
}
