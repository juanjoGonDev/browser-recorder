/** Printed for the user to run; this app never runs it or escalates itself. */
export const LINUX_DEPS_COMMAND =
  'sudo pnpm exec playwright install-deps chromium';
const WITH_DEPS_COMMAND = 'pnpm exec playwright install --with-deps chromium';
const LINUX_PLATFORM = 'linux';
const MISSING_LIBRARIES =
  /missing dependencies|error while loading shared libraries|cannot open shared object file/i;

/** Guidance for Linux hosts, `null` elsewhere. */
export function linuxDepsGuidance(platform: string): string | null {
  if (platform !== LINUX_PLATFORM) return null;
  return [
    'Chromium needs system libraries on Linux. Install them with:',
    `  ${LINUX_DEPS_COMMAND}`,
    `or, installing the browser and libraries together: ${WITH_DEPS_COMMAND}`,
  ].join('\n');
}

/** The guidance when a launch error names missing shared libraries. */
export function linuxDepsHint(
  platform: string,
  launchError: string,
): string | null {
  return MISSING_LIBRARIES.test(launchError)
    ? linuxDepsGuidance(platform)
    : null;
}
