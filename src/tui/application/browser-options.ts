import type { BrowserChoice } from '../../shared/domain/browser-choice.ts';
import type { BrowserOptionView } from '../domain/app-views.ts';
import { pickedChoice, type BrowserPicker } from '../domain/browser-picker.ts';
import type { ControllerDeps } from './controller-deps.ts';

const DETECTING_MESSAGE = 'Detecting browsers…';
const NO_BROWSER_MESSAGE = 'No browser is available to record with.';

/**
 * The detected browsers the user may pick from. The bundled one is left out
 * after a failed install. Rejects when detection itself fails.
 */
export async function loadBrowserOptions(
  deps: Pick<ControllerDeps, 'services' | 'store'>,
): Promise<readonly BrowserOptionView[]> {
  const detected = await deps.services.browsers.list();
  const { isBundledMissing } = deps.store.getState();
  return detected.filter(
    (view) => !(isBundledMissing && view.browserId === 'bundled'),
  );
}

/** The picked choice, or the reason nothing can be chosen yet. */
export function chosenBrowser(picker: BrowserPicker): BrowserChoice | string {
  if (picker.browsers === null) return DETECTING_MESSAGE;
  return pickedChoice(picker) ?? NO_BROWSER_MESSAGE;
}
