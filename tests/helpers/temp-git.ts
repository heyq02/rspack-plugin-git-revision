import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export interface TempGitRepoOptions {
  /** Initial branch name after first commit. @default 'main' */
  branch?: string;
  /** Detach HEAD after the initial commit. */
  detach?: boolean;
}

/**
 * Create an isolated git repo under the OS temp dir for unit / integration tests.
 */
export function initTempGitRepo(options: TempGitRepoOptions = {}): string {
  const branch = options.branch ?? 'main';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-revision-'));
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], {
    cwd: dir,
  });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'README.md'), 'hello\n');
  execFileSync('git', ['add', 'README.md'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir });
  execFileSync('git', ['branch', '-M', branch], { cwd: dir });

  if (options.detach) {
    const hash = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
    }).trim();
    execFileSync('git', ['checkout', '--detach', hash], { cwd: dir });
  }

  return dir;
}
