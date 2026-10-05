import { hostname } from 'node:os';

import type { ProcessProbe } from '../application/ports/process-probe.ts';

export const nodeProcessProbe: ProcessProbe = {
  hostname: () => hostname(),
  isAlive(pid) {
    try {
      // Signal 0 only checks that the process exists; it sends nothing.
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // EPERM: the process exists but belongs to another user.
      return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
  },
};
