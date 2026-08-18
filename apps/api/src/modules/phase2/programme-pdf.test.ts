import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { shortCode } from '../../common/short-code.js';
import type { FastifyReply } from 'fastify';

import { CallOutcomeEffect, SYSTEM_OUTCOME_REASONS } from '../referentiels/call-outcome-rules.js';
import type { CallOutcomeReasonsService } from '../referentiels/call-outcome-reasons.service.js';
import type { Phase2CampaignsService } from './campaigns.service.js';
import type { Phase2DirectoryService } from './directory.service.js';
import { Phase2Controller } from './phase2.controller.js';
import { extractPdfText } from './pdf-text.js';
import {
  formatDakar,
  programmeFilename,
  prospectCheckboxGroups,
  writeProgrammePdf,
  type ProgrammeData,
  type ProgrammeRow,
} from './programme-pdf.js';

async function render(data: ProgrammeData): Promise<Buffer> {
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on('data', (chunk: Buffer) => chunks.push(chunk));
  await writeProgrammePdf(sink, data);
  return Buffer.concat(chunks);
}

const PROSPECTS = [
  {
    id: '01931f3c-1a2b-7c4d-8e5f-000000000001',
    nom: 'Ndiaye',
    prenom: 'Fatou',
    phone: '+221771000001',
  },
  {
    id: '01931f3c-1a2b-7c4d-8e5f-000000000002',
    nom: 'Sarr',
    prenom: 'Moussa',
    phone: '+221771000002',
  },
  {
    id: '01931f3c-1a2b-7c4d-8e5f-000000000003',
    nom: 'Diouf',
    prenom: 'Aminata',
    phone: '+221771000003',
  },
  {
    id: '01931f3c-1a2b-7c4d-8e5f-000000000004',
    nom: 'Camara',
    prenom: 'Ibrahima',
    phone: '+221771000004',
  },
  {
    id: '01931f3c-1a2b-7c4d-8e5f-000000000005',
    nom: 'Faye',
    prenom: 'Khadija',
    phone: '+221771000005',
  },
];

const ROWS: ProgrammeRow[] = PROSPECTS.map((prospect, index) => ({
  position: index + 1,
  shortCode: shortCode(prospect.id),
  phoneE164: prospect.phone,
}));

const DATA: ProgrammeData = {
  campaignName: 'Campagne CHUES avril',
  commercialName: 'Awa Sy',
  segmentLabel: 'BDD1, CHUES / CBAO',
  generatedAt: new Date('2026-04-08T14:30:00.000Z'),
  rows: ROWS,
  checkboxGroups: prospectCheckboxGroups(SYSTEM_OUTCOME_REASONS),
};

