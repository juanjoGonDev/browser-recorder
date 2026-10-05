/** Asks the file system whether a candidate browser path is really there. */
export interface FileProbe {
  isFile(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
}
