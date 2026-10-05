export interface SignalQueue {
  /** Runs the task after every task queued before it has finished. */
  enqueue(task: () => Promise<void>): void;
  /** Resolves once everything queued so far has run. */
  idle(): Promise<void>;
}

/**
 * Keeps signals in the order the browser reported them even though preparing
 * one (verifying locators, resolving frames) is asynchronous and varies in
 * duration. A failing task never blocks the ones behind it.
 */
export function createSignalQueue(): SignalQueue {
  let tail: Promise<void> = Promise.resolve();
  return {
    enqueue(task) {
      tail = tail.then(task).catch(() => undefined);
    },
    idle: () => tail,
  };
}
