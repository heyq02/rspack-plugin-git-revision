import { describe, expect, it } from '@rstest/core';
import { applyPathSubstitutions } from '../src/path-substitutions.ts';

describe('applyPathSubstitutions', () => {
  it('rewrites output filename / publicPath strings', () => {
    const options = {
      output: {
        filename: '[name]-[git-revision-hash].js',
        publicPath: 'https://cdn/[git-revision-version]/',
      },
    };

    applyPathSubstitutions(options, /\[git-revision-hash\]/gi, 'abc');
    applyPathSubstitutions(options, /\[git-revision-version\]/gi, 'v1');

    expect(options.output.filename).toBe('[name]-abc.js');
    expect(options.output.publicPath).toBe('https://cdn/v1/');
  });

  it('rewrites asset/resource generator.filename', () => {
    const options = {
      module: {
        rules: [
          {
            test: /\.txt$/,
            type: 'asset/resource',
            generator: {
              filename: '[name]-[git-revision-version][ext]',
            },
          },
        ],
      },
    };

    applyPathSubstitutions(options, /\[git-revision-version\]/gi, 'v2');
    const rule = options.module.rules[0] as {
      generator: { filename: string };
    };
    expect(rule.generator.filename).toBe('[name]-v2[ext]');
  });

  it('rewrites file-loader options.name', () => {
    const options = {
      module: {
        rules: [
          {
            test: /\.txt$/,
            use: {
              loader: 'file-loader',
              options: {
                name: '[name]-[git-revision-branch].[ext]',
              },
            },
          },
        ],
      },
    };

    applyPathSubstitutions(options, /\[git-revision-branch\]/gi, 'main');
    const rule = options.module.rules[0] as {
      use: { options: { name: string } };
    };
    expect(rule.use.options.name).toBe('[name]-main.[ext]');
  });
});
