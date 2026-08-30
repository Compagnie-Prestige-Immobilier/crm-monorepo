import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { AtelierAccessService } from '../atelier/atelier-access.service';
import { AuthClaims } from '../auth/auth.types';

export type MediaKind = 'logo' | 'cover' | 'portfolio';

const CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** 4 MiB. Le client redimensionne à 1024 px et compresse à 70 % avant l'envoi ;
 *  au-delà, le fichier n'est pas une photo d'atelier. */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Les médias publics d'un atelier, sur le disque de l'API.
 *
 * Pas de bucket ni de CDN : aucun service externe n'est configuré, et en
 * inventer un rendrait l'installation impossible à faire tourner localement.
 * Le fichier est écrit sous un nom que le serveur choisit — jamais celui que
 * l'appelant propose — et relu par identifiant, jamais par chemin, si bien
 * qu'aucune requête ne peut sortir du répertoire.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AtelierAccessService,
  ) {}

  private get root(): string {
    return resolve(process.env.MEDIA_ROOT ?? 'storage/media');
  }

  async store(
    user: AuthClaims,
    atelierId: string,
    kind: MediaKind,
    contentType: string,
    bytes: Buffer,
  ) {
    await this.access.requireWriteAccess(user, atelierId);

    const extension = CONTENT_TYPES[contentType];
    if (!extension) {
      throw new BadRequestException('Only JPEG, PNG and WebP images are accepted');
    }
    if (bytes.byteLength === 0) throw new BadRequestException('Empty file');
    if (bytes.byteLength > MAX_BYTES) {
      throw new BadRequestException('Image exceeds the 4 MB limit');
    }
    // Le type déclaré par l'appelant ne prouve rien ; les octets, si. Sans ce
    // contrôle, un en-tête `image/png` suffisait à faire écrire n'importe quel
    // contenu sous une extension d'image.
    if (sniffImageType(bytes) !== contentType) {
      throw new BadRequestException('File content does not match its declared type');
    }

    const id = randomUUID();
    const storageKey = `${atelierId}/${id}.${extension}`;
    await mkdir(join(this.root, atelierId), { recursive: true });
    await writeFile(join(this.root, storageKey), bytes);

    const row = await this.db.one<{ id: string }>(
      `INSERT INTO atelier_media (id, atelier_id, kind, content_type, byte_size, storage_key, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [id, atelierId, kind, contentType, bytes.byteLength, storageKey, user.sub],
    );
    if (!row) throw new Error('Media insert failed');

    const url = `/media/${id}`;
    if (kind === 'logo' || kind === 'cover') {
      await this.db.query(
        kind === 'logo'
          ? 'UPDATE ateliers SET logo_url=$2, updated_at=now() WHERE id=$1'
          : 'UPDATE ateliers SET cover_url=$2, updated_at=now() WHERE id=$1',
        [atelierId, url],
      );
    } else {
      await this.db.query(
        `INSERT INTO atelier_portfolio_items (atelier_id, image_url, sort_order)
         VALUES ($1,$2,(SELECT COALESCE(MAX(sort_order),0)+1
                          FROM atelier_portfolio_items WHERE atelier_id=$1))`,
        [atelierId, url],
      );
    }

    return { id, kind, url, contentType, byteSize: bytes.byteLength };
  }

  /**
   * Relit un média par identifiant.
   *
   * `storage_key` vient de la base, pas de l'URL : l'identifiant est parsé comme
   * un uuid avant d'arriver ici, donc rien de ce que l'appelant écrit ne
   * participe à la construction du chemin.
   */
  async read(mediaId: string) {
    const row = await this.db.one<{ storage_key: string; content_type: string }>(
      'SELECT storage_key, content_type FROM atelier_media WHERE id=$1',
      [mediaId],
    );
    if (!row) throw new NotFoundException('Media not found');
    try {
      const bytes = await readFile(join(this.root, row.storage_key));
      return { bytes, contentType: row.content_type, etag: etagOf(bytes) };
    } catch {
      throw new NotFoundException('Media not found');
    }
  }
}

function etagOf(bytes: Buffer): string {
  return `"${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}"`;
}

/** Reconnaît le type réel d'une image à partir de ses premiers octets. */
export function sniffImageType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
