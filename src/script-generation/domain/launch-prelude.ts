// The part of the runtime that opens the browser. Plain JavaScript inside a
// string, like the rest of the prelude: no backticks and no dollar-brace.
export const launchPrelude = String.raw`const LAUNCH_TIMEOUT_MS = 30000;
const TEMP_PROFILE_PREFIX = 'browser-recorder-profile-';
const REMOVE_RETRIES = 5;
const REMOVE_RETRY_DELAY_MS = 100;
// The engine's own defaults that keep it away from the real keychain.
const KEYCHAIN_SWITCHES = ['--use-mock-keychain', '--password-store=basic'];
// The only argument the environment may add: Chromium's own profile names.
const PROFILE_ARGUMENT = /^--profile-directory=(?:Default|Profile \d{1,4})$/u;

// Same rules as the recorder (launch-arguments.ts): a real window keeps the
// browser's own metrics and only asks for a size; emulated metrics stay for
// recordings made with them.
function buildLaunchOptions(display, target) {
  const isWindow = display.kind === 'window';
  return {
    viewport: isWindow ? null : { width: display.width, height: display.height },
    args: [
      ...(isWindow ? ['--window-size=' + display.width + ',' + display.height] : []),
      ...target.browserArgs,
    ],
    ignoreDefaultArgs: target.shouldUseRealKeychain ? KEYCHAIN_SWITCHES : undefined,
    executablePath: target.executablePath ?? undefined,
  };
}

// Environment variables are data: anything but a profile directory name is
// dropped, so a hostile value cannot add a flag such as a debugging port.
function readBrowserArgs(text) {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((arg) => typeof arg === 'string' && PROFILE_ARGUMENT.test(arg));
  } catch {
    return [];
  }
}

// A browser that is not installed here falls back to the bundled Chromium.
function readExecutablePath(value) {
  if (!value) return null;
  if (existsSync(value)) return value;
  process.stderr.write('Browser not found: ' + value + '. Using the bundled Chromium.\n');
  return null;
}

function readLaunchTarget(env) {
  return {
    executablePath: readExecutablePath(env.BROWSER_RECORDER_EXECUTABLE_PATH),
    userDataDir: env.BROWSER_RECORDER_USER_DATA_DIR || null,
    browserArgs: readBrowserArgs(env.BROWSER_RECORDER_BROWSER_ARGS),
    shouldUseRealKeychain: env.BROWSER_RECORDER_REAL_KEYCHAIN === '1',
  };
}

// Launches on the profile the environment names, or on a temporary one that
// close() removes. close() may be called more than once.
async function openContext(chromium, display, env = process.env) {
  const target = readLaunchTarget(env);
  const temporaryDir = target.userDataDir
    ? null
    : mkdtempSync(path.join(os.tmpdir(), TEMP_PROFILE_PREFIX));
  const context = await chromium
    .launchPersistentContext(target.userDataDir ?? temporaryDir, {
      headless: env.BROWSER_RECORDER_HEADLESS === '1',
      timeout: LAUNCH_TIMEOUT_MS,
      ...buildLaunchOptions(display, target),
    })
    .catch((error) => {
      if (temporaryDir) rmSync(temporaryDir, { recursive: true, force: true });
      throw error;
    });
  let isClosed = false;
  const close = async () => {
    if (isClosed) return;
    isClosed = true;
    try {
      await context.close();
    } finally {
      if (temporaryDir) {
        rmSync(temporaryDir, {
          recursive: true,
          force: true,
          maxRetries: REMOVE_RETRIES,
          retryDelay: REMOVE_RETRY_DELAY_MS,
        });
      }
    }
  };
  return { context, close };
}
`;
