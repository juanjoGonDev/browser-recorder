import { describe, expect, it } from 'vitest';

import { parseProgressLine } from '../../../src/replay/domain/parse-progress-line.ts';

describe('parseProgressLine', () => {
  it('parses a step marker with its elapsed time', () => {
    expect(parseProgressLine('::step 3 1250')).toEqual({
      kind: 'step',
      index: 3,
      elapsedMs: 1250,
    });
  });

  it('parses a step marker without an elapsed time', () => {
    expect(parseProgressLine('::step 0')).toEqual({
      kind: 'step',
      index: 0,
      elapsedMs: null,
    });
  });

  it('treats a non-numeric step index as noise', () => {
    expect(parseProgressLine('::step abc')).toEqual({
      kind: 'log',
      text: '::step abc',
    });
    expect(parseProgressLine('::step -1 5')).toEqual({
      kind: 'log',
      text: '::step -1 5',
    });
  });

  it('parses done with and without elapsed time', () => {
    expect(parseProgressLine('::done 9000')).toEqual({
      kind: 'done',
      elapsedMs: 9000,
    });
    expect(parseProgressLine('::done')).toEqual({
      kind: 'done',
      elapsedMs: null,
    });
  });

  it('parses an error with a JSON string message and a step index', () => {
    expect(parseProgressLine('::error 4 "locator \\"#a\\" not found"')).toEqual(
      { kind: 'error', index: 4, message: 'locator "#a" not found' },
    );
  });

  it('maps the dash index to null', () => {
    expect(parseProgressLine('::error - "boom"')).toEqual({
      kind: 'error',
      index: null,
      message: 'boom',
    });
  });

  it('falls back to the raw text when the error message is not JSON', () => {
    expect(parseProgressLine('::error 2 not json')).toEqual({
      kind: 'error',
      index: 2,
      message: 'not json',
    });
  });

  it('parses a warning with a JSON string message', () => {
    expect(
      parseProgressLine('::warn "Stopped waiting \\"now\\" for 2 requests"'),
    ).toEqual({
      kind: 'warning',
      message: 'Stopped waiting "now" for 2 requests',
    });
  });

  it('falls back to the raw text when the warning is not JSON', () => {
    expect(parseProgressLine('::warn plain words')).toEqual({
      kind: 'warning',
      message: 'plain words',
    });
  });

  it('keeps a bare warn marker without text as a log line', () => {
    expect(parseProgressLine('::warn')).toEqual({
      kind: 'log',
      text: '::warn',
    });
  });

  it('reports ordinary output as a log line', () => {
    expect(parseProgressLine('hello world')).toEqual({
      kind: 'log',
      text: 'hello world',
    });
  });
});
