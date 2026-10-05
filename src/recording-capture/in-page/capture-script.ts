// The in-page capture script: bundled by esbuild into one classic script and
// run in a CDP isolated world of every frame, never in the page's own world.
import { INSTALL_FLAG_KEY, PAGE_API_KEY } from '../domain/in-page-message.ts';
import { cssPath } from './css-path.ts';
import { installDragListener } from './drag-listener.ts';
import { installHoverTracker } from './hover-tracker.ts';
import { installInputListener } from './input-listener.ts';
import { installKeyListener } from './key-listener.ts';
import { installPointerListener } from './pointer-listener.ts';
import { installScrollListener } from './scroll-listener.ts';

function defineHidden(key: string, value: unknown): void {
  Object.defineProperty(window, Symbol.for(key), {
    value,
    enumerable: false,
  });
}

function install(): void {
  if (Symbol.for(INSTALL_FLAG_KEY) in window) return;
  defineHidden(INSTALL_FLAG_KEY, true);
  // The adapter calls back into the page for what only the page can compute,
  // such as the CSS path of an iframe element.
  defineHidden(PAGE_API_KEY, { cssPath });
  installHoverTracker();
  installPointerListener();
  installDragListener();
  installInputListener();
  installKeyListener();
  installScrollListener();
}

install();
