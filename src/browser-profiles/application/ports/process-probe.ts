export interface ProcessProbe {
  hostname(): string;
  /** `kill(pid, 0)`: a permission error still means the process exists. */
  isAlive(pid: number): boolean;
}
