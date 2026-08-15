import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import ApkReader from '@devicefarmer/adbkit-apkreader';

/**
 * Lecture de l'identité d'un APK depuis son propre manifeste.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CE FICHIER FERME
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `versionName` et `versionCode` étaient SAISIS À LA MAIN dans le formulaire de
 * publication, à côté du fichier. Les deux valeurs sont pourtant déjà DANS
 * l'APK, décidées par le build : ce que l'administrateur tapait n'était au
 * mieux qu'une recopie, au pire un chiffre pris sur la release précédente.
 *
 * Et la conséquence n'est pas cosmétique. Le parc mobile décide de se mettre à
 * jour en comparant SON `versionCode` à celui que l'API annonce. Une release
 * publiée avec un `versionCode` recopié trop haut fait croire à une mise à jour
 * qui n'existe pas ; recopié trop bas, elle rend invisible une correction déjà
 * en ligne. Dans les deux cas, le fichier servi et le numéro annoncé décrivent
 * deux versions différentes, et rien dans le système ne peut le remarquer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UNE BIBLIOTHÈQUE, ET LAQUELLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un APK est une archive ZIP dont `AndroidManifest.xml` n'est PAS du texte :
 * c'est de l'AXML, le XML binaire d'Android, une table de chaînes suivie d'un
 * flux d'enregistrements typés où les entiers sont écrits en petit-boutiste sur
 * quatre octets. Une expression régulière n'y trouve rien ; un analyseur XML
 * ordinaire refuse le fichier dès le premier octet.
 *
 * RETENU : `@devicefarmer/adbkit-apkreader` (Apache-2.0, republié en 2026).
 * C'est le fork maintenu par DeviceFarmer, les mainteneurs d'OpenSTF, où ce
 * même code lit des milliers d'APK réels par jour. 40 Ko de source, l'analyseur
 * AXML tient dans un seul fichier, et il accepte aussi bien un chemin qu'un
 * tampon.
 *
 * ÉCARTÉS, et pourquoi :
 *
 *  - `node-apk` : plus propre sur le papier (TypeScript, déclarations
 *    fournies), mais aucune publication depuis février 2023, et il traîne
 *    `node-forge`, soit 1,7 Mo de cryptographie qui ne sert QUE à sa lecture de
 *    signature, fonctionnalité dont on ne veut pas.
 *  - `app-info-parser` : orienté navigateur et bi-plateforme. Pour lire un
 *    manifeste Android il faudrait accepter `plist`, `cgbi-to-png`,
 *    `bytebuffer` et `commander`, tout un arbre au service d'iOS.
 *  - `adbkit-apkreader` non préfixé : l'original, sans publication depuis 2022,
 *    remplacé précisément par le fork ci-dessus.
 *  - `binary-xml`, `axml-parser` : versions 0.0.1 et 1.0.0, dernière activité
 *    en 2022, aucune adoption. Un analyseur de format binaire sans utilisateurs
 *    est un analyseur non éprouvé.
 *
 * COÛT ACCEPTÉ : la bibliothèque ne publie pas de types (d'où
 * `apkreader.d.ts`), et son arbre contient `bluebird`, employé chez elle comme
 * simple polyfill de `Promise`. C'est du poids mort, pas un risque : il ne
 * remplace aucun global à l'import.
 */

/**
 * L'identifiant de paquet attendu.
 *
 * Il est ÉCRIT ICI, en dur, exactement comme il l'est dans
 * `apps/mobile/android/app/build.gradle.kts` (`applicationId = "sn.cpi.go"`).
 * Ce n'est pas un réglage : Android refuse d'installer par-dessus une
 * application dont le paquet diffère, donc une release portant un autre
 * identifiant ne remplacerait jamais CPI GO sur les téléphones du parc. En
 * faire une variable d'environnement laisserait croire qu'on peut la changer
 * sans reconstruire l'application mobile.
 */
export const EXPECTED_PACKAGE_NAME = 'sn.cpi.go';

export interface ApkIdentity {
  readonly packageName: string;
  readonly versionCode: number;
  readonly versionName: string;
}

/** Codes stables du refus. Ce sont eux que le panel branche, pas les phrases. */
export const ApkError = {
  UNREADABLE: 'APK_MANIFEST_UNREADABLE',
  FOREIGN_PACKAGE: 'APK_FOREIGN_PACKAGE',
  VERSION_NOT_GREATER: 'APK_VERSION_NOT_GREATER',
} as const;

/**
 * Le manifeste n'a pas pu être lu.
 *
 * AUCUN REPLI N'EST PROPOSÉ, et c'est le point entier de cette erreur. Ni une
 * valeur devinée depuis le nom du fichier, ni la reprise d'une saisie
 * manuelle : les deux ramèneraient exactement le défaut qu'on ferme, mais
 * seulement les jours où le fichier est douteux, c'est-à-dire les jours où il
 * faut le plus se méfier.
 */
