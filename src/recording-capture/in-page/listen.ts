/**
 * Listens on the window in the capture phase and only for events the user
 * produced: scripts can fabricate events, but never a trusted one.
 */
export function listen<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
): void {
  window.addEventListener(
    type,
    (event) => {
      if (event.isTrusted) handler(event);
    },
    { capture: true, passive: true },
  );
}

/**
 * Like `listen`, for the rare event a user's gesture produces without a
 * trusted event of its own: the handler must decide what is safe to accept.
 */
export function listenToAny<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
): void {
  window.addEventListener(type, handler, { capture: true, passive: true });
}
