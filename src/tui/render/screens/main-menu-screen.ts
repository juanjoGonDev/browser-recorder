import type { MainMenuScreen } from '../../domain/app-state.ts';
import { MAIN_MENU_ITEMS } from '../../domain/main-menu-items.ts';
import type { RenderContext, ScreenView } from '../screen-view.ts';

const TAGLINE = 'Record a browser session, replay it as a Playwright script.';

function menuLine(
  label: string,
  isSelected: boolean,
  context: RenderContext,
): string {
  const { style } = context;
  return isSelected
    ? `  ${style.accent('❯')} ${style.bold(label)}`
    : `    ${label}`;
}

export function renderMainMenuScreen(
  screen: MainMenuScreen,
  context: RenderContext,
): ScreenView {
  const items = MAIN_MENU_ITEMS.map((item, index) =>
    menuLine(item.label, index === screen.selected, context),
  );
  const hint =
    context.linuxHint === null
      ? []
      : ['', `  ${context.style.warning(`! ${context.linuxHint}`)}`];
  return {
    title: 'browser-recorder',
    body: ['', `  ${context.style.muted(TAGLINE)}`, '', ...items, ...hint],
    hints: [
      { key: '↑↓', label: 'move' },
      { key: 'enter', label: 'select' },
      { key: 'q', label: 'quit' },
    ],
  };
}
