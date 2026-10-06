// The runtime every generated script carries. It is plain JavaScript inside a
// string because the script must run with `node` alone and import nothing from
// this project. Keep it free of backticks and `${`: it is a raw template.
import { launchPrelude } from './launch-prelude.ts';
import { scrollPrelude } from './scroll-prelude.ts';
import { timingPrelude } from './timing-prelude.ts';

const imports = String.raw`import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

`;

const constants = String.raw`const ABORT_EXIT_CODE = 130;
const ABORT_SIGNALS = process.platform === 'win32' ? ['SIGINT', 'SIGTERM', 'SIGBREAK'] : ['SIGINT', 'SIGTERM'];
const DEFAULT_WAIT_MS = 10000;
const SCROLL_WORLD = '__browser_recorder_replay';
`;

const runtime = String.raw`function createDeferred() {
  const deferred = {};
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  // A failure may land before anyone awaits it; it is still reported on await.
  deferred.promise.catch(() => {});
  return deferred;
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function createRuntime(context, options = {}) {
  const nextPageTimeoutMs = options.nextPageTimeoutMs ?? DEFAULT_WAIT_MS;
  const fileChooserTimeoutMs = options.fileChooserTimeoutMs ?? DEFAULT_WAIT_MS;
  const elementTimeoutMs = options.elementTimeoutMs ?? DEFAULT_WAIT_MS;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const timing = createTiming(options.env ?? process.env, sleep);
  const filesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'files');
  const openedPages = [];
  const pageWaiters = [];
  const fileOutcomes = new Map();
  let startedAt = performance.now();
  let currentStep = null;
  let isFinished = false;

  const elapsed = () => Math.round(performance.now() - startedAt);
  const print = (line) => process.stdout.write(line + '\n');
  const release = () => {
    isFinished = true;
    process.stdin.destroy();
  };
  const outcomeFor = (index) => {
    if (!fileOutcomes.has(index)) fileOutcomes.set(index, createDeferred());
    return fileOutcomes.get(index);
  };

  function handlePage(page) {
    const waiter = pageWaiters.shift();
    if (waiter) waiter(page);
    else openedPages.push(page);
  }

  async function answerDialog(queue, dialog) {
    const next = queue.shift();
    if (next && next.action === 'accept') {
      await dialog.accept(next.promptText ?? undefined);
    } else {
      await dialog.dismiss();
    }
  }

  async function chooseFiles(queue, chooser) {
    const next = queue.shift();
    if (!next) return;
    const outcome = outcomeFor(next.index);
    // A recorded name is data: it may only point inside the files directory.
    const missing = next.fileNames.find(
      (name) => path.basename(name) !== name || !existsSync(path.join(filesDir, name)),
    );
    if (missing !== undefined) {
      outcome.reject(new Error('Recorded file not found: files/' + missing));
      return;
    }
    try {
      await chooser.setFiles(next.fileNames.map((name) => path.join(filesDir, name)));
      outcome.resolve();
    } catch (error) {
      outcome.reject(error);
    }
  }

  // The frames that host each element of the chain, the page's main frame first.
  async function framesOf(page, chain) {
    const frames = [page.mainFrame()];
    for (const locator of chain.slice(0, -1)) {
      const handle = await locator.elementHandle({ timeout: elementTimeoutMs });
      try {
        const frame = await handle.contentFrame();
        if (!frame) throw new Error('The element that should hold a frame is not an iframe');
        frames.push(frame);
      } finally {
        await handle.dispose();
      }
    }
    return frames;
  }

  // The deepest frame with a DevTools session of its own: the page's, unless a
  // cross-origin frame lives in another process and the target is inside it.
  async function sessionFor(page, frames) {
    for (let depth = frames.length - 1; depth > 0; depth -= 1) {
      try {
        return { session: await context.newCDPSession(frames[depth]) };
      } catch {
        // Same process as its parent: the parent's session reaches it.
      }
    }
    return { session: await context.newCDPSession(page) };
  }

  function failureOf({ exceptionDetails }) {
    if (!exceptionDetails) return null;
    const description = exceptionDetails.exception?.description ?? exceptionDetails.text;
    return new Error(description.split('\n')[0].replace(/^Error: /, ''));
  }

  async function call(session, executionContextId, fn, args) {
    const result = await session.send('Runtime.callFunctionOn', {
      executionContextId,
      functionDeclaration: fn.toString(),
      arguments: args.map((value) => ({ value })),
      returnByValue: true,
    });
    const failure = failureOf(result);
    if (failure) throw failure;
    return result.result.value;
  }

  // An isolated world in every frame this session reaches; a frame of another
  // process is not reachable from it and is skipped.
  async function worldsOf(session) {
    const { frameTree } = await session.send('Page.getFrameTree');
    const worlds = [];
    const visit = async (node) => {
      try {
        const { executionContextId } = await session.send('Page.createIsolatedWorld', {
          frameId: node.frame.id,
          worldName: SCROLL_WORLD,
        });
        worlds.push(executionContextId);
      } catch {
        // Not a frame of this session.
      }
      for (const child of node.childFrames ?? []) await visit(child);
    };
    await visit(frameTree);
    return worlds;
  }

  async function scrollElement(session, chain, [left, top]) {
    const type = 'br-scroll-' + globalThis.crypto.randomUUID();
    const worlds = await worldsOf(session);
    for (const world of worlds) await call(session, world, armScrollProbe, [type, left, top]);
    let dispatchError = null;
    try {
      await chain[chain.length - 1].dispatchEvent(
        type,
        { bubbles: true, composed: true },
        { timeout: elementTimeoutMs },
      );
    } catch (error) {
      dispatchError = error;
    }
    const states = [];
    for (const world of worlds) states.push(await call(session, world, readScrollProbe, [type]));
    if (dispatchError) throw dispatchError;
    const failed = states.find((state) => state.error !== '');
    if (failed) throw new Error(failed.error);
    if (!states.some((state) => state.scrolled)) {
      throw new Error('The element to scroll is no longer in the page');
    }
  }

  async function scrollInWorld(page, chain, position) {
    const frames = await framesOf(page, chain);
    const { session } = await sessionFor(page, frames);
    try {
      if (chain.length > 0) return await scrollElement(session, chain, position);
      const [world] = await worldsOf(session);
      await call(session, world, scrollWindowInIsolatedWorld, position);
    } finally {
      await session.detach().catch(() => {});
    }
  }

  return {
    scrollTo: scrollInWorld,
    start() {
      startedAt = performance.now();
      context.on('page', handlePage);
    },
    async at(offsetMs, { isFollowUp = false } = {}) {
      // Human pacing never reads the recorded offset.
      if (timing.isHuman) return timing.beforeStep({ isFollowUp });
      // A timer may fire a little early: sleep again rather than run the step
      // before its offset.
      let remaining = startedAt + offsetMs - performance.now();
      while (remaining > 0) {
        await sleep(remaining);
        remaining = startedAt + offsetMs - performance.now();
      }
    },
    fill: (locator, value) => fillField(locator, value, timing),
    mark(index) {
      currentStep = index;
      print('::step ' + index + ' ' + elapsed());
    },
    done() {
      print('::done ' + elapsed());
      release();
    },
    fail(error) {
      const message = error instanceof Error ? error.message : String(error);
      print('::error ' + (currentStep ?? '-') + ' ' + JSON.stringify(message));
      process.exitCode = 1;
      release();
    },
    nextPage() {
      const page = openedPages.shift();
      if (page) return Promise.resolve(page);
      const arrival = new Promise((resolve) => pageWaiters.push(resolve));
      return withTimeout(arrival, nextPageTimeoutMs, 'Timed out waiting for the new tab to open');
    },
    expectDialogs(page, entries) {
      const queue = [...entries];
      page.on('dialog', (dialog) => answerDialog(queue, dialog));
    },
    expectFiles(page, entries) {
      const queue = [...entries];
      page.on('filechooser', (chooser) => chooseFiles(queue, chooser));
    },
    filesSet(index) {
      const message = 'Timed out waiting for the file chooser of step ' + index;
      return withTimeout(outcomeFor(index).promise, fileChooserTimeoutMs, message);
    },
    onAbort(handler) {
      let buffer = '';
      const abort = () => {
        if (isFinished) return;
        isFinished = true;
        Promise.resolve()
          .then(handler)
          .catch(() => {})
          .finally(() => process.exit(ABORT_EXIT_CODE));
      };
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        if (lines.some((line) => line.trim() === 'abort')) abort();
      });
      process.stdin.on('end', abort);
      // Ctrl+C reaches this process as well as the parent: close the same way.
      for (const name of ABORT_SIGNALS) process.on(name, abort);
    },
  };
}
`;

export const scriptPrelude = `${imports}${constants}${launchPrelude}
${timingPrelude}
${scrollPrelude}
${runtime}`;
