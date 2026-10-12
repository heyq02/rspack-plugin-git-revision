import type { Compiler, RspackPluginInstance } from '@rspack/core';
import { buildFile } from './build-file.ts';
import { runGitCommand } from './helpers/run-git-command.ts';

const COMMITHASH_COMMAND = 'rev-parse HEAD';
const VERSION_COMMAND = 'describe --always';
const BRANCH_COMMAND = 'rev-parse --abbrev-ref HEAD';
const LASTCOMMITDATETIME_COMMAND = 'log -1 --format=%cI';

export interface GitRevisionPluginOptions {
  /**
   * Absolute path to the git working tree. Defaults to the current process cwd.
   */
  gitWorkTree?: string;
  /**
   * Git command used for COMMITHASH. Executed without sanitization.
   * @default 'rev-parse HEAD'
   */
  commithashCommand?: string;
  /**
   * Git command used for VERSION. Executed without sanitization.
   * @default 'describe --always' (+ ' --tags' when lightweightTags is true)
   */
  versionCommand?: string;
  /**
   * Emit BRANCH asset and enable `[git-revision-branch]` substitution.
   * @default false
   */
  branch?: boolean;
  /**
   * Git command used for BRANCH. Executed without sanitization.
   * @default 'rev-parse --abbrev-ref HEAD'
   */
  branchCommand?: string;
  /**
   * Git command used for LASTCOMMITDATETIME. Executed without sanitization.
   * @default 'log -1 --format=%cI'
   */
  lastCommitDateTimeCommand?: string;
  /**
   * Append `--tags` to the default version command.
   * Cannot be combined with a custom `versionCommand`.
   * @default false
   */
  lightweightTags?: boolean;
}

/**
 * Rspack port of `git-revision-webpack-plugin`.
 *
 * Emits `VERSION`, `COMMITHASH`, `LASTCOMMITDATETIME` (and optionally `BRANCH`)
 * assets, and supports path substitutions:
 * - `[git-revision-version]`
 * - `[git-revision-hash]`
 * - `[git-revision-branch]` (when `branch: true`)
 * - `[git-revision-last-commit-datetime]`
 */
export class GitRevisionRspackPlugin implements RspackPluginInstance {
  private readonly gitWorkTree?: string;
  private readonly commithashCommand: string;
  private readonly versionCommand: string;
  private readonly createBranchFile: boolean;
  private readonly branchCommand: string;
  private readonly lastCommitDateTimeCommand: string;

  constructor(options: GitRevisionPluginOptions = {}) {
    this.gitWorkTree = options.gitWorkTree;
    this.commithashCommand = options.commithashCommand || COMMITHASH_COMMAND;
    this.versionCommand =
      options.versionCommand ||
      VERSION_COMMAND + (options.lightweightTags ? ' --tags' : '');
    this.createBranchFile = options.branch || false;
    this.branchCommand = options.branchCommand || BRANCH_COMMAND;
    this.lastCommitDateTimeCommand =
      options.lastCommitDateTimeCommand || LASTCOMMITDATETIME_COMMAND;

    if (options.versionCommand && options.lightweightTags) {
      throw new Error("lightweightTags can't be used together versionCommand");
    }
  }

  commithash(): string {
    return runGitCommand(this.gitWorkTree, this.commithashCommand) ?? '';
  }

  version(): string {
    return runGitCommand(this.gitWorkTree, this.versionCommand) ?? '';
  }

  branch(): string {
    return runGitCommand(this.gitWorkTree, this.branchCommand) ?? '';
  }

  lastcommitdatetime(): string {
    return (
      runGitCommand(this.gitWorkTree, this.lastCommitDateTimeCommand) ?? ''
    );
  }

  apply(compiler: Compiler): void {
    buildFile({
      compiler,
      gitWorkTree: this.gitWorkTree,
      command: this.commithashCommand,
      replacePattern: /\[git-revision-hash\]/gi,
      asset: 'COMMITHASH',
    });

    buildFile({
      compiler,
      gitWorkTree: this.gitWorkTree,
      command: this.versionCommand,
      replacePattern: /\[git-revision-version\]/gi,
      asset: 'VERSION',
    });

    buildFile({
      compiler,
      gitWorkTree: this.gitWorkTree,
      command: this.lastCommitDateTimeCommand,
      replacePattern: /\[git-revision-last-commit-datetime\]/gi,
      asset: 'LASTCOMMITDATETIME',
    });

    if (this.createBranchFile) {
      buildFile({
        compiler,
        gitWorkTree: this.gitWorkTree,
        command: this.branchCommand,
        replacePattern: /\[git-revision-branch\]/gi,
        asset: 'BRANCH',
      });
    }
  }
}

/** Alias matching the original webpack plugin export name. */
export { GitRevisionRspackPlugin as GitRevisionPlugin };