describe('writeProgrammePdf', () => {
  it('produit un PDF valide', async () => {
    const pdf = await render(DATA);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.subarray(-6).toString('latin1')).toContain('%%EOF');
  });

  it('n’écrit AUCUN nom de prospect, nulle part, jamais', async () => {
    const text = extractPdfText(await render(DATA));
    for (const prospect of PROSPECTS) {
      expect(text).not.toContain(prospect.nom);
      expect(text).not.toContain(prospect.prenom);
      expect(text).not.toContain(`${prospect.prenom} ${prospect.nom}`);
    }
    expect(text).toContain('Campagne CHUES avril');
  });

  it('ne laisse pas non plus de nom en clair dans les métadonnées du document', async () => {
    const raw = (await render(DATA)).toString('latin1');
    for (const prospect of PROSPECTS) {
      expect(raw).not.toContain(prospect.nom);
      expect(raw).not.toContain(prospect.prenom);
    }
  });

  it('imprime tous les téléphones', async () => {
    const text = extractPdfText(await render(DATA));
    for (const prospect of PROSPECTS) expect(text).toContain(prospect.phone);
  });

  it('imprime le code court de chaque prospect', async () => {
    const text = extractPdfText(await render(DATA));
    for (const prospect of PROSPECTS) expect(text).toContain(shortCode(prospect.id));
  });

  it('respecte exactement l’ordre des positions reçues', async () => {
    const at = (index: number) => {
      const prospect = PROSPECTS[index];
      if (!prospect) throw new Error(`fixture absente: ${String(index)}`);
      return prospect;
    };
    const shuffled: ProgrammeRow[] = [2, 0, 4, 1, 3].map((sourceIndex, position) => {
      const prospect = at(sourceIndex);
      return {
        position: position + 1,
        shortCode: shortCode(prospect.id),
        phoneE164: prospect.phone,
      };
    });
    const text = extractPdfText(await render({ ...DATA, rows: shuffled }));
    const offsets = shuffled.map((row) => text.indexOf(row.phoneE164));
    expect(offsets.every((offset) => offset >= 0)).toBe(true);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  it('porte l’en-tête complet : campagne, commercial, segment, date, total', async () => {
    const text = extractPdfText(await render(DATA));
    expect(text).toContain('Campagne CHUES avril');
    expect(text).toContain('Awa Sy');
    expect(text).toContain('BDD1');
    expect(text).toContain('CHUES / CBAO');
    expect(text).toContain(`Total : ${String(ROWS.length)} lignes`);
    expect(text).toContain('8 avril 2026');
  });

  it('offre les trois méthodes et les cinq autres issues sur chaque ligne', async () => {
    const text = extractPdfText(await render(DATA));
    const occurrences = (needle: string): number => text.split(needle).length - 1;
    for (const label of ['Plateforme', 'Physique', 'Voix ou messagerie électronique']) {
      expect(occurrences(label)).toBe(ROWS.length);
    }
    for (const reason of SYSTEM_OUTCOME_REASONS) {
      if (reason.effect === CallOutcomeEffect.CLOSE_METHOD) continue;
      expect(occurrences(reason.label)).toBeGreaterThanOrEqual(ROWS.length);
    }
    expect(occurrences('Commentaire')).toBe(ROWS.length);
  });

  it('pagine une longue campagne sans perdre de ligne', async () => {
    const many: ProgrammeRow[] = Array.from({ length: 120 }, (_, index) => ({
      position: index + 1,
      shortCode: shortCode(`01931f3c-1a2b-7c4d-8e5f-${String(index).padStart(12, '0')}`),
      phoneE164: `+2217710${String(index).padStart(5, '0')}`,
    }));
    const text = extractPdfText(await render({ ...DATA, rows: many }));
    for (const row of many) expect(text).toContain(row.phoneE164);
    expect(text).toContain('Page 2');
  });

  it('rend un programme vide sans planter', async () => {
    const text = extractPdfText(await render({ ...DATA, rows: [] }));
    expect(text).toContain('Aucune ligne affectée');
  });
});

describe('formatDakar', () => {
  it('affiche l’heure de Dakar, pas celle du serveur', () => {
    expect(formatDakar(new Date('2026-04-08T23:30:00.000Z'))).toContain('8 avril 2026');
    expect(formatDakar(new Date('2026-04-08T23:30:00.000Z'))).toContain('23:30');
  });
});

describe('programmeFilename', () => {
  it('date le fichier', () => {
    expect(programmeFilename({ generatedAt: new Date('2026-04-08T14:30:00.000Z') })).toBe(
      'programme-appels-2026-04-08.pdf',
    );
  });

  it('porte la journée quand la campagne est étalée', () => {
    expect(
      programmeFilename({ generatedAt: new Date('2026-04-08T14:30:00.000Z'), dayNumber: 3 }),
    ).toBe('programme-appels-2026-04-08-jour-3.pdf');
  });
});

describe('mise en page refaite', () => {
  it('titre le document et pagine « Page N / M », sans mention de confidentialité', async () => {
    const many: ProgrammeRow[] = Array.from({ length: 30 }, (_, index) => ({
      position: index + 1,
      shortCode: shortCode(`01931f3c-1a2b-7c4d-8e5f-${String(index).padStart(12, '0')}`),
      phoneE164: `+2217710${String(index).padStart(5, '0')}`,
    }));
    const text = extractPdfText(await render({ ...DATA, rows: many }));

    expect(text).toContain('Programme d’appels');
    expect(text).toMatch(/Page 1 \/ \d+/);
    expect(text).toMatch(/Page 2 \/ \d+/);
    expect(text.toLowerCase()).not.toContain('confidentiel');
  });

  it('annonce la journée d’étalement dans la ligne méta', async () => {
    const text = extractPdfText(await render({ ...DATA, dayNumber: 3, dayCount: 7 }));
    expect(text).toContain('Jour 3 sur 7');
  });

  it('n’annonce aucune journée quand la campagne n’est pas étalée', async () => {
    const text = extractPdfText(await render(DATA));
    expect(text).not.toContain('Jour ');
  });

  it('accepte un jeu de cases différent, pour les campagnes représentants', async () => {
    const text = extractPdfText(
      await render({
        ...DATA,
        title: 'Programme d’appels représentants',
        scopeCaption: 'Périmètre',
        checkboxGroups: [{ caption: 'Résultat', options: ['Échange fait', 'Fiches promises'] }],
      }),
    );

    expect(text).toContain('Programme d’appels représentants');
    expect(text).toContain('Fiches promises');
    expect(text).not.toContain('Plateforme');
  });

  it('BORNE la ligne méta : un nom de campagne long ne déborde pas de la page', async () => {
    const long = 'C'.repeat(120);
    const pdf = await render({ ...DATA, campaignName: long });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(extractPdfText(pdf)).not.toContain(long);
  });
});

describe('prospectCheckboxGroups', () => {
  it('imprime les motifs du référentiel, et pas une liste figée', async () => {
    const text = extractPdfText(
      await render({
        ...DATA,
        checkboxGroups: prospectCheckboxGroups([
          ...SYSTEM_OUTCOME_REASONS,
          { label: 'Boîte vocale', effect: CallOutcomeEffect.KEEP_OPEN },
        ]),
      }),
    );

    expect(text).toContain('Boîte vocale');
    for (const reason of SYSTEM_OUTCOME_REASONS) {
      if (reason.effect === CallOutcomeEffect.CLOSE_METHOD) continue;
      expect(text).toContain(reason.label);
    }
  });

  it('range le motif qui exige une méthode dans le groupe « Méthode », pas dans « Autre »', () => {
    const [methode, autre] = prospectCheckboxGroups(SYSTEM_OUTCOME_REASONS);

    expect(methode?.caption).toBe('Méthode');
    expect(autre?.options).not.toContain(
      SYSTEM_OUTCOME_REASONS.find((reason) => reason.effect === CallOutcomeEffect.CLOSE_METHOD)
        ?.label,
    );
    expect(autre?.options).toHaveLength(SYSTEM_OUTCOME_REASONS.length - 1);
  });
});

describe('le programme téléchargé', () => {
  it('tire ses cases du référentiel EN BASE, pas de la table compilée', async () => {
    const chunks: Buffer[] = [];
    const raw = new PassThrough();
    raw.on('data', (chunk: Buffer) => chunks.push(chunk));
    Object.assign(raw, { setHeader: () => undefined });

    const campaigns = {
      programme: () =>
        Promise.resolve({
          campaignName: 'Campagne CHUES avril',
          commercialName: 'Awa Sy',
          segmentLabel: 'BDD1',
          rows: ROWS,
        }),
    };
    const reasons = {
      listAll: () =>
        Promise.resolve({
          items: [
            { label: 'Boîte vocale', effect: CallOutcomeEffect.KEEP_OPEN, isActive: true },
            { label: 'Motif retiré', effect: CallOutcomeEffect.KEEP_OPEN, isActive: false },
          ],
        }),
    };

    const controller = new Phase2Controller(
      campaigns as unknown as Phase2CampaignsService,
      {} as Phase2DirectoryService,
      reasons as unknown as CallOutcomeReasonsService,
    );

    await controller.downloadProgramme(
      '01931f3c-1a2b-7c4d-8e5f-000000000031',
      '01931f3c-1a2b-7c4d-8e5f-000000000032',
      {},
      { hijack: () => undefined, raw } as unknown as FastifyReply,
    );

    const text = extractPdfText(Buffer.concat(chunks));
    expect(text).toContain('Boîte vocale');
    expect(text).not.toContain('Motif retiré');
    expect(text).not.toContain('Injoignable');
  });
});
