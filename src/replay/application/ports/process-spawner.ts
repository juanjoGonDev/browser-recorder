export interface SpawnRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
}

export interface SpawnedProcess {
  onStdout(listener: (chunk: string) => void): void;
  onStderr(listener: (chunk: string) => void): void;
  onExit(listener: (code: number | null) => void): void;
  writeStdin(text: string): void;
  kill(): void;
}

/** Starts a child process without a shell; arguments are never interpreted. */
export interface ProcessSpawner {
  spawn(request: SpawnRequest): SpawnedProcess;
}
