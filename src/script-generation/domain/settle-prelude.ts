// The part of the runtime that waits for what an action causes. Plain
// JavaScript inside a string, like the rest of the prelude: no backticks and
// no dollar-brace. Everything is tracked in Node from Patchright events, so
// nothing runs in the page and neither Runtime nor Console is enabled.
export const settlePrelude = String.raw`const NAVIGATION_TIMEOUT_MS = 30000;
const QUIET_WINDOW_MS = 500;
const SETTLE_CAP_MS = 5000;
const SETTLE_POLL_MS = 50;
const MS_PER_SECOND = 1000;
// Requests that never touch the network cannot be waited for.
const IGNORED_REQUEST_SCHEMES = ['data:', 'blob:'];

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// The same comparison the recording makes: origin and pathname only.
function originAndPath(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch {
    return url;
  }
}

// A log of main-frame navigations. An action arms it; a follow-up then waits
// for the first navigation newer than that, so one that happened before the
// action never counts, even to the same URL the page already shows.
function createNavigationTracker({ timeoutMs, describeStep }) {
  const log = [];
  const consumed = new Set();
  const listeners = new Set();
  let armedSeq = 0;

  const findMatch = (page, expected) =>
    log.find(
      (entry) =>
        entry.page === page &&
        entry.seq > armedSeq &&
        !consumed.has(entry.seq) &&
        originAndPath(entry.url) === expected,
    );

  function arrivalOf(page, expected, check) {
    return new Promise((resolve) => {
      check.run = () => {
        const entry = findMatch(page, expected);
        if (!entry) return;
        consumed.add(entry.seq);
        resolve();
      };
      listeners.add(check);
      check.run();
    });
  }

  return {
    track(page) {
      page.on('framenavigated', (frame) => {
        if (frame !== page.mainFrame()) return;
        log.push({ seq: log.length + 1, page, url: frame.url() });
        for (const check of [...listeners]) check.run();
      });
    },
    arm() {
      armedSeq = log.length;
    },
    async waitFor(page, expected) {
      const check = {};
      const message = 'Timed out waiting for the navigation of step ' + describeStep() + ' to ' + expected;
      try {
        await withTimeout(arrivalOf(page, expected, check), timeoutMs, message);
      } finally {
        listeners.delete(check);
      }
      await page.waitForLoadState('load');
    },
  };
}

function describeCap(capMs, pendingCount) {
  const noun = pendingCount === 1 ? 'request was' : 'requests were';
  return 'Stopped waiting for the network after ' + capMs / MS_PER_SECOND + ' s; ' + pendingCount + ' ' + noun + ' still in flight';
}

// The requests in flight on every page of the context, popups included.
// WebSockets emit no request event, so an open one never blocks quiet.
function createNetworkTracker(context, { quietWindowMs, capMs, pollMs, sleep, print }) {
  const inFlight = new Set();
  let lastActivityAt = performance.now();
  const touch = () => {
    lastActivityAt = performance.now();
  };
  const finish = (request) => {
    if (inFlight.delete(request)) touch();
  };
  const isIgnored = (request) => IGNORED_REQUEST_SCHEMES.some((scheme) => request.url().startsWith(scheme));

  return {
    start() {
      context.on('request', (request) => {
        if (isIgnored(request)) return;
        inFlight.add(request);
        touch();
      });
      context.on('requestfinished', finish);
      context.on('requestfailed', finish);
    },
    async settle() {
      const startedAt = performance.now();
      for (;;) {
        const now = performance.now();
        const isIdle = inFlight.size === 0 && now - Math.max(lastActivityAt, startedAt) >= quietWindowMs;
        if (isIdle) return { isQuiet: true, pendingCount: 0 };
        if (now - startedAt >= capMs) {
          // A count only: URLs may carry tokens.
          print('::warn ' + JSON.stringify(describeCap(capMs, inFlight.size)));
          return { isQuiet: false, pendingCount: inFlight.size };
        }
        await sleep(pollMs);
      }
    },
  };
}

function createSettling(context, options) {
  const navigation = createNavigationTracker({
    timeoutMs: options.navigationTimeoutMs ?? NAVIGATION_TIMEOUT_MS,
    describeStep: options.describeStep,
  });
  const network = createNetworkTracker(context, {
    quietWindowMs: options.quietWindowMs ?? QUIET_WINDOW_MS,
    capMs: options.settleCapMs ?? SETTLE_CAP_MS,
    pollMs: options.settlePollMs ?? SETTLE_POLL_MS,
    sleep: options.sleep,
    print: options.print,
  });
  return {
    start() {
      network.start();
      context.on('page', navigation.track);
      for (const page of context.pages?.() ?? []) navigation.track(page);
    },
    arm: navigation.arm,
    waitForNavigation: navigation.waitFor,
    settle: network.settle,
  };
}
`;
