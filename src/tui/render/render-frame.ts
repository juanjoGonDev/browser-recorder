import type { AppState } from '../domain/app-state.ts';
import { toFrameText } from './frame-text.ts';
import { renderApp, type FrameSize } from './render-app.ts';

export type FrameRenderer = (state: AppState, size: FrameSize) => string;

/** The terminal bytes for one frame; `hasColor` comes from `isColorEnabled`. */
export function createFrameRenderer(hasColor: boolean): FrameRenderer {
  return (state, size) => toFrameText(renderApp(state, size, hasColor));
}
