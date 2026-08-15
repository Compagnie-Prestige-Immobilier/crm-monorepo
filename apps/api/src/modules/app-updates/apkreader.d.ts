/**
 * Types locaux pour `@devicefarmer/adbkit-apkreader`.
 *
 * La bibliothèque est du JavaScript CommonJS sans déclarations, et il n'existe
 * pas de paquet `@types` correspondant. Plutôt que d'ouvrir le module en `any`
 * (ce que `skipLibCheck` ne rattraperait pas, et que les règles
 * `no-unsafe-*` d'ESLint refusent à juste titre sur une valeur qui vient d'un
 * fichier téléversé), on déclare EXACTEMENT les deux appels utilisés.
 *
 * Ce que le manifeste rend est délibérément typé au plus faible :
 * `versionCode` et `versionName` sont `unknown`. Le manifeste vient d'un
 * fichier fourni par l'administrateur, il n'est pas garanti de porter ces
 * attributs, et un APK bricolé peut y mettre n'importe quoi. Les annoncer
 * `number` et `string` transformerait une donnée non vérifiée en donnée
 * réputée sûre : c'est exactement la promesse que ce module ne doit PAS faire.
 * `readApkIdentity` les valide avant d'en tirer quoi que ce soit.
 */
declare module '@devicefarmer/adbkit-apkreader' {
  interface ApkManifest {
    readonly package?: unknown;
    readonly versionCode?: unknown;
    readonly versionName?: unknown;
  }

  class ApkReader {
    /** `apk` est un chemin de fichier ou le contenu complet en mémoire. */
    static open(apk: string | Buffer): Promise<ApkReader>;
    readManifest(): Promise<ApkManifest>;
  }

  export default ApkReader;
}
