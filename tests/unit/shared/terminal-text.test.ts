import { describe, expect, it } from 'vitest';

import {
  isColorEnabled,
  sanitize,
} from '../../../src/shared/domain/terminal-text.ts';

describe('src/shared/domain/terminal-text.ts', () => {
  it('honours NO_COLOR and dumb terminals', () => {
    expect(isColorEnabled({})).toBe(true);
    expect(isColorEnabled({ NO_COLOR: '1' })).toBe(false);
    expect(isColorEnabled({ NO_COLOR: '' })).toBe(true);
    expect(isColorEnabled({ TERM: 'dumb' })).toBe(false);
    expect(isColorEnabled({ TERM: 'xterm-256color' })).toBe(true);
  });

  it('replaces every control character so nothing reaches the terminal', () => {
    expect(sanitize('a\u001b[2Jb\nc\u0007')).toBe('a·[2Jb·c·');
    expect(sanitize('tab\there')).toBe('tab·here');
  });

  it('replaces C1 controls and DEL but keeps printable text', () => {
    expect(sanitize('x\u007fy\u009bz')).toBe('x·y·z');
    expect(sanitize('héllo €')).toBe('héllo €');
  });
});
