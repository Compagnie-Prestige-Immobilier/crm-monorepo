import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import ApkReader from '@devicefarmer/adbkit-apkreader';

const EXPECTED_PACKAGE_NAME = 'sn.cpi.go';

export interface ApkIdentity {
  readonly packageName: string;
  readonly versionCode: number;
  readonly versionName: string;
}

const ApkError = {
  UNREADABLE: 'APK_MANIFEST_UNREADABLE',
  FOREIGN_PACKAGE: 'APK_FOREIGN_PACKAGE',
  VERSION_NOT_GREATER: 'APK_VERSION_NOT_GREATER',
} as const;

const apkManifestUnreadable = (detail: string): BadRequestException =>
  new BadRequestException({
    code: ApkError.UNREADABLE,
    message:
      'Le manifeste de cet APK est illisible : la version ne peut pas en être ' +
      `extraite, et rien ne sera publié. Détail technique : ${detail}`,
  });

const apkForeignPackage = (found: string): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ApkError.FOREIGN_PACKAGE,
    message:
      `Cet APK déclare le paquet « ${found} » et non « ${EXPECTED_PACKAGE_NAME} ». ` +
      'Android refuserait de l’installer par-dessus CPI GO : la publication est annulée.',
  });

const apkVersionNotGreater = (found: number, current: number): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: ApkError.VERSION_NOT_GREATER,
    message:
      `Cet APK porte le versionCode ${String(found)}, or la release en ligne est ` +
      `déjà en ${String(current)}. Une publication doit être STRICTEMENT ` +
      'supérieure, sinon le parc reçoit une version plus ancienne que la sienne.',
  });

const isVersionCode = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export async function readApkIdentity(path: string): Promise<ApkIdentity> {
  let manifest: { package?: unknown; versionCode?: unknown; versionName?: unknown };
  try {
    manifest = await (await ApkReader.open(path)).readManifest();
  } catch (error) {
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

  const versionName =
    typeof manifest.versionName === 'string' && manifest.versionName.trim() !== ''
      ? manifest.versionName.trim().slice(0, 32)
      : String(versionCode);

  return { packageName, versionCode, versionName };
}

export function assertPublishable(identity: ApkIdentity, current: number | null): void {
  if (identity.packageName !== EXPECTED_PACKAGE_NAME) {
    throw apkForeignPackage(identity.packageName);
  }
  if (current !== null && identity.versionCode <= current) {
    throw apkVersionNotGreater(identity.versionCode, current);
  }
}
