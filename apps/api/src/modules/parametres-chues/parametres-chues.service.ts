import { ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import {
  CLES,
  PARAMETRES_USINE,
  cleStockee,
  ecrireValeur,
  lireValeur,
  peutEcrire,
} from './parametres.js';
import { JournalParametresDto, ParametresChuesDto, UpdateParametresChuesDto } from './dto.js';

@Injectable()
export class ParametresChuesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ce qui n'a jamais ete regle rend sa valeur d'usine : l'ecran n'a pas de trou. */
  async lire(): Promise<ParametresChuesDto> {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: CLES.map(cleStockee) } },
      select: { key: true, value: true },
    });
    const stockees = new Map(rows.map((row) => [row.key, row.value]));

    const parametres = { ...PARAMETRES_USINE };
    for (const cle of CLES) {
      const brut = stockees.get(cleStockee(cle));
      if (brut === undefined) continue;
      Object.assign(parametres, { [cle]: lireValeur(cle, brut) });
    }
    return parametres;
  }

  /**
   * N'ecrit QUE ce qui change vraiment.
   *
   * Enregistrer une valeur identique remplirait le journal de lignes qui ne
   * disent rien, et noierait la seule modification qu'on cherche six mois plus
   * tard.
   */
  async ecrire(
    user: AuthenticatedUser,
    body: UpdateParametresChuesDto,
  ): Promise<ParametresChuesDto> {
    const demandees = CLES.filter((cle) => body[cle] !== undefined);
    const refusee = demandees.find((cle) => !peutEcrire(user.role, cle));
    if (refusee !== undefined)
      throw new ForbiddenException({
        code: 'PARAMETRE_RESERVE_ADMIN',
        message:
          'Seul l’administrateur règle les liens, l’adresse, le numéro et les destinataires.',
      });

    const courants = await this.lire();
    await this.prisma.$transaction(async (tx) => {
      for (const cle of demandees) {
        const nouvelle = ecrireValeur(body[cle] as string | string[]);
        const ancienne = ecrireValeur(courants[cle]);
        if (nouvelle === ancienne) continue;

        // Lu AVANT l'ecriture : `oldValue` nul dit « le reglage n'existait
        // pas », et non « il etait vide ». La premiere ecriture se distingue
        // ainsi d'un effacement.
        const key = cleStockee(cle);
        const avant = await tx.appSetting.findUnique({ where: { key }, select: { value: true } });
        await tx.appSetting.upsert({
          where: { key },
          create: { key, value: nouvelle, updatedById: user.id },
          update: { value: nouvelle, updatedById: user.id },
        });
        await tx.appSettingChange.create({
          data: {
            key,
            oldValue: avant?.value ?? null,
            newValue: nouvelle,
            changedById: user.id,
          },
        });
      }
    });
    return this.lire();
  }

  async journal(limite: number): Promise<JournalParametresDto> {
    const rows = await this.prisma.appSettingChange.findMany({
      where: { key: { in: CLES.map(cleStockee) } },
      include: { changedBy: { select: { fullName: true } } },
      orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
      take: limite,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        cle: row.key.replace(/^chues\./, ''),
        ancienne: row.oldValue,
        nouvelle: row.newValue,
        parNom: row.changedBy?.fullName ?? 'Compte supprimé',
        le: row.changedAt.toISOString(),
      })),
    };
  }
}
