import { describe, expect, it } from 'vitest';
import type { CapturedEvent } from '../../../src/recording-capture/domain/captured-event.ts';
import type { DomSignalInput } from '../../../src/recording-capture/domain/to-recording-event.ts';
import {
  dialogToEvent,
  domSignalToEvent,
} from '../../../src/recording-capture/domain/to-recording-event.ts';
import type { Locator } from '../../../src/shared/domain/locator.ts';

const saveButton: Locator = { kind: 'role', role: 'button', name: 'Save' };
const cssFallback: Locator = { kind: 'css', selector: 'main > button' };

function dom(
  payload: CapturedEvent,
  overrides: Partial<DomSignalInput> = {},
): DomSignalInput {
  return {
    pageId: 'page1',
    framePath: [],
    payload,
    candidates: [saveButton, cssFallback],
    ...overrides,
  };
}

const base = { ageMs: 0, description: 'button "Save"' };

describe('src/recording-capture/domain/to-recording-event.ts', () => {
  describe('domSignalToEvent', () => {
    it('keeps the button and modifiers of a Shift+right click', () => {
      const event = domSignalToEvent(
        dom({ ...base, kind: 'click', button: 'right', modifiers: ['Shift'] }),
        420,
      );
      expect(event).toEqual({
        kind: 'click',
        offsetMs: 420,
        pageId: 'page1',
        target: {
          locator: saveButton,
          nth: null,
          framePath: [],
          description: 'button "Save"',
        },
        button: 'right',
        modifiers: ['Shift'],
      });
    });

    it('carries the frame path and page of the signal into the target', () => {
      const event = domSignalToEvent(
        dom(
          { ...base, kind: 'dblclick', modifiers: [] },
          { pageId: 'page2', framePath: ['iframe#pay'] },
        ),
        10,
      );
      expect(event).toMatchObject({
        kind: 'dblclick',
        pageId: 'page2',
        target: { framePath: ['iframe#pay'] },
      });
    });

    it('stores a hover on the first candidate', () => {
      const event = domSignalToEvent(dom({ ...base, kind: 'hover' }), 5);
      expect(event).toMatchObject({
        kind: 'hover',
        target: { locator: saveButton },
      });
    });

    it.each([true, false])(
      'stores check with checked %s, never a click',
      (isChecked) => {
        const event = domSignalToEvent(
          dom({ ...base, kind: 'check', checked: isChecked }),
          1,
        );
        expect(event).toMatchObject({ kind: 'check', checked: isChecked });
      },
    );

    it('flags a sensitive fill and keeps the plain value', () => {
      const event = domSignalToEvent(
        dom({ ...base, kind: 'input', value: 'hunter2', isSensitive: true }),
        1,
      );
      expect(event).toMatchObject({
        kind: 'fill',
        value: 'hunter2',
        isSensitive: true,
      });
    });

    it('does not flag an ordinary fill', () => {
      const event = domSignalToEvent(
        dom({ ...base, kind: 'input', value: 'hey', isSensitive: false }),
        1,
      );
      expect(event).toMatchObject({ kind: 'fill', isSensitive: false });
    });

    it('maps select to select-option and files to set-input-files', () => {
      expect(
        domSignalToEvent(
          dom({ ...base, kind: 'select', values: ['a', 'b'] }),
          1,
        ),
      ).toMatchObject({ kind: 'select-option', values: ['a', 'b'] });
      expect(
        domSignalToEvent(
          dom({ ...base, kind: 'files', fileNames: ['x.png'] }),
          1,
        ),
      ).toEqual({
        kind: 'set-input-files',
        offsetMs: 1,
        pageId: 'page1',
        fileNames: ['x.png'],
      });
    });

    it('canonicalises a pressed key and leaves the target null with no element', () => {
      const event = domSignalToEvent(
        dom(
          { ...base, kind: 'key', key: 'Shift+Control+K' },
          { candidates: [] },
        ),
        1,
      );
      expect(event).toEqual({
        kind: 'press',
        offsetMs: 1,
        pageId: 'page1',
        target: null,
        key: 'Control+Shift+K',
      });
    });

    it('keeps a key press target when an element has focus', () => {
      const event = domSignalToEvent(
        dom({ ...base, kind: 'key', key: 'Enter' }),
        1,
      );
      expect(event).toMatchObject({
        kind: 'press',
        target: { locator: saveButton },
      });
    });

    it('scrolls a window with a null target and an element with a target', () => {
      const scroll: CapturedEvent = { ...base, kind: 'scroll', x: 0, y: 300 };
      expect(
        domSignalToEvent(dom(scroll, { candidates: [] }), 1),
      ).toMatchObject({
        kind: 'scroll',
        target: null,
        x: 0,
        y: 300,
      });
      expect(domSignalToEvent(dom(scroll), 1)).toMatchObject({
        target: { locator: saveButton },
      });
    });

    it('maps a drag to the source and the drop target in the same frame', () => {
      const event = domSignalToEvent(
        dom(
          {
            ...base,
            kind: 'drag',
            source: { candidates: [cssFallback], description: 'card' },
          },
          { framePath: ['iframe'] },
        ),
        1,
      );
      expect(event).toMatchObject({
        kind: 'drag-and-drop',
        source: {
          locator: cssFallback,
          framePath: ['iframe'],
          description: 'card',
        },
        target: { locator: saveButton, framePath: ['iframe'] },
      });
    });

    it('drops an element event that has no candidates', () => {
      const click: CapturedEvent = {
        ...base,
        kind: 'click',
        button: 'left',
        modifiers: [],
      };
      expect(domSignalToEvent(dom(click, { candidates: [] }), 1)).toBeNull();
    });

    it('drops a drag whose source has no candidates', () => {
      const drag: CapturedEvent = {
        ...base,
        kind: 'drag',
        source: { candidates: [], description: '' },
      };
      expect(domSignalToEvent(dom(drag), 1)).toBeNull();
    });
  });

  describe('dialogToEvent', () => {
    const opened = { pageId: 'page1', message: 'Name?' } as const;

    it('stores the typed text of an accepted prompt', () => {
      const event = dialogToEvent(
        { ...opened, dialogType: 'prompt' },
        { action: 'accept', promptText: 'abc' },
        900,
      );
      expect(event).toEqual({
        kind: 'dialog',
        offsetMs: 900,
        pageId: 'page1',
        dialogType: 'prompt',
        message: 'Name?',
        action: 'accept',
        promptText: 'abc',
      });
    });

    it('stores no text for a dismissed prompt or a confirm', () => {
      expect(
        dialogToEvent(
          { ...opened, dialogType: 'prompt' },
          { action: 'dismiss', promptText: 'abc' },
          1,
        ),
      ).toMatchObject({ action: 'dismiss', promptText: null });
      expect(
        dialogToEvent(
          { ...opened, dialogType: 'confirm' },
          { action: 'accept', promptText: null },
          1,
        ),
      ).toMatchObject({ dialogType: 'confirm', promptText: null });
    });
  });
});
