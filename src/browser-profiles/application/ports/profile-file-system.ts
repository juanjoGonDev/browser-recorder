export interface DirEntry {
  readonly name: string;
  /** From `lstat`, so a symlink is never reported as what it points to. */
  readonly kind: 'file' | 'directory' | 'symlink' | 'other';
}

export interface FileStamp {
  readonly size: number;
  readonly mtimeMs: number;
}

/** Every file operation the profile store needs; the source is read-only. */
export interface ProfileFileSystem {
  /** `mkdir -p`, then `chmod 0o700` on POSIX. */
  makePrivateDir(path: string): Promise<void>;
  readText(path: string): Promise<string>;
  list(dir: string): Promise<readonly DirEntry[]>;
  stamp(path: string): Promise<FileStamp | null>;
  readLink(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
  /** Never overwrites (`COPYFILE_EXCL`) and opens the source read-only. */
  copyFile(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  randomName(): string;
}
