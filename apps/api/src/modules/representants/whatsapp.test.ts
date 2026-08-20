import { BadRequestException } from '@nestjs/common';
import { WhatsappStatus } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { resolveWhatsappPatch, whatsappNumberOf } from './whatsapp.js';

const PHONE = '+221771234567';
const AUTRE = '+221780000001';

const fiche = (
  whatsappStatus: WhatsappStatus,
  whatsappE164: string | null = null,
): { phoneE164: string; whatsappStatus: WhatsappStatus; whatsappE164: string | null } => ({
  phoneE164: PHONE,
  whatsappStatus,
  whatsappE164,
});

describe('le numéro WhatsApp joignable', () => {
  it('vaut le téléphone sur MEME_NUMERO', () => {
    expect(whatsappNumberOf(fiche(WhatsappStatus.MEME_NUMERO))).toBe(PHONE);
  });

  it('vaut le numéro dédié sur AUTRE_NUMERO', () => {
    expect(whatsappNumberOf(fiche(WhatsappStatus.AUTRE_NUMERO, AUTRE))).toBe(AUTRE);
  });

  it('est nul quand la question n’a pas été posée, et quand la réponse est non', () => {
    expect(whatsappNumberOf(fiche(WhatsappStatus.NON_DEMANDE))).toBeNull();
    expect(whatsappNumberOf(fiche(WhatsappStatus.AUCUN))).toBeNull();
  });
});

describe('ce que le recueil écrit sur la fiche', () => {
  it('MEME_NUMERO ne RECOPIE PAS le téléphone : la copie divergerait à la première correction', () => {
    const patch = resolveWhatsappPatch(
      { whatsappStatus: WhatsappStatus.MEME_NUMERO },
      fiche(WhatsappStatus.NON_DEMANDE),
    );

    expect(patch).toEqual({ whatsappStatus: WhatsappStatus.MEME_NUMERO });
    expect(patch.whatsappE164).toBeUndefined();
  });

  it('refuse un numéro porté par un statut qui l’interdit', () => {
    for (const statut of [
      WhatsappStatus.NON_DEMANDE,
      WhatsappStatus.MEME_NUMERO,
      WhatsappStatus.AUCUN,
    ]) {
      expect(() =>
        resolveWhatsappPatch(
          { whatsappStatus: statut, whatsappE164: AUTRE },
          fiche(WhatsappStatus.NON_DEMANDE),
        ),
      ).toThrow(BadRequestException);
    }
  });

  it('refuse un numéro seul quand la fiche n’est pas déjà en AUTRE_NUMERO', () => {
    expect(() =>
      resolveWhatsappPatch({ whatsappE164: AUTRE }, fiche(WhatsappStatus.MEME_NUMERO)),
    ).toThrow(BadRequestException);
  });

  it('refuse AUTRE_NUMERO sans numéro quand la fiche n’en porte aucun', () => {
    expect(() =>
      resolveWhatsappPatch(
        { whatsappStatus: WhatsappStatus.AUTRE_NUMERO },
        fiche(WhatsappStatus.NON_DEMANDE),
      ),
    ).toThrow(BadRequestException);
  });

  it('normalise le numéro dicté, quelle que soit la forme de saisie', () => {
    for (const saisie of ['78 000 00 01', '00221 78 000 00 01', '221780000001']) {
      const patch = resolveWhatsappPatch(
        { whatsappStatus: WhatsappStatus.AUTRE_NUMERO, whatsappE164: saisie },
        fiche(WhatsappStatus.NON_DEMANDE),
      );
      expect(patch.whatsappE164, saisie).toBe(AUTRE);
    }
  });

  it('corrige le seul numéro quand la fiche est déjà en AUTRE_NUMERO', () => {
    const patch = resolveWhatsappPatch(
      { whatsappE164: '78 000 00 02' },
      fiche(WhatsappStatus.AUTRE_NUMERO, AUTRE),
    );

    expect(patch).toEqual({ whatsappE164: '+221780000002' });
  });

  it('reposter AUTRE_NUMERO sans redire le numéro laisse celui de la fiche en place', () => {
    const patch = resolveWhatsappPatch(
      { whatsappStatus: WhatsappStatus.AUTRE_NUMERO },
      fiche(WhatsappStatus.AUTRE_NUMERO, AUTRE),
    );

    expect(patch).toEqual({ whatsappStatus: WhatsappStatus.AUTRE_NUMERO });
  });

  it('EFFACE le numéro dédié en quittant AUTRE_NUMERO, sinon le CHECK refuserait l’écriture', () => {
    const patch = resolveWhatsappPatch(
      { whatsappStatus: WhatsappStatus.AUCUN },
      fiche(WhatsappStatus.AUTRE_NUMERO, AUTRE),
    );

    expect(patch).toEqual({ whatsappStatus: WhatsappStatus.AUCUN, whatsappE164: null });
  });

  it('la profession voyage seule : un appel qui n’apprend qu’elle n’écrit qu’elle', () => {
    expect(
      resolveWhatsappPatch({ profession: '  Enseignant  ' }, fiche(WhatsappStatus.AUCUN)),
    ).toEqual({ profession: 'Enseignant' });
  });

  it('une profession vide efface la valeur', () => {
    expect(resolveWhatsappPatch({ profession: '   ' }, fiche(WhatsappStatus.AUCUN))).toEqual({
      profession: null,
    });
  });

  it('un appel qui n’apprend rien sur ce point n’écrit rien', () => {
    expect(resolveWhatsappPatch({}, fiche(WhatsappStatus.AUTRE_NUMERO, AUTRE))).toEqual({});
  });
});
