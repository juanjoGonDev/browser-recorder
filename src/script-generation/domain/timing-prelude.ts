// The pacing part of the runtime every generated script carries. Plain
// JavaScript inside a string, like the rest of the prelude: no backticks and
// no dollar-brace. It reads the timing environment and never the clock.
export const timingPrelude = String.raw`const DEFAULT_DELAY = { minMs: 250, maxMs: 900 };
const MAX_DELAY_MS = 60000;
const KEY_DELAY_DIVISOR = 10;
const SEED_PATTERN = /^\d{1,10}$/u;
const RANGE_PATTERN = /^(\d{1,5})-(\d{1,5})$/u;
const UINT32_RANGE = 4294967296;

// Small, fast and seedable: the same seed always gives the same sequence.
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

// A seed is data: only up to ten digits count, anything else is random.
function readSeed(text) {
  if (typeof text === 'string' && SEED_PATTERN.test(text)) return Number(text) >>> 0;
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}

function readDelayRange(text) {
  const match = typeof text === 'string' ? RANGE_PATTERN.exec(text) : null;
  if (!match) return DEFAULT_DELAY;
  const minMs = Number(match[1]);
  const maxMs = Number(match[2]);
  return minMs <= maxMs && maxMs <= MAX_DELAY_MS ? { minMs, maxMs } : DEFAULT_DELAY;
}

// Any mode but "human" is recorded, so an unknown value never slows a replay.
function createTiming(env, sleep) {
  const isHuman = env.BROWSER_RECORDER_TIMING === 'human';
  const delay = readDelayRange(env.BROWSER_RECORDER_HUMAN_DELAY);
  const random = mulberry32(readSeed(env.BROWSER_RECORDER_SEED));
  const draw = (minMs, maxMs) => minMs + Math.floor(random() * (maxMs - minMs + 1));
  let hasStarted = false;
  return {
    isHuman,
    delay,
    // The first action starts at once; a follow-up only observes a
    // consequence, so it neither waits nor counts as an action.
    async beforeStep({ isFollowUp }) {
      if (!isHuman || isFollowUp) return;
      const isDue = hasStarted;
      hasStarted = true;
      if (isDue) await sleep(draw(delay.minMs, delay.maxMs));
    },
    async keyPause() {
      const minMs = Math.floor(delay.minMs / KEY_DELAY_DIVISOR);
      const maxMs = Math.floor(delay.maxMs / KEY_DELAY_DIVISOR);
      await sleep(draw(minMs, maxMs));
    },
  };
}

// Recorded mode sets the value at once. Human mode types it key by key, one
// code point at a time, and then makes sure the field holds the exact value:
// masked, date and contenteditable fields may not take typed text as is.
async function fillField(locator, value, timing) {
  if (!timing.isHuman) return locator.fill(value);
  await locator.fill('');
  for (const key of Array.from(value)) {
    await locator.pressSequentially(key);
    await timing.keyPause();
  }
  const typed = await locator.inputValue().catch(() => null);
  if (typed !== value) await locator.fill(value);
}
`;
