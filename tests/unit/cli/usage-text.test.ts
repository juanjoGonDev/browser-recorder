import { describe, expect, it } from 'vitest';

import { usageText } from '../../../src/cli/domain/usage-text.ts';

describe('src/cli/domain/usage-text.ts', () => {
  it.each([
    'replay <name|slug>',
    '-r, --random',
    '-d, --delay <min-max>',
    '--headless',
    '-h, --help',
    '-v, --version',
    '250-900',
    '60000',
    '130',
  ])('documents %s', (fragment) => {
    expect(usageText()).toContain(fragment);
  });

  it('lists the four exit codes and ends with a newline', () => {
    const text = usageText();
    for (const code of ['0 ', '1 ', '2 ', '130']) {
      expect(text).toContain(code);
    }
    expect(text.endsWith('\n')).toBe(true);
  });
});