export const apkManifestUnreadable = (detail: string): BadRequestException =>
  new BadRequestException({
    code: ApkError.UNREADABLE,
    message:
      'Le manifeste de cet APK est illisible : la version ne peut pas en être ' +
      `extraite, et rien ne sera publié. Détail technique : ${detail}`,
  });

/**
 * L'APK n'est pas CPI GO.
 *
 * Le paquet est nommé DANS le message. « APK refusé » enverrait
 * l'administrateur chercher une panne ; « com.autre.editeur au lieu de
 * sn.cpi.go » lui dit qu'il a pris le mauvais fichier dans son dossier.
 */
export const apkForeignPackage = (found: string): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ApkError.FOREIGN_PACKAGE,
    message:
      `Cet APK déclare le paquet « ${found} » et non « ${EXPECTED_PACKAGE_NAME} ». ` +
      'Android refuserait de l’installer par-dessus CPI GO : la publication est annulée.',
  });

/**
 * La version proposée ne dépasse pas celle en ligne.
 *
 * LES DEUX NOMBRES SONT DITS. Accepter en silence un `versionCode` inférieur
 * est la façon dont une régression part vers tout le parc : le fichier est
 * servi, les téléphones qui ont déjà mieux l'ignorent, ceux qui viennent
 * d'être installés reçoivent l'ancienne application, et personne ne comprend
 * pourquoi une correction déployée la veille a disparu chez la moitié des
 * équipes.
 */
export const apkVersionNotGreater = (
  found: number,
  current: number,
): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ApkError.VERSION_NOT_GREATER,
    message:
      `Cet APK porte le versionCode ${String(found)}, or la release en ligne est ` +
      `déjà en ${String(current)}. Une publication doit être STRICTEMENT ` +
      'supérieure, sinon le parc reçoit une version plus ancienne que la sienne.',
  });

/**
 * `versionCode` est un entier 32 bits positif côté Android. On refuse tout le
 * reste plutôt que d'arrondir : `Number.isSafeInteger` écarte les flottants,
 * les `NaN` et les valeurs qu'un manifeste bricolé aurait pu y glisser.
 */
const isVersionCode = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/**
 * Extrait l'identité de l'APK situé à `path`.
 *
 * Lève une `HttpException` en français dans tous les cas d'échec : rien ne
 * remonte ici sous forme de 500, parce qu'aucune de ces situations n'est une
 * panne du serveur. Ce sont toutes des propriétés du fichier reçu.
 */
export async function readApkIdentity(path: string): Promise<ApkIdentity> {
  let manifest: { package?: unknown; versionCode?: unknown; versionName?: unknown };
  try {
    manifest = await (await ApkReader.open(path)).readManifest();
  } catch (error) {
    // Le message de la bibliothèque est CONSERVÉ : « Invalid XML header » et
    // « APK does not contain 'AndroidManifest.xml' » décrivent deux problèmes
    // très différents, et l'administrateur qui rouvre un ticket a besoin de
    // savoir lequel.
    throw apkManifestUnreadable(error instanceof Error ? error.message : String(error));
  }

  const packageName = manifest.package;
  if (typeof packageName !== 'string' || packageName === '') {
    throw apkManifestUnreadable('le manifeste ne déclare aucun identifiant de paquet');
  }

  const versionCode = manifest.versionCode;
  if (!isVersionCode(versionCode)) {
    throw apkManifestUnreadable('le manifeste ne déclare aucun versionCode entier positif');
  }

  // `versionName` est le seul des trois qui soit purement décoratif : il
  // s'affiche, il ne pilote rien. Absent, on ne refuse donc pas la release, on
  // retombe sur le `versionCode`, qui est toujours là et toujours vrai.
  const versionName =
    typeof manifest.versionName === 'string' && manifest.versionName.trim() !== ''
      ? manifest.versionName.trim().slice(0, 32)
      : String(versionCode);

  return { packageName, versionCode, versionName };
}

/**
 * Les deux règles d'acceptation, réunies pour être exerçables sans fichier.
 *
 * `current` vaut `null` quand aucune release n'est encore publiée : la
 * première publication ne se compare à rien.
 */
export function assertPublishable(identity: ApkIdentity, current: number | null): void {
  if (identity.packageName !== EXPECTED_PACKAGE_NAME) {
    throw apkForeignPackage(identity.packageName);
  }
  if (current !== null && identity.versionCode <= current) {
    throw apkVersionNotGreater(identity.versionCode, current);
  }
}
