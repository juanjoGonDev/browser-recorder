import { describe, expect, it } from 'vitest';

import { createLineSplitter } from '../../../src/replay/domain/split-lines.ts';

describe('createLineSplitter', () => {
  it('joins a line split across chunks and strips CRLF', () => {
    const splitter = createLineSplitter();

    expect(splitter.push('::ste')).toEqual([]);
    expect(splitter.push('p 3\r\n')).toEqual(['::step 3']);
  });

  it('emits several complete lines from one chunk and keeps the tail', () => {
    const splitter = createLineSplitter();

    expect(splitter.push('a\nb\r\nc')).toEqual(['a', 'b']);
    expect(splitter.push('d\n')).toEqual(['cd']);
  });

  it('flushes an unterminated tail once and then is empty', () => {
    const splitter = createLineSplitter();
    splitter.push('last words');

    expect(splitter.flush()).toEqual(['last words']);
    expect(splitter.flush()).toEqual([]);
  });

  it('keeps blank lines out of the result', () => {
    const splitter = createLineSplitter();

    expect(splitter.push('\n\nx\n')).toEqual(['x']);
  });
});
