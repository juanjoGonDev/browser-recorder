import { describe, expect, it } from 'vitest';

import { describeStep } from '../../../src/cli/domain/describe-step.ts';
import type { Target } from '../../../src/shared/domain/locator.ts';
import type { RecordingEvent } from '../../../src/shared/domain/recording-event.ts';

const SAVE: Target = {
  locator: { kind: 'role', role: 'button', name: 'Save' },
  nth: null,
  framePath: [],
  description: 'Save button',
};
const EMAIL: Target = { ...SAVE, description: 'Email' };
const BASE = { offsetMs: 0, pageId: 'page1' } as const;

describe('src/cli/domain/describe-step.ts', () => {
  it.each([
    [
      { ...BASE, kind: 'click', target: SAVE, button: 'left', modifiers: [] },
      { kind: 'click', target: 'Save button' },
    ],
    [
      { ...BASE, kind: 'hover', target: EMAIL },
      { kind: 'hover', target: 'Email' },
    ],
    [
      {
        ...BASE,
        kind: 'goto',
        url: 'https://example.com/a/b?token=secret#frag',
      },
      { kind: 'goto', target: 'https://example.com/a/b' },
    ],
    [
      { ...BASE, kind: 'press', target: null, key: 'Enter' },
      { kind: 'press', target: 'Enter' },
    ],
    [
      { ...BASE, kind: 'press', target: EMAIL, key: 'Tab' },
      { kind: 'press', target: 'Tab in Email' },
    ],
    [
      { ...BASE, kind: 'scroll', target: null, x: 0, y: 640 },
      { kind: 'scroll', target: 'x 0, y 640' },
    ],
    [
      { ...BASE, kind: 'drag-and-drop', source: SAVE, target: EMAIL },
      { kind: 'drag-and-drop', target: 'Save button → Email' },
    ],
    [
      { ...BASE, kind: 'reload' },
      { kind: 'reload', target: '' },
    ],
    [
      { ...BASE, kind: 'dblclick', target: SAVE, modifiers: [] },
      { kind: 'dblclick', target: 'Save button' },
    ],
    [
      { ...BASE, kind: 'check', target: SAVE, checked: true },
      { kind: 'check', target: 'Save button' },
    ],
    [
      { ...BASE, kind: 'wait-for-url', url: 'https://example.com/done?x=1' },
      { kind: 'wait-for-url', target: 'https://example.com/done' },
    ],
    [
      { ...BASE, kind: 'go-back' },
      { kind: 'go-back', target: '' },
    ],
    [
      { ...BASE, kind: 'go-forward' },
      { kind: 'go-forward', target: '' },
    ],
    [
      { ...BASE, kind: 'page-closed' },
      { kind: 'page-closed', target: '' },
    ],
    [
      {
        ...BASE,
        pageId: 'page2',
        kind: 'page-opened',
        openerPageId: 'page1',
        cause: 'action',
        url: 'https://example.com/b?x=1',
      },
      { kind: 'page-opened', target: '[page2] https://example.com/b' },
    ],
    [
      { ...BASE, kind: 'set-input-files', fileNames: ['a.txt', 'b.txt'] },
      { kind: 'set-input-files', target: '2 files' },
    ],
    [
      { ...BASE, kind: 'set-input-files', fileNames: ['a.txt'] },
      { kind: 'set-input-files', target: '1 file' },
    ],
  ] as const)('describes %j', (event, expected) => {
    expect(describeStep(event as unknown as RecordingEvent)).toStrictEqual(
      expected,
    );
  });

  it('never prints a typed value, even a sensitive one', () => {
    const fill = describeStep({
      ...BASE,
      kind: 'fill',
      target: EMAIL,
      value: 'hunter2',
      isSensitive: true,
    });
    const select = describeStep({
      ...BASE,
      kind: 'select-option',
      target: EMAIL,
      values: ['hunter2'],
    });
    const dialog = describeStep({
      ...BASE,
      kind: 'dialog',
      dialogType: 'prompt',
      message: 'hunter2?',
      action: 'accept',
      promptText: 'hunter2',
    });
    expect(fill).toStrictEqual({ kind: 'fill', target: 'Email' });
    expect(select).toStrictEqual({ kind: 'select-option', target: 'Email' });
    expect(dialog).toStrictEqual({ kind: 'dialog', target: 'prompt → accept' });
    expect(JSON.stringify([fill, select, dialog])).not.toContain('hunter2');
  });

  it('marks a step on another tab and strips control characters', () => {
    const description = describeStep({
      ...BASE,
      pageId: 'page2',
      kind: 'hover',
      target: { ...EMAIL, description: 'Evil\u001b[2J' },
    });
    expect(description).toStrictEqual({
      kind: 'hover',
      target: '[page2] Evil·[2J',
    });
  });

  it.each([
    ['about:blank', 'about:blank'],
    ['https://user:pw@example.com/a?x=1#y', 'https://example.com/a'],
    ['https://example.com', 'https://example.com/'],
  ])('shows only where %s points', (url, shown) => {
    expect(describeStep({ ...BASE, kind: 'goto', url })).toStrictEqual({
      kind: 'goto',
      target: shown,
    });
  });

  it('keeps an unparsable url as it is, without a query', () => {
    expect(
      describeStep({ ...BASE, kind: 'goto', url: 'not a url?x=1' }),
    ).toStrictEqual({ kind: 'goto', target: 'not a url' });
  });
});
