// Configuration guide: https://rstack.rs/config
import { define } from 'rstack';
import { rstack } from '@heyq02/rstack-config/rstack';

define.extends([
  rstack({
    lib: {
      entry: 'index',
      publint: true,
      attw: true,
    },
    lint: {
      typescript: true,
      node: 'module',
      react: false,
      jest: false,
      rstest: true,
      sortImports: true,
      unusedImports: true,
      regexp: true,
      deMorgan: true,
      eslintComments: true,
    },
    fmt: {
      singleQuote: true,
      printWidth: 100,
    },
    test: {
      extends: {},
      include: ['tests/**/*.test.ts'],
      // Parity / integration suites dominate runtime; keep coverage optional.
      strictCoverage: false,
    },
    staged: {
      formatAll: true,
      lintFix: true,
    },
  }),
]);
