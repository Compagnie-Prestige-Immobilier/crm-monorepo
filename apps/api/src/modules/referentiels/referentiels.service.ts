import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Banque,
  Departement,
  EmployeurType,
  Ief,
  Prisma,
  Region,
  Syndicat,
} from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  BanqueDto,
  CanalProvenanceDto,
  CreateBanqueDto,
  CreateEmployeurDto,
  EmployeurDto,
  PaysDto,
  UpdateEmployeurDto,
  CreateCanalProvenanceDto,
  UpdateCanalProvenanceDto,
  CreateDepartementDto,
  CreateSyndicatDto,
  DepartementDto,
  IefDto,
  IncomeBandDto,
  CreateIncomeBandDto,
  UpdateIncomeBandDto,
  ProfessionDto,
  CreateProfessionDto,
  UpdateProfessionDto,
  OfferDto,
  CreateOfferDto,
  UpdateOfferDto,
  ReferentielQueryDto,
  ReferentielsBundleDto,
  RegionDto,
  RegionWithDepartementsDto,
  SyndicatDto,
  UpdateBanqueDto,
  UpdateDepartementDto,
  UpdateSyndicatDto,
} from './dto.js';

type DepartementRow = Departement & { region?: Pick<Region, 'name'> | null };

const toBanque = (row: Banque): BanqueDto => ({
  id: row.id,
  name: row.name,
  shortName: row.shortName,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  updatedAt: row.updatedAt.toISOString(),
});

const toCanal = (row: {
  id: string;
  code: string;
  label: string;
  position: number;
  isActive: boolean;
  updatedAt: Date;
}): CanalProvenanceDto => ({
  id: row.id,
  code: row.code,
  label: row.label,
  position: row.position,
  isActive: row.isActive,
  updatedAt: row.updatedAt.toISOString(),
});

const toSyndicat = (row: Syndicat): SyndicatDto => ({
  id: row.id,
  name: row.name,
  sigle: row.sigle,
  secteur: row.secteur,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  updatedAt: row.updatedAt.toISOString(),
});

const toDepartement = (row: DepartementRow): DepartementDto => ({
  id: row.id,
  code: row.code,
  name: row.name,
  regionId: row.regionId,
  regionName: row.region?.name ?? '',
  isActive: row.isActive,
  updatedAt: row.updatedAt.toISOString(),
});

type IefRow = Ief & {
  departement?: (Pick<Departement, 'name'> & { region?: Pick<Region, 'name'> | null }) | null;
};

const toIef = (row: IefRow): IefDto => ({
  id: row.id,
  code: row.code,
  name: row.name,
  departementId: row.departementId,
  departementName: row.departement?.name ?? '',
  regionName: row.departement?.region?.name ?? '',
  isActive: row.isActive,
  updatedAt: row.updatedAt.toISOString(),
});

const toRegion = (row: Region): RegionDto => ({ id: row.id, code: row.code, name: row.name });

const toProfession = (row: {
  id: string;
  code: string;
  label: string;
  isTeaching: boolean;
  position: number;
  isActive: boolean;
  updatedAt: Date;
}): ProfessionDto => ({ ...row, updatedAt: row.updatedAt.toISOString() });

const toIncomeBand = (row: {
  id: string;
  code: string;
  label: string;
  minXof: number | null;
  maxXof: number | null;
  position: number;
  isActive: boolean;
  updatedAt: Date;
}): IncomeBandDto => ({ ...row, updatedAt: row.updatedAt.toISOString() });

const toEmployeur = (row: {
  id: string;
  code: string;
  label: string;
  type: EmployeurType;
  position: number;
  isActive: boolean;
  updatedAt: Date;
}): EmployeurDto => ({ ...row, updatedAt: row.updatedAt.toISOString() });

const toPays = (row: {
  id: string;
  code: string;
  label: string;
  indicatif: string;
  position: number;
  isActive: boolean;
  updatedAt: Date;
}): PaysDto => ({ ...row, updatedAt: row.updatedAt.toISOString() });

const toOffer = (row: {
  id: string;
  code: string;
  label: string;
  description: string | null;
  position: number;
  isActive: boolean;
  updatedAt: Date;
}): OfferDto => ({ ...row, updatedAt: row.updatedAt.toISOString() });

@Injectable()
export class ReferentielsService {
  constructor(private readonly prisma: PrismaService) {}

