import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { extractPdfText } from './pdf-text.js';
import {
  formatDakar,
  formatPhone,
  programmeFilename,
  writeProgrammePdf,
  type ProgrammeData,
  type ProgrammeRow,
} from './programme-pdf.js';

const rows = (count: number): ProgrammeRow[] =>
  Array.from({ length: count }, (_, index) => ({
    position: index + 1,
    fullName: `Fatou${String(index + 1)} Ndiaye${String(index + 1)}`,
    etablissement: `École ${String(index + 1)}`,
    phoneE164: `+2217810${String(index).padStart(5, '0')}`,
  }));

const DATA: ProgrammeData = {
  teleconseillerName: 'Awa Sy',
  dayNumber: 1,
  dayCount: 2,
  lotName: 'Lot CHUES août',
  cibleLabel: 'Tous les représentants',
  generatedAt: new Date('2026-08-30T14:30:00.000Z'),
  rows: rows(50),
};

async function render(data: ProgrammeData): Promise<Buffer> {
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on('data', (chunk: Buffer) => chunks.push(chunk));
  await writeProgrammePdf(sink, data);
  return Buffer.concat(chunks);
}

describe('writeProgrammePdf', () => {
  it('produit un PDF valide', async () => {
    const pdf = await render(DATA);

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.subarray(-6).toString('latin1')).toContain('%%EOF');
  });

  it('tient 50 fiches sur deux pages, en-têtes de colonnes répétés', async () => {
    const text = extractPdfText(await render(DATA));

    expect(text).toContain('Page 1 / 2');
    expect(text).toContain('Page 2 / 2');
    expect(text).not.toContain('Page 3');
    expect(text.split('Téléphone').length - 1).toBe(2);
    expect(text.split('Nom complet').length - 1).toBe(2);
    expect(text.split('Établissement').length - 1).toBe(2);
  });

  it('porte les 50 lignes : numéro, nom complet, établissement et téléphone lisible', async () => {
    const text = extractPdfText(await render(DATA));

    for (const row of DATA.rows) {
      expect(text).toContain(row.fullName);
      expect(text).toContain(row.etablissement);
      expect(text).toContain(formatPhone(row.phoneE164));
    }
    expect(text).toContain('+221 78 100 00 00');
    expect(text).toContain('50');
  });

  it('annonce le téléconseiller, la journée, le lot, la cible et la date', async () => {
    const text = extractPdfText(await render({ ...DATA, dayNumber: 2, dayCount: 3 }));

    expect(text).toContain('Programme d’appel');
    expect(text).toContain('Awa Sy');
    expect(text).toContain('Jour 2 sur 3');
    expect(text).toContain('Lot CHUES août');
    expect(text).toContain('Tous les représentants');
    expect(text).toContain('30 août 2026');
  });

  it('garde une seule page pour une courte journée', async () => {
    const text = extractPdfText(await render({ ...DATA, rows: rows(12) }));

    expect(text).toContain('Page 1 / 1');
  });

  it('laisse un nom complet dans une seule colonne', async () => {
    const text = extractPdfText(
      await render({
        ...DATA,
        rows: [
          {
            position: 1,
            fullName: 'Moussa Sarr',
            etablissement: 'Lycée de Bakel',
            phoneE164: '+221781004801',
          },
        ],
      }),
    );

    expect(text).toContain('Moussa Sarr');
    expect(text).toContain('Lycée de Bakel');
    expect(text).toContain('+221 78 100 48 01');
  });

  it('rend une journée vide sans planter', async () => {
    const text = extractPdfText(await render({ ...DATA, rows: [] }));

    expect(text).toContain('Aucune fiche pour cette journée.');
  });
});

describe('programmeFilename', () => {
  it('nomme le fichier par le téléconseiller et la journée', () => {
    expect(programmeFilename({ teleconseillerName: 'Awa Sy', dayNumber: 1 })).toBe(
      'programme-awa-sy-jour-1.pdf',
    );
  });

  it('aplatit les accents et la ponctuation', () => {
    expect(programmeFilename({ teleconseillerName: 'Fatou N’Diaye Bâ', dayNumber: 3 })).toBe(
      'programme-fatou-n-diaye-ba-jour-3.pdf',
    );
  });
});

describe('formatDakar', () => {
  it('affiche l’heure de Dakar, pas celle du serveur', () => {
    expect(formatDakar(new Date('2026-08-30T23:30:00.000Z'))).toContain('30 août 2026');
    expect(formatDakar(new Date('2026-08-30T23:30:00.000Z'))).toContain('23:30');
  });
});
