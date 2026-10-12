import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '../..');
export const fixturesRoot = path.join(repoRoot, 'fixtures');
export const sourceProject = path.join(fixturesRoot, 'project');
export const sourceGitRepository = path.join(fixturesRoot, 'git-repository');

export const EXPECTED = {
  commithash: '9a15b3ba1f8c347f9db94bcfde9630ed4fdeb1b2',
  version: 'v1.0.0-1-g9a15b3b',
  versionLightweight: 'v2.0.0-beta',
  branch: 'master',
} as const;

export interface PreparedFixture {
  projectDir: string;
  buildDir: string;
}

/**
 * Copy the upstream git-revision-webpack-plugin fixtures into an isolated tmp dir.
 */
export function prepareFixture(label: string): PreparedFixture {
  const base = path.join(repoRoot, 'tmp', label);
  const projectDir = path.join(base, 'project');
  const buildDir = path.join(base, 'build');
  const gitDir = path.join(projectDir, '.git');

  fs.rmSync(base, { recursive: true, force: true });
  fs.mkdirSync(projectDir, { recursive: true });
  fs.cpSync(sourceProject, projectDir, { recursive: true });
  fs.cpSync(sourceGitRepository, gitDir, { recursive: true });

  return { projectDir, buildDir };
}

export function readAsset(buildDir: string, name: string): string {
  return fs.readFileSync(path.join(buildDir, name), 'utf8');
}

export function assetExists(buildDir: string, name: string): boolean {
  return fs.existsSync(path.join(buildDir, name));
}

export function listBuildFiles(buildDir: string): string[] {
  if (!fs.existsSync(buildDir)) return [];
  return fs.readdirSync(buildDir).sort();
}