  async bundle(query: ReferentielQueryDto): Promise<ReferentielsBundleDto> {
    const [
      banques,
      syndicats,
      departements,
      regions,
      professions,
      incomeBands,
      offers,
      employeurs,
      pays,
    ] = await Promise.all([
      this.listBanques(query),
      this.listSyndicats(query),
      this.listDepartements(query),
      this.listRegions(),
      this.listProfessions(query),
      this.listIncomeBands(query),
      this.listOffers(query),
      this.listEmployeurs(query),
      this.listPays(query),
    ]);
    return {
      banques,
      syndicats,
      departements,
      regions,
      professions,
      incomeBands,
      offers,
      employeurs,
      pays,
    };
  }

  async listBanques(query: ReferentielQueryDto): Promise<BanqueDto[]> {
    const where: Prisma.BanqueWhereInput = activeFilter(query);
    const rows = await this.prisma.banque.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toBanque);
  }

  async listSyndicats(query: ReferentielQueryDto): Promise<SyndicatDto[]> {
    const rows = await this.prisma.syndicat.findMany({
      where: activeFilter(query),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toSyndicat);
  }

  async listDepartements(query: ReferentielQueryDto): Promise<DepartementDto[]> {
    const rows = await this.prisma.departement.findMany({
      where: activeFilter(query),
      include: { region: { select: { name: true } } },
      orderBy: [{ name: 'asc' }],
    });
    return rows.map(toDepartement);
  }

  async listIefs(query: ReferentielQueryDto, departementId?: string): Promise<IefDto[]> {
    const rows = await this.prisma.ief.findMany({
      where: {
        ...activeFilter(query),
        ...(departementId === undefined ? {} : { departementId }),
      },
      include: { departement: { select: { name: true, region: { select: { name: true } } } } },
      orderBy: [{ departement: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map(toIef);
  }

  async listRegions(): Promise<RegionDto[]> {
    const rows = await this.prisma.region.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toRegion);
  }

  async listRegionsWithDepartements(
    query: ReferentielQueryDto,
  ): Promise<RegionWithDepartementsDto[]> {
    const rows = await this.prisma.region.findMany({
      include: {
        departements: {
          where: activeFilter(query),
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((region) => ({
      id: region.id,
      code: region.code,
      name: region.name,
      departements: region.departements.map((departement) =>
        toDepartement({ ...departement, region: { name: region.name } }),
      ),
    }));
  }

  async createBanque(input: CreateBanqueDto): Promise<BanqueDto> {
    return toBanque(await this.prisma.banque.create({ data: input }));
  }

  async updateBanque(id: string, input: UpdateBanqueDto): Promise<BanqueDto> {
    await this.assertExists('banque', id);
    return toBanque(await this.prisma.banque.update({ where: { id }, data: input }));
  }

  async listCanauxProvenance(query: ReferentielQueryDto): Promise<CanalProvenanceDto[]> {
    const rows = await this.prisma.canalProvenance.findMany({
      where: activeFilter(query),
      orderBy: [{ position: 'asc' }, { label: 'asc' }],
    });
    return rows.map(toCanal);
  }

  async createCanalProvenance(input: CreateCanalProvenanceDto): Promise<CanalProvenanceDto> {
    return toCanal(await this.prisma.canalProvenance.create({ data: input }));
  }

  async updateCanalProvenance(
    id: string,
    input: UpdateCanalProvenanceDto,
  ): Promise<CanalProvenanceDto> {
    // Le `code` n'est pas modifiable : les fiches deja saisies le designent.
    return toCanal(await this.prisma.canalProvenance.update({ where: { id }, data: input }));
  }

  async listProfessions(query: ReferentielQueryDto): Promise<ProfessionDto[]> {
    return (
      await this.prisma.profession.findMany({
        where: activeFilter(query),
        orderBy: [{ position: 'asc' }, { label: 'asc' }],
      })
    ).map(toProfession);
  }

  async createProfession(input: CreateProfessionDto): Promise<ProfessionDto> {
    return toProfession(await this.prisma.profession.create({ data: input }));
  }

  async updateProfession(id: string, input: UpdateProfessionDto): Promise<ProfessionDto> {
    return toProfession(await this.prisma.profession.update({ where: { id }, data: input }));
  }

  async listIncomeBands(query: ReferentielQueryDto): Promise<IncomeBandDto[]> {
    return (
      await this.prisma.incomeBand.findMany({
        where: activeFilter(query),
        orderBy: [{ position: 'asc' }, { minXof: 'asc' }],
      })
    ).map(toIncomeBand);
  }

  async createIncomeBand(input: CreateIncomeBandDto): Promise<IncomeBandDto> {
    return toIncomeBand(await this.prisma.incomeBand.create({ data: input }));
  }

  async updateIncomeBand(id: string, input: UpdateIncomeBandDto): Promise<IncomeBandDto> {
    return toIncomeBand(await this.prisma.incomeBand.update({ where: { id }, data: input }));
  }

  async listEmployeurs(query: ReferentielQueryDto): Promise<EmployeurDto[]> {
    return (
      await this.prisma.employeur.findMany({
        where: activeFilter(query),
        orderBy: [{ position: 'asc' }, { label: 'asc' }],
      })
    ).map(toEmployeur);
  }

  async createEmployeur(input: CreateEmployeurDto): Promise<EmployeurDto> {
    return toEmployeur(await this.prisma.employeur.create({ data: input }));
  }

  async updateEmployeur(id: string, input: UpdateEmployeurDto): Promise<EmployeurDto> {
    return toEmployeur(await this.prisma.employeur.update({ where: { id }, data: input }));
  }

  async listPays(query: ReferentielQueryDto): Promise<PaysDto[]> {
    return (
      await this.prisma.pays.findMany({
        where: activeFilter(query),
        orderBy: [{ position: 'asc' }, { label: 'asc' }],
      })
    ).map(toPays);
  }

  async listOffers(query: ReferentielQueryDto): Promise<OfferDto[]> {
    return (
      await this.prisma.offer.findMany({
        where: activeFilter(query),
        orderBy: [{ position: 'asc' }, { label: 'asc' }],
      })
    ).map(toOffer);
  }

  async createOffer(input: CreateOfferDto): Promise<OfferDto> {
    return toOffer(await this.prisma.offer.create({ data: input }));
  }

  async updateOffer(id: string, input: UpdateOfferDto): Promise<OfferDto> {
    return toOffer(await this.prisma.offer.update({ where: { id }, data: input }));
  }

  async createSyndicat(input: CreateSyndicatDto): Promise<SyndicatDto> {
    return toSyndicat(await this.prisma.syndicat.create({ data: input }));
  }

  async updateSyndicat(id: string, input: UpdateSyndicatDto): Promise<SyndicatDto> {
    await this.assertExists('syndicat', id);
    return toSyndicat(
      await this.prisma.syndicat.update({
        where: { id },
        // La chaine vide EFFACE le secteur au lieu de le stocker vide : l'ecran
        // rend « aucun » sur `null`, pas sur `''`. Champ par champ et non par
        // etalement : `input` est une instance de classe, l'etaler perd son
        // prototype.
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.sigle === undefined ? {} : { sigle: input.sigle }),
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
          ...(input.secteur === undefined
            ? {}
            : { secteur: input.secteur === '' ? null : input.secteur }),
        },
      }),
    );
  }

  async createDepartement(input: CreateDepartementDto): Promise<DepartementDto> {
    const created = await this.prisma.departement.create({
      data: input,
      include: { region: { select: { name: true } } },
    });
    return toDepartement(created);
  }

  async updateDepartement(id: string, input: UpdateDepartementDto): Promise<DepartementDto> {
    await this.assertExists('departement', id);
    const updated = await this.prisma.departement.update({
      where: { id },
      data: input,
      include: { region: { select: { name: true } } },
    });
    return toDepartement(updated);
  }

  private async assertExists(
    model: 'banque' | 'syndicat' | 'departement',
    id: string,
  ): Promise<void> {
    let found: { id: string } | null;
    switch (model) {
      case 'banque':
        found = await this.prisma.banque.findUnique({ where: { id }, select: { id: true } });
        break;
      case 'syndicat':
        found = await this.prisma.syndicat.findUnique({ where: { id }, select: { id: true } });
        break;
      case 'departement':
        found = await this.prisma.departement.findUnique({ where: { id }, select: { id: true } });
        break;
    }
    if (!found) {
      throw new NotFoundException({
        code: 'REFERENTIEL_NOT_FOUND',
        message: 'Entrée de référentiel introuvable.',
      });
    }
  }
}

function activeFilter(query: ReferentielQueryDto): { isActive?: boolean } {
  return query.activeOnly === false ? {} : { isActive: true };
}
