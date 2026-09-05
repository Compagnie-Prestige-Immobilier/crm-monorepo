import { Injectable } from '@nestjs/common';
import { Projet } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { readEnv } from '../../env.js';
import type { ConfigPlateforme } from '../enrolement/plateformes.js';
import type { ParametresChuesDto, ParametresPublicsDto, UpdateParametresChuesDto } from './dto.js';

export const CLE_PARAMETRES = 'parametres.chues';

interface ParametresStockes {
  plateformeUrl: string;
  email: string;
  whatsappE164: string;
  chuesApiUrl: string;
  chuesApiToken: string;
  grandPublicApiUrl: string;
  grandPublicApiToken: string;
}

const VIDE: ParametresStockes = {
  plateformeUrl: '',
  email: '',
  whatsappE164: '',
  chuesApiUrl: '',
  chuesApiToken: '',
  grandPublicApiUrl: '',
  grandPublicApiToken: '',
};

const texte = (source: Record<string, unknown>, cle: keyof ParametresStockes): string => {
  const valeur = source[cle];
  return typeof valeur === 'string' ? valeur.trim() : '';
};

/**
 * Une valeur illisible rend les reglages vides, jamais une exception : le
 * connecteur et l'ecran de conversion doivent repondre meme si quelqu'un a
 * edite la ligne a la main.
 */
function lire(brut: string | undefined): ParametresStockes {
  if (brut === undefined) return VIDE;
  let source: unknown;
  try {
    source = JSON.parse(brut);
  } catch {
    return VIDE;
  }
  if (typeof source !== 'object' || source === null) return VIDE;

  const objet = source as Record<string, unknown>;
  return {
    plateformeUrl: texte(objet, 'plateformeUrl'),
    email: texte(objet, 'email'),
    whatsappE164: texte(objet, 'whatsappE164'),
    chuesApiUrl: texte(objet, 'chuesApiUrl'),
    chuesApiToken: texte(objet, 'chuesApiToken'),
    grandPublicApiUrl: texte(objet, 'grandPublicApiUrl'),
    grandPublicApiToken: texte(objet, 'grandPublicApiToken'),
  };
}

const ouNul = (valeur: string): string | null => (valeur === '' ? null : valeur);

/** Absent : inchange. Chaine vide : efface. Voir `UpdateParametresChuesDto`. */
const applique = (courant: string, entrant: string | undefined): string =>
  entrant === undefined ? courant : entrant.trim();

@Injectable()
export class ParametresService {
  constructor(private readonly prisma: PrismaService) {}

  private async stockes(): Promise<{ valeurs: ParametresStockes; updatedAt: Date | null }> {
    const ligne = await this.prisma.appSetting.findUnique({ where: { key: CLE_PARAMETRES } });
    return { valeurs: lire(ligne?.value), updatedAt: ligne?.updatedAt ?? null };
  }

  async publics(): Promise<ParametresPublicsDto> {
    const { valeurs } = await this.stockes();
    return {
      plateformeUrl: ouNul(valeurs.plateformeUrl),
      email: ouNul(valeurs.email),
      whatsappE164: ouNul(valeurs.whatsappE164),
    };
  }

  async chues(): Promise<ParametresChuesDto> {
    const { valeurs, updatedAt } = await this.stockes();
    const env = readEnv();
    const heriteDeLEnvironnement =
      valeurs.chuesApiUrl === '' &&
      valeurs.chuesApiToken === '' &&
      valeurs.grandPublicApiUrl === '' &&
      valeurs.grandPublicApiToken === '' &&
      (env.PLATEFORME_CHUES_URL !== '' || env.PLATEFORME_GRAND_PUBLIC_URL !== '');

    return {
      plateformeUrl: ouNul(valeurs.plateformeUrl),
      email: ouNul(valeurs.email),
      whatsappE164: ouNul(valeurs.whatsappE164),
      chuesApiUrl: ouNul(valeurs.chuesApiUrl),
      chuesApiTokenPose: valeurs.chuesApiToken !== '',
      grandPublicApiUrl: ouNul(valeurs.grandPublicApiUrl),
      grandPublicApiTokenPose: valeurs.grandPublicApiToken !== '',
      heriteDeLEnvironnement,
      updatedAt: updatedAt?.toISOString() ?? null,
    };
  }

  async maj(actorId: string, body: UpdateParametresChuesDto): Promise<ParametresChuesDto> {
    const { valeurs } = await this.stockes();
    const suivants: ParametresStockes = {
      plateformeUrl: applique(valeurs.plateformeUrl, body.plateformeUrl),
      email: applique(valeurs.email, body.email),
      whatsappE164: applique(valeurs.whatsappE164, body.whatsappE164),
      chuesApiUrl: applique(valeurs.chuesApiUrl, body.chuesApiUrl),
      chuesApiToken: applique(valeurs.chuesApiToken, body.chuesApiToken),
      grandPublicApiUrl: applique(valeurs.grandPublicApiUrl, body.grandPublicApiUrl),
      grandPublicApiToken: applique(valeurs.grandPublicApiToken, body.grandPublicApiToken),
    };

    const value = JSON.stringify(suivants);
    await this.prisma.appSetting.upsert({
      where: { key: CLE_PARAMETRES },
      create: { key: CLE_PARAMETRES, value, updatedById: actorId },
      update: { value, updatedById: actorId },
    });
    return this.chues();
  }

  /**
   * Ce que le connecteur emploie. La base prime sur l'environnement des qu'une
   * URL y est posee : sans cette regle, saisir l'ecran resterait sans effet sur
   * une installation qui porte encore les anciennes variables.
   */
  async configPlateforme(projet: Projet): Promise<ConfigPlateforme> {
    const { valeurs } = await this.stockes();
    const env = readEnv();

    if (projet === Projet.CHUES) {
      return valeurs.chuesApiUrl === ''
        ? { url: env.PLATEFORME_CHUES_URL, token: env.PLATEFORME_CHUES_TOKEN }
        : { url: valeurs.chuesApiUrl, token: valeurs.chuesApiToken };
    }
    return valeurs.grandPublicApiUrl === ''
      ? { url: env.PLATEFORME_GRAND_PUBLIC_URL, token: env.PLATEFORME_GRAND_PUBLIC_TOKEN }
      : { url: valeurs.grandPublicApiUrl, token: valeurs.grandPublicApiToken };
  }
}
