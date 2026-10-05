export interface ExitAfterSavingDeps {
  /** Saves whatever is in flight; may take as long as closing a browser. */
  readonly persist: () => Promise<void>;
  readonly exit: (code: number) => void;
  /** How long to wait for `persist` before leaving anyway. */
  readonly deadlineMs: number;
}

/**
 * The `exit` the terminal calls on SIGINT, SIGTERM or a crash. The recording
 * is saved first, then the process leaves: a stuck browser or a failed save
 * delays the exit by at most the deadline and never prevents it.
 */
export function exitAfterSaving(
  deps: ExitAfterSavingDeps,
): (code: number) => void {
  let isLeaving = false;
  return (code) => {
    if (isLeaving) return;
    isLeaving = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, deps.deadlineMs);
    });
    void Promise.race([deps.persist().catch(() => undefined), deadline]).then(
      () => {
        clearTimeout(timer);
        deps.exit(code);
      },
    );
  };
}
