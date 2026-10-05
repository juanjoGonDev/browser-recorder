export interface InstallResult {
  readonly exitCode: number | null;
}

export interface BrowserInstallation {
  isInstalled(): Promise<boolean>;
  /** Streams the installer output line by line. */
  install(onLine: (line: string) => void): Promise<InstallResult>;
}
