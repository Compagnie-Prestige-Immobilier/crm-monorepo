import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { FakeDemo, FakeVisitesPrisma, fakeRef } from './fake-visites-prisma.js';
import { VisiteError, VisitesService } from './visites.service.js';

const CPI = fakeRef({ id: 'ent-cpi', code: 'CPI', label: 'CPI' });
const COMMERCIALE = fakeRef({ id: 'dir-com', code: 'COMMERCIALE' });
const NDOYE = fakeRef({ id: 'dest-ndoye', code: 'NDOYE' });
const SUIVI = fakeRef({ id: 'obj-suivi', code: 'SUIVI_DOSSIER' });

const ACCUEIL = 'usr-accueil';

const build = (demoOn = false): { prisma: FakeVisitesPrisma; service: VisitesService } => {
  const prisma = new FakeVisitesPrisma();
  prisma.entreprises = [CPI, fakeRef({ id: 'ent-old', code: 'ANCIENNE', isActive: false })];
  prisma.directions = [COMMERCIALE];
  prisma.destinataires = [NDOYE];
  prisma.objets = [SUIVI];

  const service = new VisitesService(
    prisma as unknown as PrismaService,
    new FakeDemo(demoOn) as unknown as DemoVisibilityService,
  );
  return { prisma, service };
};

const base = {
  date: '2026-01-06',
  visitorName: 'MOUHAMED FALL',
  entrepriseId: CPI.id,
  objetId: SUIVI.id,
};

describe('registre des visites', () => {
  let prisma: FakeVisitesPrisma;
  let service: VisitesService;

  beforeEach(() => {
    ({ prisma, service } = build());
  });

  it('attribue la première référence de l’année, puis la suivante', async () => {
    const first = await service.create({ ...base, time: '11:08' }, ACCUEIL);
    const second = await service.create({ ...base, visitorName: 'MAITRE CISSE' }, ACCUEIL);

    expect(first.reference).toBe('V-2026-000001');
    expect(second.reference).toBe('V-2026-000002');
  });

  it('reprend la suite d’une année déjà commencée, sans rejouer un rang', async () => {
    const premiere = await service.create({ ...base }, ACCUEIL);
    const ligne = prisma.visites.find((row) => row.id === premiere.id);
    expect(ligne).toBeDefined();
    if (ligne) ligne.reference = 'V-2026-000411';

    const suivante = await service.create({ ...base }, ACCUEIL);
    expect(suivante.reference).toBe('V-2026-000412');
  });

  it('réessaie quand deux guichets prennent le même rang en même temps', async () => {
    prisma.failNextCreateWithP2002 = true;
    const visite = await service.create({ ...base }, ACCUEIL);
    expect(visite.reference).toBe('V-2026-000001');
  });

  it('rend l’heure telle qu’elle a été relevée, et nulle quand elle ne l’a pas été', async () => {
    const avecHeure = await service.create({ ...base, time: '11:08' }, ACCUEIL);
    const sansHeure = await service.create({ ...base }, ACCUEIL);

    expect(avecHeure.date).toBe('2026-01-06');
    expect(avecHeure.time).toBe('11:08');
    expect(sansHeure.time).toBeNull();
  });

  it('garde un numéro que la normalisation ne reconnaît pas, au lieu de refuser la visite', async () => {
    const reconnu = await service.create({ ...base, phone: '77 722 04 00' }, ACCUEIL);
    expect(reconnu.phone).toBe('77 722 04 00');
    expect(reconnu.phoneE164).toBe('+221777220400');

    const etranger = await service.create({ ...base, phone: '00 33 6 12' }, ACCUEIL);
    expect(etranger.phone).toBe('00 33 6 12');
    expect(etranger.phoneE164).toBeNull();
  });

  it('refuse de ranger une visite sous une entrée retirée des listes', async () => {
    await expect(service.create({ ...base, entrepriseId: 'ent-old' }, ACCUEIL)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create({ ...base, objetId: 'obj-absent' }, ACCUEIL)).rejects.toMatchObject(
      {
        response: { code: VisiteError.REFERENTIEL_UNAVAILABLE },
      },
    );
  });

  it('accepte une visite sans direction ni destinataire, comme le registre papier', async () => {
    const visite = await service.create({ ...base }, ACCUEIL);
    expect(visite.direction).toBeNull();
    expect(visite.destinataire).toBeNull();
  });

  it('cloisonne la lecture : mode éteint, une ligne de démonstration reste invisible', async () => {
    const { prisma: demoPrisma, service: demoService } = build(true);
    await demoService.create({ ...base }, ACCUEIL);

    const reel = new VisitesService(
      demoPrisma as unknown as PrismaService,
      new FakeDemo(false) as unknown as DemoVisibilityService,
    );

    const fictive = demoPrisma.visites[0];
    expect(fictive?.isDemo).toBe(true);
    expect((await reel.list({})).meta.total).toBe(0);
    expect((await demoService.list({})).meta.total).toBe(1);
    await expect(reel.get(fictive?.id ?? '')).rejects.toThrow(NotFoundException);
  });

  it('borne la période sur la journée entière, à Dakar', async () => {
    await service.create({ ...base, date: '2026-01-06', time: '23:30' }, ACCUEIL);
    await service.create({ ...base, date: '2026-01-07', time: '00:30' }, ACCUEIL);

    expect((await service.list({ from: '2026-01-06', to: '2026-01-06' })).meta.total).toBe(1);
    expect((await service.list({ from: '2026-01-06', to: '2026-01-07' })).meta.total).toBe(2);
  });

  it('retrouve une ligne par sa référence autant que par le nom du visiteur', async () => {
    await service.create({ ...base }, ACCUEIL);
    await service.create({ ...base, visitorName: 'MAITRE CISSE' }, ACCUEIL);

    expect((await service.list({ search: 'v-2026-000002' })).items[0]?.visitorName).toBe(
      'MAITRE CISSE',
    );
    expect((await service.list({ search: 'maitre' })).items[0]?.visitorName).toBe('MAITRE CISSE');
  });

  it('corrige une ligne sans toucher à sa référence ni à sa date', async () => {
    const visite = await service.create({ ...base, time: '11:08' }, ACCUEIL);
    const corrigee = await service.update(visite.id, {
      visitorName: 'MOUHAMED FALL SENIOR',
      time: '11:20',
      destinataireId: NDOYE.id,
    });

    expect(corrigee.reference).toBe(visite.reference);
    expect(corrigee.date).toBe('2026-01-06');
    expect(corrigee.time).toBe('11:20');
    expect(corrigee.destinataire?.label).toBe(NDOYE.label);
  });

  it('donne une heure à une ligne qui n’en avait pas', async () => {
    const visite = await service.create({ ...base }, ACCUEIL);
    expect(visite.time).toBeNull();

    const corrigee = await service.update(visite.id, { time: '09:05' });
    expect(corrigee.time).toBe('09:05');
    expect(corrigee.date).toBe('2026-01-06');
  });

  it('efface une heure, une direction et un destinataire corrigés', async () => {
    const visite = await service.create(
      { ...base, time: '11:08', directionId: COMMERCIALE.id, destinataireId: NDOYE.id },
      ACCUEIL,
    );

    const corrigee = await service.update(visite.id, {
      time: null,
      directionId: null,
      destinataireId: null,
    });

    expect(corrigee.time).toBeNull();
    expect(corrigee.direction).toBeNull();
    expect(corrigee.destinataire).toBeNull();
  });
});
