import type { ProcessProbe } from './ports/process-probe.ts';
import type { ProfileFileSystem } from './ports/profile-file-system.ts';

export type LockState =
  | { readonly kind: 'free' }
  | { readonly kind: 'locked'; readonly pid: number | null };

export interface ProfileLockDeps {
  readonly fs: ProfileFileSystem;
  readonly processes: ProcessProbe;
  readonly platform: string;
}
