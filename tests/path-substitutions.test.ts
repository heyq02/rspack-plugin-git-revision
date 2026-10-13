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

    const filename = options.output.filename as string | (() => string);
    const publicPath = options.output.publicPath as string | (() => string);
    expect(typeof filename === 'function' ? filename() : filename).toBe(
      '[name]-abc.js',
    );
    expect(typeof publicPath === 'function' ? publicPath() : publicPath).toBe(
      'https://cdn/v1/',
    );
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
      generator: { filename: string | (() => string) };
    };
    const genFilename = rule.generator.filename;
    expect(
      typeof genFilename === 'function' ? genFilename() : genFilename,
    ).toBe('[name]-v2[ext]');
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
      use: { options: { name: string | (() => string) } };
    };
    const name = rule.use.options.name;
    expect(typeof name === 'function' ? name() : name).toBe(
      '[name]-main.[ext]',
    );
  });
});
