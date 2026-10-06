import { hoverPrelude } from '../../src/script-generation/domain/hover-prelude.ts';

export interface HoverOptions {
  readonly timeout: number;
}

export interface FakeLocator {
  readonly hover: (options: HoverOptions) => Promise<void>;
}

export interface Hovering {
  readonly hover: (locator: FakeLocator | null) => Promise<void>;
}

interface HoverModule {
  readonly hoverTimeoutMs: number;
  readonly createHovering: (settings: {
    readonly timeoutMs: number;
    readonly print: (line: string) => void;
    readonly describeStep: () => number | null;
  }) => Hovering;
}

/** Evaluates the hover runtime the way a generated script carries it. */
export function loadHoverPrelude(): HoverModule {
  // The prelude is source text for a script: evaluating it is the point.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(
    `${hoverPrelude}\nreturn { hoverTimeoutMs: HOVER_TIMEOUT_MS, createHovering };`,
  ) as () => HoverModule;
  return factory();
}
