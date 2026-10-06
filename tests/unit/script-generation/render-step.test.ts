import { describe, expect, it } from 'vitest';

import { renderStep } from '../../../src/script-generation/domain/render-step.ts';
import type { RecordingEvent } from '../../../src/shared/domain/recording-event.ts';
import type { Target } from '../../../src/shared/domain/locator.ts';

const SAVE: Target = {
  locator: { kind: 'role', role: 'button', name: 'Save' },
  nth: null,
  framePath: [],
  description: 'Save button',
};
const FIELD: Target = {
  locator: { kind: 'label', text: 'Name' },
  nth: 1,
  framePath: ['iframe#form'],
  description: 'Name field',
};
const SAVE_EXPR = 'page1.getByRole("button", { name: "Save", exact: true })';
const FIELD_EXPR =
  'page1.frameLocator("iframe#form").getByLabel("Name", { exact: true }).nth(1)';

type Tail<T> = T extends RecordingEvent
  ? Omit<T, 'offsetMs' | 'pageId'>
  : never;

function at(
  event: Tail<RecordingEvent>,
  pageId: RecordingEvent['pageId'] = 'page1',
): RecordingEvent {
  return { offsetMs: 100, pageId, ...event };
}

describe('src/script-generation/domain/render-step.ts', () => {
  it.each<[string, RecordingEvent, string[]]>([
    [
      'goto',
      at({ kind: 'goto', url: 'https://example.com/a?b=1' }),
      ['await page1.goto("https://example.com/a?b=1");'],
    ],
    [
      'wait-for-url keeps origin and pathname only',
      at({ kind: 'wait-for-url', url: 'https://example.com/a/b?q=1#h' }),
      ['await rt.waitForNavigation(page1, "https://example.com/a/b");'],
    ],
    [
      'wait-for-url on another page waits for a navigation of that page',
      at({ kind: 'wait-for-url', url: 'https://other.test/' }, 'page2'),
      ['await rt.waitForNavigation(page2, "https://other.test/");'],
    ],
    ['reload', at({ kind: 'reload' }), ['await page1.reload();']],
    ['go-back', at({ kind: 'go-back' }), ['await page1.goBack();']],
    ['go-forward', at({ kind: 'go-forward' }), ['await page1.goForward();']],
    ['page-closed', at({ kind: 'page-closed' }), ['await page1.close();']],
    [
      'plain click',
      at({ kind: 'click', target: SAVE, button: 'left', modifiers: [] }),
      [`await ${SAVE_EXPR}.click();`],
    ],
    [
      'right click with modifiers',
      at({
        kind: 'click',
        target: SAVE,
        button: 'right',
        modifiers: ['Shift', 'Alt'],
      }),
      [
        `await ${SAVE_EXPR}.click({ button: "right", modifiers: ["Shift", "Alt"] });`,
      ],
    ],
    [
      'middle click',
      at({ kind: 'click', target: SAVE, button: 'middle', modifiers: [] }),
      [`await ${SAVE_EXPR}.click({ button: "middle" });`],
    ],
    [
      'dblclick',
      at({ kind: 'dblclick', target: SAVE, modifiers: [] }),
      [`await ${SAVE_EXPR}.dblclick();`],
    ],
    [
      'dblclick with modifier',
      at({ kind: 'dblclick', target: SAVE, modifiers: ['Control'] }),
      [`await ${SAVE_EXPR}.dblclick({ modifiers: ["Control"] });`],
    ],
    [
      'hover',
      at({ kind: 'hover', target: SAVE }),
      [`await rt.hover(${SAVE_EXPR});`],
    ],
    [
      'hover inside a frame on another page',
      at({ kind: 'hover', target: FIELD }, 'page2'),
      [`await rt.hover(${FIELD_EXPR.replace('page1', 'page2')});`],
    ],
    [
      'check',
      at({ kind: 'check', target: SAVE, checked: true }),
      [`await ${SAVE_EXPR}.setChecked(true);`],
    ],
    [
      'uncheck',
      at({ kind: 'check', target: SAVE, checked: false }),
      [`await ${SAVE_EXPR}.setChecked(false);`],
    ],
    [
      'fill',
      at({ kind: 'fill', target: FIELD, value: 'Ana', isSensitive: false }),
      [`await rt.fill(${FIELD_EXPR}, "Ana");`],
    ],
    [
      'select-option',
      at({ kind: 'select-option', target: FIELD, values: ['a', 'b'] }),
      [`await ${FIELD_EXPR}.selectOption(["a", "b"]);`],
    ],
    [
      'press on a target',
      at({ kind: 'press', target: SAVE, key: 'Control+Shift+K' }),
      [`await ${SAVE_EXPR}.press("Control+Shift+K");`],
    ],
    [
      'press on the page',
      at({ kind: 'press', target: null, key: 'Escape' }),
      ['await page1.keyboard.press("Escape");'],
    ],
    [
      'page scroll',
      at({ kind: 'scroll', target: null, x: 0, y: 640 }),
      ['await rt.scrollTo(page1, [], [0, 640]);'],
    ],
    [
      'element scroll',
      at({ kind: 'scroll', target: SAVE, x: 5, y: 10 }),
      [`await rt.scrollTo(page1, [${SAVE_EXPR}], [5, 10]);`],
    ],
    [
      'element scroll inside nested iframes lists every frame element first',
      at({
        kind: 'scroll',
        target: {
          locator: { kind: 'css', selector: '#panel' },
          nth: null,
          framePath: ['iframe#outer', 'iframe[name="inner"]'],
          description: 'Panel',
        },
        x: 0,
        y: 250,
      }),
      [
        'await rt.scrollTo(page1, [page1.locator("iframe#outer"), page1.frameLocator("iframe#outer").locator("iframe[name=\\"inner\\"]"), page1.frameLocator("iframe#outer").frameLocator("iframe[name=\\"inner\\"]").locator("#panel")], [0, 250]);',
      ],
    ],
    [
      'drag-and-drop',
      at({ kind: 'drag-and-drop', source: SAVE, target: FIELD }),
      [`await ${SAVE_EXPR}.dragTo(${FIELD_EXPR});`],
    ],
    [
      'set-input-files waits for the chooser the page already answers',
      at({ kind: 'set-input-files', fileNames: ['a.txt'] }),
      ['await rt.filesSet(7);'],
    ],
    [
      'dialog is answered by the page handler, not by a step',
      at({
        kind: 'dialog',
        dialogType: 'alert',
        message: 'Hi',
        action: 'accept',
        promptText: null,
      }),
      [],
    ],
  ])('renders %s', (_name, event, expected) => {
    expect(renderStep(event, 7)).toStrictEqual(expected);
  });

  it('opens a tab caused by an action from the runtime queue', () => {
    const event = at(
      { kind: 'page-opened', openerPageId: 'page1', cause: 'action', url: 'x' },
      'page2',
    );
    expect(renderStep(event, 3)).toStrictEqual([
      'const page2 = await rt.nextPage();',
    ]);
  });

  it('opens a tab the user created through the context', () => {
    const event = at(
      { kind: 'page-opened', openerPageId: null, cause: 'user', url: 'x' },
      'page3',
    );
    expect(renderStep(event, 3)).toStrictEqual([
      'const page3 = await context.newPage();',
    ]);
  });

  it('leaves the first page to the script header', () => {
    const event = at({
      kind: 'page-opened',
      openerPageId: null,
      cause: 'user',
      url: 'about:blank',
    });
    expect(renderStep(event, 0)).toStrictEqual([]);
  });

  it('targets the variable of the page the event happened on', () => {
    const event = at({ kind: 'reload' }, 'page2');
    expect(renderStep(event, 1)).toStrictEqual(['await page2.reload();']);
  });

  it('throws naming the unsupported kind and index', () => {
    const unknown = { kind: 'teleport', offsetMs: 5, pageId: 'page1' };
    expect(() => renderStep(unknown as unknown as RecordingEvent, 4)).toThrow(
      'Unsupported event type "teleport" at index 4',
    );
  });

  it('keeps a hostile value as data', () => {
    const event = at({
      kind: 'fill',
      target: SAVE,
      value: '"); process.exit(1); ("',
      isSensitive: false,
    });
    expect(renderStep(event, 0)).toStrictEqual([
      `await rt.fill(${SAVE_EXPR}, "\\"); process.exit(1); (\\"");`,
    ]);
  });

  it('refuses a page id that is not a page variable', () => {
    const event = { kind: 'reload', offsetMs: 0, pageId: 'x; evil()' };
    expect(() => renderStep(event as unknown as RecordingEvent, 0)).toThrow(
      /page/,
    );
  });
});
