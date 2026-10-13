import type { ChangelogConfig } from 'changelogen';

/** Changelog lives on GitHub Releases (via CI changelogithub); do not write CHANGELOG.md. */
export default {
  output: false,
} satisfies Partial<ChangelogConfig>;
