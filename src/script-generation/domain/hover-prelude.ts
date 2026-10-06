// The part of the runtime that performs recorded hovers. A hover only reveals
// something, so one that cannot be performed is skipped with a warning
// instead of failing the replay. Plain JavaScript inside a string, like the
// rest of the prelude: no backticks and no dollar-brace. The step in the
// warning text is 1-based for people; ::step and ::error markers are 0-based.
export const hoverPrelude = String.raw`const HOVER_TIMEOUT_MS = 2000;
const MISSING_HOVER_TARGET = 'the target was not found';

// The first line only: the rest of a Patchright error is a call log that
// quotes the page's markup.
function describeSkippedHover(step, error) {
  const reason = error instanceof Error ? error.message : String(error);
  const position = step === null ? '-' : step + 1;
  return 'Skipped the hover of step ' + position + ': ' + reason.split('\n')[0];
}

function createHovering({ timeoutMs, print, describeStep }) {
  return {
    async hover(locator) {
      try {
        if (!locator) throw new Error(MISSING_HOVER_TARGET);
        await locator.hover({ timeout: timeoutMs });
      } catch (error) {
        print('::warn ' + JSON.stringify(describeSkippedHover(describeStep(), error)));
      }
    },
  };
}
`;
