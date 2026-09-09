declare module '@devicefarmer/adbkit-apkreader' {
  interface ApkManifest {
    readonly package?: unknown;
    readonly versionCode?: unknown;
    readonly versionName?: unknown;
  }

  class ApkReader {
    static open(apk: string | Buffer): Promise<ApkReader>;
    readManifest(): Promise<ApkManifest>;
  }

  export default ApkReader;
}
