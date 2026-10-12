# @heyq02/rspack-plugin-git-revision

Rspack / Rsbuild port of [`git-revision-webpack-plugin`](https://github.com/pirelenito/git-revision-webpack-plugin).

Emits `VERSION`, `COMMITHASH`, `LASTCOMMITDATETIME`, and optionally `BRANCH` during build, based on a local git repository.

## Install

```bash
npm install -D @heyq02/rspack-plugin-git-revision
# or
pnpm add -D @heyq02/rspack-plugin-git-revision
```

## Rspack

```js
import { DefinePlugin } from '@rspack/core'
import { GitRevisionRspackPlugin } from '@heyq02/rspack-plugin-git-revision'

const gitRevisionPlugin = new GitRevisionRspackPlugin({ branch: true })

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
      LASTCOMMITDATETIME: JSON.stringify(gitRevisionPlugin.lastcommitdatetime()),
    }),
  ],
}
```

## Rsbuild

```js
import { defineConfig } from '@rsbuild/core'
import { pluginGitRevision } from '@heyq02/rspack-plugin-git-revision'

export default defineConfig({
  plugins: [
    pluginGitRevision({ branch: true }),
  ],
})
```

## Path substitutions

- `[git-revision-version]`
- `[git-revision-hash]`
- `[git-revision-branch]` (only when `branch: true`)
- `[git-revision-last-commit-datetime]`

> Rspack does not expose webpack's `compilation.hooks.assetPath`, so substitutions are applied to string `output` fields (`filename`, `chunkFilename`, `publicPath`, …) when the plugin is applied.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `gitWorkTree` | `undefined` | Absolute path to the git work tree |
| `commithashCommand` | `rev-parse HEAD` | Git command for `COMMITHASH` |
| `versionCommand` | `describe --always` | Git command for `VERSION` |
| `branch` | `false` | Emit `BRANCH` and enable branch substitution |
| `branchCommand` | `rev-parse --abbrev-ref HEAD` | Git command for `BRANCH` |
| `lastCommitDateTimeCommand` | `log -1 --format=%cI` | Git command for `LASTCOMMITDATETIME` |
| `lightweightTags` | `false` | Append `--tags` to the default version command |

Custom git commands are executed without sanitization — do not pass untrusted input.

## Plugin API

```js
const plugin = new GitRevisionRspackPlugin({ branch: true })

plugin.version()
plugin.commithash()
plugin.branch()
plugin.lastcommitdatetime()
```

`GitRevisionPlugin` is exported as an alias of `GitRevisionRspackPlugin`.

## Development

Tooling is [Rstack CLI](https://github.com/rstackjs/rstack-cli) + [`@heyq02/rstack-config`](https://github.com/heyq02/rstack-config).

```bash
pnpm install
pnpm build          # rs lib
pnpm test           # rs test
pnpm test:parity
pnpm lint           # rs lint
pnpm check          # rs check
pnpm play:rspack
pnpm play:rsbuild
```

## Release

Same flow as [`@heyq02/rstack-config`](https://github.com/heyq02/rstack-config):

```bash
pnpm release          # bump version + CHANGELOG + git tag (no GitHub release)
git push --follow-tags
```

Pushing a `v*` tag runs [`.github/workflows/release.yml`](.github/workflows/release.yml) (npm publish via [sxzz/workflows](https://github.com/sxzz/workflows)). Every push/PR also gets a preview package from [`.github/workflows/release-commit.yml`](.github/workflows/release-commit.yml) (`pkg-pr-new`).

Configure [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) for this GitHub repo so OIDC publish works without `NPM_TOKEN`.

### Test matrix

| Suite | What it covers |
| --- | --- |
| `tests/plugin.test.ts` / `tests/unit-options.test.ts` | Options + public API against a temp git repo |
| `tests/path-substitutions.test.ts` | `[git-revision-*]` rewriting on `output` / rules |
| `tests/fixture-integration.test.ts` | Upstream fixture values (`v1.0.0-1-g9a15b3b`, etc.) on Rspack |
| `tests/webpack-parity.test.ts` | Side-by-side: `git-revision-webpack-plugin` vs this plugin on the same fixtures |

Fixtures under `fixtures/` are copied from [`git-revision-webpack-plugin`](https://github.com/pirelenito/git-revision-webpack-plugin) so expected VERSION / COMMITHASH / BRANCH stay bit-identical.

## License

MIT
