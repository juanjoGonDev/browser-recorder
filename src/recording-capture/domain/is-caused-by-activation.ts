/**
 * A click or key press often changes the page (a modal opens, a menu closes).
 * Long enough for a modal opened a frame or two later, short enough not to
 * hide a popover the user opens on purpose right after.
 */
export const ACTIVATION_MUTATION_WINDOW_MS = 400;

/** Whether a DOM change belongs to the activation that just happened. */
export function isCausedByActivation(
  mutationAtMs: number,
  activationAtMs: number | null,
): boolean {
  if (activationAtMs === null) return false;
  const elapsedMs = mutationAtMs - activationAtMs;
  return elapsedMs >= 0 && elapsedMs < ACTIVATION_MUTATION_WINDOW_MS;
}
