import type { NewRecordingScreen } from '../../domain/app-state.ts';
import { renderField } from '../field-view.ts';
import type { RenderContext, ScreenView } from '../screen-view.ts';

const FIELD_INDENT = 4;
const URL_HELP = 'Leave the URL empty to start on a blank page.';

function fieldLine(
  screen: NewRecordingScreen,
  which: 'name' | 'url',
  context: RenderContext,
): string {
  const { style } = context;
  const isFocused = screen.focus === which;
  const text = renderField(
    {
      field: which === 'name' ? screen.name : screen.startUrl,
      width: context.width - FIELD_INDENT,
      isFocused,
      placeholder:
        which === 'name' ? 'e.g. Checkout flow' : 'https://example.com',
    },
    style,
  );
  const bar = isFocused ? style.accent('▌') : style.muted('│');
  return `  ${bar} ${text}`;
}

function label(
  text: string,
  isFocused: boolean,
  context: RenderContext,
): string {
  const { style } = context;
  return `  ${isFocused ? style.bold(text) : style.muted(text)}`;
}

export function renderNewRecordingScreen(
  screen: NewRecordingScreen,
  context: RenderContext,
): ScreenView {
  const { style } = context;
  const message =
    screen.error === null
      ? style.muted(URL_HELP)
      : `${style.danger('✖')} ${style.danger(screen.error)}`;
  return {
    title: 'New recording',
    body: [
      '',
      label('Name', screen.focus === 'name', context),
      fieldLine(screen, 'name', context),
      '',
      label('Start URL (optional)', screen.focus === 'url', context),
      fieldLine(screen, 'url', context),
      '',
      `  ${message}`,
    ],
    hints: [
      { key: 'tab', label: 'next field' },
      { key: 'enter', label: 'start recording' },
      { key: 'esc', label: 'back' },
    ],
  };
}
