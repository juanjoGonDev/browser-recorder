// The runtime every generated script carries. It is plain JavaScript inside a
// string because the script must run with `node` alone and import nothing from
// this project. Keep it free of backticks and `${`: it is a raw template.
export const scriptPrelude = String.raw`import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ABORT_EXIT_CODE = 130;
const DEFAULT_WAIT_MS = 10000;

function createDeferred() {
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

  return {
    start() {
      startedAt = performance.now();
      context.on('page', handlePage);
    },
    async at(offsetMs) {
      const remaining = startedAt + offsetMs - performance.now();
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    },
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
    },
  };
}
`;
