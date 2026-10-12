import { describe, expect, it } from '@rstest/core';
import { removeEmptyLines } from '../src/helpers/remove-empty-lines.ts';

describe('removeEmptyLines', () => {
  it('trims trailing whitespace and newlines', () => {
    expect(removeEmptyLines('abc\n')).toBe('abc');
    expect(removeEmptyLines('abc\r\n\r\n')).toBe('abc');
    expect(removeEmptyLines('abc   ')).toBe('abc');
  });

  it('keeps leading and inner whitespace', () => {
    expect(removeEmptyLines('  abc  def')).toBe('  abc  def');
  });
});
