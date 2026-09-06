import { Projet } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { choisirProspect, indexerProspects, type CandidatProspect } from './rapprochement.js';

const candidat = (over: Partial<CandidatProspect> & { id: string }): CandidatProspect => ({
  projet: Projet.CHUES,
  phoneE164: '+221771000001',
  whatsappE164: null,
  emails: [],
  clientCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...over,
});

const rapprocher = (
  projet: Projet,
  phone: string | null,
  email: string | null,
  candidats: readonly CandidatProspect[],
): string | null => choisirProspect(projet, phone, email, indexerProspects(candidats));

describe('rapprochement d’une inscription avec un prospect', () => {
  it('reconnaît le prospect du MÊME projet au téléphone', () => {
    const trouve = rapprocher(Projet.CHUES, '+221771000001', null, [
      candidat({ id: 'chues-1', phoneE164: '+221771000001' }),
    ]);

    expect(trouve).toBe('chues-1');
  });

  it('NE TRAVERSE PAS la frontière des projets, même sur un téléphone identique', () => {
    const candidats = [
      candidat({ id: 'gp-1', projet: Projet.GRAND_PUBLIC, phoneE164: '+221771000001' }),
    ];

    expect(rapprocher(Projet.CHUES, '+221771000001', null, candidats)).toBeNull();
    expect(rapprocher(Projet.GRAND_PUBLIC, '+221771000001', null, candidats)).toBe('gp-1');
  });

  it('choisit la fiche du bon projet quand les deux portent le même numéro', () => {
    const candidats = [
      candidat({ id: 'gp-1', projet: Projet.GRAND_PUBLIC, phoneE164: '+221771000001' }),
      candidat({ id: 'chues-1', projet: Projet.CHUES, phoneE164: '+221771000001' }),
    ];

    expect(rapprocher(Projet.CHUES, '+221771000001', null, candidats)).toBe('chues-1');
    expect(rapprocher(Projet.GRAND_PUBLIC, '+221771000001', null, candidats)).toBe('gp-1');
  });

  it('reconnaît aussi le numéro WhatsApp de la fiche', () => {
    const trouve = rapprocher(Projet.CHUES, '+221781000009', null, [
      candidat({ id: 'chues-1', phoneE164: '+221771000001', whatsappE164: '+221781000009' }),
    ]);

    expect(trouve).toBe('chues-1');
  });

  it('passe à l’E-MAIL quand le téléphone ne dit rien', () => {
    const trouve = rapprocher(Projet.CHUES, '+221779999999', 'Awa.Sy@example.com', [
      candidat({ id: 'chues-1', phoneE164: '+221771000001', emails: ['awa.sy@example.com'] }),
    ]);

    expect(trouve).toBe('chues-1');
  });

  it('préfère le TÉLÉPHONE à l’e-mail quand les deux désignent des fiches différentes', () => {
    const trouve = rapprocher(Projet.CHUES, '+221771000001', 'autre@example.com', [
      candidat({ id: 'par-telephone', phoneE164: '+221771000001' }),
      candidat({ id: 'par-email', phoneE164: '+221772000002', emails: ['autre@example.com'] }),
    ]);

    expect(trouve).toBe('par-telephone');
  });

  it('rapproche par e-mail sans se soucier de la casse', () => {
    const trouve = rapprocher(Projet.CHUES, null, '  AWA@EXAMPLE.COM ', [
      candidat({ id: 'chues-1', emails: ['awa@example.com'] }),
    ]);

    expect(trouve).toBe('chues-1');
  });

  it('NE RAPPROCHE RIEN sur un numéro vide, même face à des fiches sans téléphone', () => {
    const candidats = [
      candidat({ id: 'sans-numero', phoneE164: '' }),
      candidat({ id: 'autre', phoneE164: '   ' }),
    ];

    expect(rapprocher(Projet.CHUES, '', null, candidats)).toBeNull();
    expect(rapprocher(Projet.CHUES, '   ', null, candidats)).toBeNull();
    expect(rapprocher(Projet.CHUES, null, null, candidats)).toBeNull();
  });

  it('NE RAPPROCHE RIEN sur un e-mail vide', () => {
    const candidats = [candidat({ id: 'chues-1', phoneE164: '+221770000000', emails: [''] })];

    expect(rapprocher(Projet.CHUES, null, '', candidats)).toBeNull();
    expect(rapprocher(Projet.CHUES, null, '   ', candidats)).toBeNull();
  });

  it('rend le MÊME lien à chaque tirage quand deux fiches se disputent le numéro', () => {
    const candidats = [
      candidat({ id: 'recente', clientCreatedAt: new Date('2026-03-01T00:00:00.000Z') }),
      candidat({ id: 'ancienne', clientCreatedAt: new Date('2026-01-01T00:00:00.000Z') }),
    ];

    expect(rapprocher(Projet.CHUES, '+221771000001', null, candidats)).toBe('ancienne');
    expect(rapprocher(Projet.CHUES, '+221771000001', null, [...candidats].reverse())).toBe(
      'ancienne',
    );
  });

  it('rend null quand aucune fiche ne correspond', () => {
    expect(
      rapprocher(Projet.CHUES, '+221779999999', 'inconnu@example.com', [
        candidat({ id: 'chues-1' }),
      ]),
    ).toBeNull();
  });
});
