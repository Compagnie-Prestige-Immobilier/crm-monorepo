import { BadRequestException, Injectable } from '@nestjs/common';
import { Projet } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CATALOGUE,
  CHAMPS_LIBRES_MAX,
  estChampConversion,
  estChampImpose,
  fusionner,
  TYPES_CHAMP_LIBRE,
  type ChampLibre,
  type TypeChampLibre,
} from './catalogue.js';
import {
  LIBELLE_MAX_LENGTH,
  OPTIONS_MAX,
  OPTION_MAX_LENGTH,
  type ChampLibreInputDto,
  type ReglagesConversionDto,
  type UpdateReglagesConversionDto,
} from './dto.js';

const cle = (projet: Projet): string => `conversion.champs.${projet}`;

interface ReglagesStockes {
  readonly champs: { champ: string; visible: boolean; obligatoire: boolean }[];
  readonly libres: ChampLibre[];
}

const VIDE: ReglagesStockes = { champs: [], libres: [] };

function lireOptions(brut: unknown): string[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((option): option is string => typeof option === 'string')
    .map((option) => option.trim().slice(0, OPTION_MAX_LENGTH))
    .filter((option) => option !== '')
    .slice(0, OPTIONS_MAX);
}

function lireLibre(brut: unknown): ChampLibre | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const ligne = brut as Partial<ChampLibre>;
  if (typeof ligne.id !== 'string' || typeof ligne.libelle !== 'string') return null;
  if (!TYPES_CHAMP_LIBRE.includes(ligne.type as TypeChampLibre)) return null;
  return {
    id: ligne.id,
    libelle: ligne.libelle,
    type: ligne.type as TypeChampLibre,
    options: lireOptions(ligne.options),
    obligatoire: ligne.obligatoire === true,
  };
}

/** Un réglage illisible rend le formulaire d'usine, jamais une erreur d'écran. */
function lireStockes(valeur: string | undefined): ReglagesStockes {
  if (valeur === undefined) return VIDE;
  try {
    const brut = JSON.parse(valeur) as Partial<ReglagesStockes>;
    const champs = Array.isArray(brut.champs) ? brut.champs : [];
    const libres = Array.isArray(brut.libres) ? brut.libres : [];
    return {
      champs: champs.filter(
        (ligne) => typeof ligne.champ === 'string' && estChampConversion(ligne.champ),
      ),
      libres: libres.flatMap((ligne) => {
        const lu = lireLibre(ligne);
        return lu === null ? [] : [lu];
      }),
    };
  } catch {
    return VIDE;
  }
}

function normaliserLibre(entree: ChampLibreInputDto, connus: ReadonlySet<string>): ChampLibre {
  const libelle = entree.libelle.trim();
  if (libelle === '') {
    throw new BadRequestException({
      code: 'CHAMP_LIBRE_SANS_LIBELLE',
      message: 'Un champ ajouté au formulaire doit porter un libellé.',
    });
  }

  const options = entree.type === 'LISTE' ? lireOptions(entree.options) : [];
  if (entree.type === 'LISTE' && options.length === 0) {
    throw new BadRequestException({
      code: 'CHAMP_LIBRE_SANS_VALEUR',
      message: `« ${libelle} » est une liste de valeurs : proposez-en au moins une.`,
    });
  }

  // Un identifiant inconnu du réglage courant est réengendré : sans cela, une
  // réponse déjà écrite sur un prospect pourrait être détournée vers un autre
  // champ en renvoyant son identifiant.
  const id = entree.id !== undefined && connus.has(entree.id) ? entree.id : uuidv7();

  return {
    id,
    libelle: libelle.slice(0, LIBELLE_MAX_LENGTH),
    type: entree.type,
    options,
    obligatoire: entree.obligatoire,
  };
}

@Injectable()
export class ChampsConversionService {
  constructor(private readonly prisma: PrismaService) {}

  async reglages(projet: Projet): Promise<ReglagesConversionDto> {
    const ligne = await this.prisma.appSetting.findUnique({ where: { key: cle(projet) } });
    const stockes = lireStockes(ligne?.value);
    const fusion = fusionner(projet, stockes.champs, stockes.libres);
    return {
      projet,
      champs: fusion.champs.map((champ) => ({ ...champ })),
      libres: fusion.libres.map((libre) => ({ ...libre, options: [...libre.options] })),
      updatedAt: ligne?.updatedAt.toISOString() ?? null,
    };
  }

  /** Les définitions seules : ce dont l'export a besoin, sans le catalogue. */
  async champsLibres(projet: Projet): Promise<readonly ChampLibre[]> {
    const ligne = await this.prisma.appSetting.findUnique({ where: { key: cle(projet) } });
    return lireStockes(ligne?.value).libres;
  }

  async majReglages(
    projet: Projet,
    actorId: string,
    body: UpdateReglagesConversionDto,
  ): Promise<ReglagesConversionDto> {
    const champs = body.champs.flatMap((ligne) =>
      estChampConversion(ligne.champ)
        ? [{ champ: ligne.champ, visible: ligne.visible, obligatoire: ligne.obligatoire }]
        : [],
    );
    const masque = champs.find((ligne) => estChampImpose(ligne.champ) && !ligne.visible);
    if (masque !== undefined) {
      throw new BadRequestException({
        code: 'CHAMP_IMPOSE_MASQUE',
        message: `« ${CATALOGUE[masque.champ].label} » ne peut pas être masqué : les indicateurs et le closing en dépendent.`,
      });
    }

    const connus = new Set((await this.champsLibres(projet)).map((libre) => libre.id));
    const libres = body.libres.slice(0, CHAMPS_LIBRES_MAX).map((entree) => {
      const normalise = normaliserLibre(entree, connus);
      connus.add(normalise.id);
      return normalise;
    });

    const key = cle(projet);
    const value = JSON.stringify({ champs, libres });
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value, updatedById: actorId },
      update: { value, updatedById: actorId },
    });

    return this.reglages(projet);
  }
}
