// The page functions the runtime scrolls with. They run inside an isolated
// world through the DevTools protocol, never in the page's own. Keep this free
// of backticks and `${`: it is a raw template.
export const scrollPrelude = String.raw`// The three functions below run inside an isolated world through the
// DevTools protocol, never in the page's own: they are serialized with
// toString(), so they may not use this file's bindings.
function scrollWindowInIsolatedWorld(left, top) {
  window.scrollTo({ left, top, behavior: 'instant' });
}

// Waits, on the window, for one event that Patchright dispatches at the
// element to scroll. A composed event reaches the window from inside any open
// shadow root, and its path names the real element, so no path of child
// indexes, which cannot cross a shadow boundary, is needed.
function armScrollProbe(type, left, top) {
  const state = { scrolled: false, error: '' };
  const handler = (event) => {
    window.removeEventListener(type, handler, true);
    const [target] = event.composedPath();
    if (!(target instanceof Element)) {
      state.error = 'The element to scroll is not reachable';
      return;
    }
    target.scrollTo({ left, top, behavior: 'instant' });
    state.scrolled = true;
  };
  window.addEventListener(type, handler, true);
  window[Symbol.for(type)] = { state, handler };
}

function readScrollProbe(type) {
  const probe = window[Symbol.for(type)];
  if (!probe) return { scrolled: false, error: '' };
  window.removeEventListener(type, probe.handler, true);
  delete window[Symbol.for(type)];
  return probe.state;
}
`;
