# @heyq02/rspack-plugin-git-revision

<p>
  <a href="https://npmjs.com/package/@heyq02/rspack-plugin-git-revision?activeTab=readme"><img src="https://img.shields.io/npm/v/@heyq02/rspack-plugin-git-revision?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" /></a>
  <a href="https://npmcharts.com/compare/@heyq02/rspack-plugin-git-revision?minimal=true"><img src="https://img.shields.io/npm/dm/@heyq02/rspack-plugin-git-revision.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="downloads" /></a>
  <a href="https://nodejs.org/en/about/previous-releases"><img src="https://img.shields.io/node/v/@heyq02/rspack-plugin-git-revision.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="node version"></a>
  <a href="https://github.com/heyq02/rspack-plugin-git-revision/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="license" /></a>
</p>

Rspack / Rsbuild port of [`git-revision-webpack-plugin`](https://github.com/pirelenito/git-revision-webpack-plugin).

Emits `VERSION`, `COMMITHASH`, `LASTCOMMITDATETIME`, and optionally `BRANCH` during build, based on a local git repository.

## Features

- Emit `VERSION` / `COMMITHASH` / `LASTCOMMITDATETIME` assets (and `BRANCH` when enabled)
- Public API getters for DefinePlugin-style defines
- Path tokens in `output.filename` / `publicPath` / CSS / asset modules
- Watch rebuilds refresh path tokens when git HEAD changes
- Custom git commands, `lightweightTags`, `gitWorkTree`
- Rsbuild plugin: `pluginGitRevision()` with the same getters
- Tooling via [Rstack CLI](https://rstack.rs/) + [`@heyq02/rstack-config`](https://github.com/heyq02/rstack-config)

## Install

```bash
pnpm add -D @heyq02/rspack-plugin-git-revision
```

Peer: `@rspack/core`. Optional peer: `@rsbuild/core` (only for the Rsbuild wrapper).

## Usage

### Rspack

```js
import { DefinePlugin } from '@rspack/core';
import { GitRevisionRspackPlugin } from '@heyq02/rspack-plugin-git-revision';

const gitRevisionPlugin = new GitRevisionRspackPlugin({ branch: true });

export default {
  output: {
    filename: '[name]-[git-revision-hash].js',
    publicPath: 'https://cdn.example.com/[git-revision-version]/',
  },
  plugins: [
    gitRevisionPlugin,
    new DefinePlugin({
      VERSION: JSON.stringify(gitRevisionPlugin.version()),
      COMMITHASH: JSON.stringify(gitRevisionPlugin.commithash()),
      BRANCH: JSON.stringify(gitRevisionPlugin.branch()),
      LASTCOMMITDATETIME: JSON.stringify(
        gitRevisionPlugin.lastcommitdatetime(),
      ),
    }),
  ],
};
```

### Rsbuild

```js
import { defineConfig } from '@rsbuild/core';
import { pluginGitRevision } from '@heyq02/rspack-plugin-git-revision';

export default defineConfig({
  plugins: [pluginGitRevision({ branch: true })],
});
```

### Path substitutions

- `[git-revision-version]`
- `[git-revision-hash]`
- `[git-revision-branch]` (only when `branch: true`)
- `[git-revision-last-commit-datetime]`

Rspack has no `compilation.hooks.assetPath`, so this plugin mirrors webpack by:

1. Keeping the original tokenized templates and re-materializing substituted values on each git refresh (filename-like fields use live functions so watch rebuilds pick up a new HEAD)
2. Patching `compilation.getPath` / `getAssetPath` for late paths (CSS, assets)
3. Syncing refreshed values onto `compilation.outputOptions` after `optimizeTree`

### Plugin API

```js
const plugin = new GitRevisionRspackPlugin({ branch: true });

plugin.version();
plugin.commithash();
plugin.branch();
plugin.lastcommitdatetime();
```

`GitRevisionPlugin` is exported as an alias of `GitRevisionRspackPlugin`.

## Options

| Option                      | Default                       | Description                                    |
| --------------------------- | ----------------------------- | ---------------------------------------------- |
| `gitWorkTree`               | `undefined`                   | Absolute path to the git work tree             |
| `commithashCommand`         | `rev-parse HEAD`              | Git command for `COMMITHASH`                   |
| `versionCommand`            | `describe --always`           | Git command for `VERSION`                      |
| `branch`                    | `false`                       | Emit `BRANCH` and enable branch substitution   |
| `branchCommand`             | `rev-parse --abbrev-ref HEAD` | Git command for `BRANCH`                       |
| `lastCommitDateTimeCommand` | `log -1 --format=%cI`         | Git command for `LASTCOMMITDATETIME`           |
| `lightweightTags`           | `false`                       | Append `--tags` to the default version command |

Custom `*Command` options are appended to a shell `git …` invocation **without sanitization**, matching [`git-revision-webpack-plugin`](https://github.com/pirelenito/git-revision-webpack-plugin) (intentional parity, not a hardening gap). Do not pass untrusted input.

## Feature parity

| Feature                                               | `git-revision-webpack-plugin` | `@heyq02/rspack-plugin-git-revision`       |
| ----------------------------------------------------- | ----------------------------- | ------------------------------------------ |
| Emit `VERSION` / `COMMITHASH` / `LASTCOMMITDATETIME`  | ✅                            | ✅                                         |
| Emit `BRANCH` when `branch: true`                     | ✅                            | ✅                                         |
| Public API getters                                    | ✅                            | ✅ (+ Rsbuild wrapper getters)             |
| Path tokens in `output.filename` / `publicPath`       | ✅ (`assetPath`)              | ✅ (live rematerialize + `getPath` patch)  |
| Watch rebuild refreshes path tokens after new commit  | ✅ (`assetPath`)              | ✅ (live templates + `outputOptions` sync) |
| `output.filename` as function                         | ✅ (#39)                      | ✅                                         |
| CSS / asset module path tokens                        | ✅ (`assetPath`)              | ✅ (`getPath` patch)                       |
| `lightweightTags` / custom `*Command` / `gitWorkTree` | ✅                            | ✅                                         |
| Shell-based custom git commands                       | ✅                            | ✅                                         |
| Rsbuild plugin                                        | ❌                            | ✅ `pluginGitRevision()`                   |

## Development

Tooling matches [`@heyq02/rstack-config`](https://github.com/heyq02/rstack-config):

```bash
pnpm install
pnpm run build
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:parity
pnpm run format   # automd + rs fmt
pnpm run check    # rs check + typecheck
pnpm release      # global bumpp: bump, commit, tag, push
pnpm play:rspack
pnpm play:rsbuild
```

### Test matrix

| Suite                                                        | What it covers                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `tests/unit-options.test.ts` / `tests/integration.test.ts`   | Options, getters, emit against a temp git repo                             |
| `tests/build-git-command.test.ts` / `tests/git-edge.test.ts` | Shell command builder + detached HEAD / describe edges                     |
| `tests/path-substitutions.test.ts`                           | `[git-revision-*]` rewriting on `output` / rules                           |
| `tests/fixture-integration.test.ts`                          | Upstream fixture values on Rspack                                          |
| `tests/webpack-parity.test.ts`                               | Side-by-side asset / filename parity                                       |
| `tests/feature-parity.test.ts`                               | Documented API / path / CSS / custom-command parity                        |
| `tests/p0-drop-in.test.ts`                                   | chunkFilename / datetime tokens, negative git, DefinePlugin                |
| `tests/p1-assetpath.test.ts`                                 | late getPath, file-loader query, watch + new-commit refresh, Rsbuild build |

Fixtures under `fixtures/` are copied from [`git-revision-webpack-plugin`](https://github.com/pirelenito/git-revision-webpack-plugin) so expected VERSION / COMMITHASH / BRANCH stay bit-identical.

### Release

```bash
pnpm release
```

Uses your globally installed [`bumpp`](https://github.com/antfu-collective/bumpp) to bump, commit, tag, and push. The `v*` tag runs [`.github/workflows/release.yml`](.github/workflows/release.yml) (GitHub Release via [changelogithub](https://github.com/antfu/changelogithub) + npm publish via [sxzz/workflows](https://github.com/sxzz/workflows)). Every push/PR also gets a preview package from [`.github/workflows/release-commit.yml`](.github/workflows/release-commit.yml) (`pkg-pr-new`).

Configure [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) for this GitHub repo so OIDC publish works without `NPM_TOKEN`.

## License

<!-- automd:contributors license=MIT author="heyq02" -->

Published under the [MIT](https://github.com/heyq02/rspack-plugin-git-revision/blob/main/LICENSE) license.
Made by [@heyq02](https://github.com/heyq02) and [community](https://github.com/heyq02/rspack-plugin-git-revision/graphs/contributors) 💛
<br><br>
<a href="https://github.com/heyq02/rspack-plugin-git-revision/graphs/contributors">
<img src="https://contrib.rocks/image?repo=heyq02/rspack-plugin-git-revision" />
</a>

<!-- /automd -->

<!-- automd:with-automd -->

---

_🤖 auto updated with [automd](https://automd.unjs.io)_

<!-- /automd -->
