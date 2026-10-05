import { describe, expect, it } from 'vitest';
import {
  BINDING_NAME,
  parseInPageMessage,
  parseInPageText,
} from '../../../src/recording-capture/domain/in-page-message.ts';

const css = { kind: 'css', selector: '#save' };
const timed = { ageMs: 0, description: 'button "Save"' };

function dom(payload: Record<string, unknown>, candidates: unknown = [css]) {
  return { kind: 'dom', payload: { ...timed, ...payload }, candidates };
}

describe('src/recording-capture/domain/in-page-message.ts', () => {
  it('names the binding the adapter exposes and the script calls', () => {
    expect(BINDING_NAME).toBe('__browserRecorderEmit');
  });

  describe('dom messages', () => {
    it.each([
      ['click', { kind: 'click', button: 'right', modifiers: ['Shift'] }],
      ['dblclick', { kind: 'dblclick', modifiers: [] }],
      ['hover', { kind: 'hover' }],
      ['input', { kind: 'input', value: 'hey', isSensitive: false }],
      ['select', { kind: 'select', values: ['es', 'fr'] }],
      ['check', { kind: 'check', checked: true }],
      ['files', { kind: 'files', fileNames: ['a.png'] }],
      ['key', { kind: 'key', key: 'Control+Shift+K' }],
      ['scroll', { kind: 'scroll', x: 0, y: 480 }],
      [
        'drag',
        {
          kind: 'drag',
          source: { candidates: [css], description: 'item' },
        },
      ],
    ])('accepts a well formed %s', (_name, payload) => {
      const message = dom(payload);
      expect(parseInPageMessage(message)).toEqual(message);
    });

    it.each([
      ['an unknown kind', dom({ kind: 'teleport' })],
      [
        'a click with an unknown button',
        dom({ kind: 'click', button: 'x', modifiers: [] }),
      ],
      [
        'a click with an unknown modifier',
        dom({ kind: 'click', button: 'left', modifiers: ['Hyper'] }),
      ],
      [
        'an input without a boolean flag',
        dom({ kind: 'input', value: 'a', isSensitive: 'no' }),
      ],
      [
        'a select with a non-string value',
        dom({ kind: 'select', values: [1] }),
      ],
      [
        'a scroll with a non-finite offset',
        dom({ kind: 'scroll', x: Number.NaN, y: 0 }),
      ],
      ['a negative age', dom({ kind: 'hover', ageMs: -1 })],
      [
        'a payload without a description',
        { kind: 'dom', payload: { kind: 'hover', ageMs: 0 }, candidates: [] },
      ],
      [
        'candidates that are not locators',
        dom({ kind: 'hover' }, [{ kind: 'xpath', path: '//a' }]),
      ],
      [
        'a role locator without a name',
        dom({ kind: 'hover' }, [{ kind: 'role', role: 'button' }]),
      ],
      ['candidates that are not a list', dom({ kind: 'hover' }, 'nope')],
      ['a drag without a source', dom({ kind: 'drag' })],
    ])('rejects %s', (_name, message) => {
      expect(parseInPageMessage(message)).toBeNull();
    });

    it('accepts every locator kind as a candidate', () => {
      const candidates = [
        { kind: 'test-id', testId: 'save' },
        { kind: 'role', role: 'button', name: 'Save' },
        { kind: 'label', text: 'Name' },
        { kind: 'placeholder', text: 'Your name' },
        { kind: 'text', text: 'Save' },
        css,
      ];
      const message = dom({ kind: 'hover' }, candidates);
      expect(parseInPageMessage(message)).toEqual(message);
    });
  });

  describe('navigation reports', () => {
    it('are not accepted: navigation is observed from Node over CDP', () => {
      const navigation = {
        kind: 'navigation',
        url: 'http://a.test/x',
        navigationType: 'reload',
        entryIndex: 3,
      };
      expect(parseInPageMessage(navigation)).toBeNull();
    });
  });

  describe('parseInPageText', () => {
    it('parses the JSON string the binding delivers', () => {
      const message = dom({ kind: 'hover' });
      expect(parseInPageText(JSON.stringify(message))).toEqual(message);
    });

    it.each(['', 'not json', '{"kind":', '"dom"', '{"kind":"dom"}'])(
      'drops the text %j',
      (text) => {
        expect(parseInPageText(text)).toBeNull();
      },
    );
  });

  it.each([null, undefined, 'dom', 42, [], { kind: 'other' }, {}])(
    'rejects the non-message %j',
    (value) => {
      expect(parseInPageMessage(value)).toBeNull();
    },
  );
});
