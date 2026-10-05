import { describe, expect, it } from 'vitest';

import type { Target } from '../../../src/shared/domain/locator.ts';
import type { RecordingEvent } from '../../../src/shared/domain/recording-event.ts';
import {
  describeEvent,
  MASKED_VALUE,
} from '../../../src/tui/render/describe-event.ts';

function targetOf(description: string): Target {
  return {
    locator: { kind: 'css', selector: '#x' },
    nth: null,
    framePath: [],
    description,
  };
}

const base = { offsetMs: 0, pageId: 'page1' } as const;

describe('src/tui/render/describe-event.ts', () => {
  it('uses the event kind as the label', () => {
    expect(describeEvent({ ...base, kind: 'reload' })).toEqual({
      label: 'reload',
      detail: '',
    });
    expect(describeEvent({ ...base, kind: 'go-back' }).label).toBe('go-back');
  });

  it('shows the url of navigations', () => {
    const goto: RecordingEvent = {
      ...base,
      kind: 'goto',
      url: 'https://example.com/a',
    };
    expect(describeEvent(goto).detail).toBe('https://example.com/a');
  });

  it('describes clicks with the target, a non-left button and modifiers', () => {
    const plain: RecordingEvent = {
      ...base,
      kind: 'click',
      target: targetOf('Button "Save"'),
      button: 'left',
      modifiers: [],
    };
    expect(describeEvent(plain).detail).toBe('Button "Save"');
    const special: RecordingEvent = {
      ...plain,
      button: 'right',
      modifiers: ['Shift', 'Control'],
    };
    expect(describeEvent(special).detail).toBe(
      'Button "Save" · right · Shift+Control',
    );
  });

  it('shows typed values but masks sensitive ones, whatever their length', () => {
    const visible: RecordingEvent = {
      ...base,
      kind: 'fill',
      target: targetOf('Email'),
      value: 'a@b.co',
      isSensitive: false,
    };
    expect(describeEvent(visible).detail).toBe('Email = a@b.co');
    const secret: RecordingEvent = {
      ...visible,
      target: targetOf('Password'),
      value: 'hunter2-very-long-secret',
      isSensitive: true,
    };
    const detail = describeEvent(secret).detail;
    expect(detail).toBe(`Password = ${MASKED_VALUE}`);
    expect(detail).not.toContain('hunter2');
    expect(describeEvent({ ...secret, value: 'x' }).detail).toBe(detail);
  });

  it('describes the remaining kinds', () => {
    const t = targetOf('Menu');
    expect(
      describeEvent({ ...base, kind: 'check', target: t, checked: true })
        .detail,
    ).toBe('Menu · checked');
    expect(
      describeEvent({ ...base, kind: 'check', target: t, checked: false })
        .detail,
    ).toBe('Menu · unchecked');
    expect(describeEvent({ ...base, kind: 'hover', target: t }).detail).toBe(
      'Menu',
    );
    expect(
      describeEvent({ ...base, kind: 'dblclick', target: t, modifiers: [] })
        .detail,
    ).toBe('Menu');
    expect(
      describeEvent({
        ...base,
        kind: 'select-option',
        target: t,
        values: ['a', 'b'],
      }).detail,
    ).toBe('Menu = a, b');
    expect(
      describeEvent({ ...base, kind: 'press', target: null, key: 'Control+K' })
        .detail,
    ).toBe('Control+K');
    expect(
      describeEvent({ ...base, kind: 'press', target: t, key: 'Enter' }).detail,
    ).toBe('Enter in Menu');
    expect(
      describeEvent({ ...base, kind: 'scroll', target: null, x: 0, y: 320 })
        .detail,
    ).toBe('x 0, y 320');
    expect(
      describeEvent({
        ...base,
        kind: 'drag-and-drop',
        source: targetOf('A'),
        target: targetOf('B'),
      }).detail,
    ).toBe('A → B');
    expect(
      describeEvent({
        ...base,
        kind: 'set-input-files',
        fileNames: ['a.png', 'b.png'],
      }).detail,
    ).toBe('a.png, b.png');
    expect(
      describeEvent({ ...base, kind: 'wait-for-url', url: 'https://x.test/' })
        .detail,
    ).toBe('https://x.test/');
    expect(describeEvent({ ...base, kind: 'page-closed' }).detail).toBe('');
    expect(
      describeEvent({
        ...base,
        kind: 'page-opened',
        openerPageId: 'page1',
        cause: 'action',
        url: 'https://x.test/p',
      }).detail,
    ).toBe('https://x.test/p');
  });

  it('describes dialogs with the decision', () => {
    const dialog: RecordingEvent = {
      ...base,
      kind: 'dialog',
      dialogType: 'confirm',
      message: 'Sure?',
      action: 'accept',
      promptText: null,
    };
    expect(describeEvent(dialog).detail).toBe('confirm "Sure?" → accept');
    const prompt: RecordingEvent = {
      ...dialog,
      dialogType: 'prompt',
      promptText: 'Bob',
    };
    expect(describeEvent(prompt).detail).toBe('prompt "Sure?" → accept "Bob"');
  });

  it('tags events that happened on another tab', () => {
    const popup: RecordingEvent = {
      ...base,
      pageId: 'page2',
      kind: 'hover',
      target: targetOf('Menu'),
    };
    expect(describeEvent(popup).detail).toBe('[page2] Menu');
  });

  it('neutralises terminal escapes hidden in recorded text', () => {
    const hostile: RecordingEvent = {
      ...base,
      kind: 'hover',
      target: targetOf('\u001b[2Jpwn\u0007'),
    };
    const detail = describeEvent(hostile).detail;
    expect(detail).not.toContain('\u001b');
    expect(detail).not.toContain('\u0007');
    expect(detail).toBe('·[2Jpwn·');
  });
});
