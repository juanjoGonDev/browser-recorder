import type { MainMenuScreen } from '../../domain/app-state.ts';
import { BROWSER_REQUIRED_REASON } from '../../domain/browser-required.ts';
import {
  MAIN_MENU_ITEMS,
  type MainMenuItem,
} from '../../domain/main-menu-items.ts';
import type { RenderContext, ScreenView } from '../screen-view.ts';

const TAGLINE = 'Record a browser session, replay it as a Playwright script.';

function menuLine(
  item: MainMenuItem,
  isSelected: boolean,
  context: RenderContext,
): string {
  const { style } = context;
  const isDisabled = !context.isBrowserAvailable && item.isBrowserRequired;
  const label = isDisabled ? `${item.label} (needs Chromium)` : item.label;
  const text = isDisabled ? style.muted(label) : label;
  return isSelected
    ? `  ${style.accent('❯')} ${isDisabled ? text : style.bold(text)}`
    : `    ${text}`;
}

function reasonLines(context: RenderContext): string[] {
  return context.isBrowserAvailable
    ? []
    : ['', `  ${context.style.warning(`! ${BROWSER_REQUIRED_REASON}`)}`];
}

export function renderMainMenuScreen(
  screen: MainMenuScreen,
  context: RenderContext,
): ScreenView {
  const items = MAIN_MENU_ITEMS.map((item, index) =>
    menuLine(item, index === screen.selected, context),
  );
  const hint =
    context.linuxHint === null
      ? []
      : ['', `  ${context.style.warning(`! ${context.linuxHint}`)}`];
  return {
    title: 'browser-recorder',
    body: [
      '',
      `  ${context.style.muted(TAGLINE)}`,
      '',
      ...items,
      ...reasonLines(context),
      ...hint,
    ],
    hints: [
      { key: '↑↓', label: 'move' },
      { key: 'enter', label: 'select' },
      { key: 'q', label: 'quit' },
    ],
  };
}
