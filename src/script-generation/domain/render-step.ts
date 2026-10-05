import type { Target } from '../../shared/domain/locator.ts';
import type {
  Modifier,
  RecordingEvent,
  RecordingEventKind,
} from '../../shared/domain/recording-event.ts';
import { jsNumber, jsString, jsStringArray } from './js-literal.ts';
import {
  assertPageVariable,
  renderTarget,
  renderTargetChain,
} from './render-target.ts';

type EventOf<K extends RecordingEventKind> = Extract<
  RecordingEvent,
  { kind: K }
>;

interface StepContext {
  readonly index: number;
  /** The page variable the event happened on. */
  readonly page: string;
}

type Renderer<K extends RecordingEventKind> = (
  event: EventOf<K>,
  context: StepContext,
) => string[];

const FIRST_PAGE = 'page1';

function on(context: StepContext, target: Target): string {
  return renderTarget(context.page, target);
}

function renderOptions(parts: readonly string[]): string {
  return parts.length === 0 ? '' : `{ ${parts.join(', ')} }`;
}

function modifierOption(modifiers: readonly Modifier[]): string[] {
  return modifiers.length === 0
    ? []
    : [`modifiers: ${jsStringArray(modifiers)}`];
}

/** `waitForURL` matches origin and pathname only, as the recording does. */
function originAndPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch {
    return url;
  }
}

function renderClick(event: EventOf<'click'>, context: StepContext): string[] {
  const buttonOption =
    event.button === 'left' ? [] : [`button: ${jsString(event.button)}`];
  const options = renderOptions([
    ...buttonOption,
    ...modifierOption(event.modifiers),
  ]);
  return [`await ${on(context, event.target)}.click(${options});`];
}

function renderScroll(
  event: EventOf<'scroll'>,
  context: StepContext,
): string[] {
  const position = `[${jsNumber(event.x)}, ${jsNumber(event.y)}]`;
  const chain =
    event.target === null ? [] : renderTargetChain(context.page, event.target);
  // The runtime scrolls from an isolated world: never code in the page's own.
  return [
    `await rt.scrollTo(${context.page}, [${chain.join(', ')}], ${position});`,
  ];
}

function renderPress(event: EventOf<'press'>, context: StepContext): string[] {
  const subject =
    event.target === null
      ? `${context.page}.keyboard`
      : on(context, event.target);
  return [`await ${subject}.press(${jsString(event.key)});`];
}

function renderPageOpened(
  event: EventOf<'page-opened'>,
  context: StepContext,
): string[] {
  // The first page exists before the clock starts, so it has no step code.
  if (context.page === FIRST_PAGE) return [];
  const creation =
    event.cause === 'action' ? 'rt.nextPage()' : 'context.newPage()';
  return [`const ${context.page} = await ${creation};`];
}

const RENDERERS: { readonly [K in RecordingEventKind]: Renderer<K> } = {
  goto: (event, { page }) => [`await ${page}.goto(${jsString(event.url)});`],
  'wait-for-url': (event, { page }) => [
    `await ${page}.waitForURL((url) => url.origin + url.pathname === ${jsString(originAndPath(event.url))});`,
  ],
  reload: (_event, { page }) => [`await ${page}.reload();`],
  'go-back': (_event, { page }) => [`await ${page}.goBack();`],
  'go-forward': (_event, { page }) => [`await ${page}.goForward();`],
  'page-closed': (_event, { page }) => [`await ${page}.close();`],
  click: renderClick,
  dblclick: (event, context) => [
    `await ${on(context, event.target)}.dblclick(${renderOptions(modifierOption(event.modifiers))});`,
  ],
  hover: (event, context) => [`await ${on(context, event.target)}.hover();`],
  check: (event, context) => [
    `await ${on(context, event.target)}.setChecked(${String(event.checked)});`,
  ],
  fill: (event, context) => [
    `await rt.fill(${on(context, event.target)}, ${jsString(event.value)});`,
  ],
  'select-option': (event, context) => [
    `await ${on(context, event.target)}.selectOption(${jsStringArray(event.values)});`,
  ],
  press: renderPress,
  scroll: renderScroll,
  'drag-and-drop': (event, context) => [
    `await ${on(context, event.source)}.dragTo(${on(context, event.target)});`,
  ],
  // The click that opens the chooser is answered by the page's file queue.
  'set-input-files': (_event, { index }) => [
    `await rt.filesSet(${jsNumber(index)});`,
  ],
  // Dialogs are answered by the handler registered when the page was created.
  dialog: () => [],
  'page-opened': renderPageOpened,
};

/**
 * The statements that perform one recorded event. Scheduling and the progress
 * marker are added by the caller; this only maps the event to Patchright code.
 */
export function renderStep(event: RecordingEvent, index: number): string[] {
  const renderer = (
    RENDERERS as Readonly<
      Record<string, Renderer<RecordingEventKind> | undefined>
    >
  )[event.kind];
  if (renderer === undefined) {
    throw new Error(
      `Unsupported event type ${jsString(event.kind)} at index ${index}`,
    );
  }
  assertPageVariable(event.pageId);
  return renderer(event, { index, page: event.pageId });
}

const FOLLOW_UP_KINDS: ReadonlySet<RecordingEventKind> = new Set([
  'wait-for-url',
  'dialog',
  'set-input-files',
]);

/**
 * A follow-up only observes what an earlier action caused, so human timing
 * adds no pause before it. The first page exists before any step runs.
 */
export function isFollowUp(event: RecordingEvent): boolean {
  if (event.kind === 'page-opened') {
    return event.cause === 'action' || event.pageId === FIRST_PAGE;
  }
  return FOLLOW_UP_KINDS.has(event.kind);
}
