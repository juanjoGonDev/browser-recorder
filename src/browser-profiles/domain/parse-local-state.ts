export interface RealProfile {
  /** The folder name, for example `Default` or `Profile 2`. */
  readonly directory: string;
  readonly displayName: string;
}

export interface LocalStateInfo {
  readonly profiles: readonly RealProfile[];
  readonly hasAppBoundEncryption: boolean;
}
