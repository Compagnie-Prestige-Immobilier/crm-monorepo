import { WhatsappStatus } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { whatsappDuProspect } from './whatsapp.js';

const APPELE = '+221771234567';
const AUTRE = '+221775554433';

const neuf = {
  whatsappStatus: WhatsappStatus.NON_DEMANDE,
  whatsappE164: null,
  phoneE164: APPELE,
};

describe('whatsappDuProspect', () => {
  it('ne touche à rien quand la question n’a pas été posée', () => {
    expect(whatsappDuProspect({}, neuf)).toEqual({});
  });

  it('« oui » garde le numéro appelé sans le recopier', () => {
    expect(whatsappDuProspect({ statut: WhatsappStatus.MEME_NUMERO, numero: APPELE }, neuf)).toEqual(
      { whatsappStatus: WhatsappStatus.MEME_NUMERO, whatsappE164: null },
    );
  });

  it('« non » avec un second numéro le retient', () => {
    expect(whatsappDuProspect({ statut: WhatsappStatus.AUTRE_NUMERO, numero: AUTRE }, neuf)).toEqual(
      { whatsappStatus: WhatsappStatus.AUTRE_NUMERO, whatsappE164: AUTRE },
    );
  });

  // Le champ est facultatif : « non » sans second numéro ne peut pas rester
  // AUTRE_NUMERO, le CHECK l'interdit. AUCUN dit exactement la même chose.
  it('« non » sans second numéro retombe sur AUCUN plutôt que de violer le CHECK', () => {
    expect(whatsappDuProspect({ statut: WhatsappStatus.AUTRE_NUMERO }, neuf)).toEqual({
      whatsappStatus: WhatsappStatus.AUCUN,
      whatsappE164: null,
    });
  });

  // Les versions déjà installées envoient le numéro de la diaspora SEUL. Un
  // refus perdrait la saisie ; le statut se déduit.
  it('déduit le statut d’un numéro envoyé sans statut', () => {
    expect(whatsappDuProspect({ numero: AUTRE }, neuf)).toEqual({
      whatsappStatus: WhatsappStatus.AUTRE_NUMERO,
      whatsappE164: AUTRE,
    });
    expect(whatsappDuProspect({ numero: APPELE }, neuf)).toEqual({
      whatsappStatus: WhatsappStatus.MEME_NUMERO,
      whatsappE164: null,
    });
  });

  it('un vidage explicite remet la question à « non posée »', () => {
    expect(
      whatsappDuProspect(
        { numero: null },
        { whatsappStatus: WhatsappStatus.AUTRE_NUMERO, whatsappE164: AUTRE, phoneE164: APPELE },
      ),
    ).toEqual({ whatsappStatus: WhatsappStatus.NON_DEMANDE, whatsappE164: null });
  });

  it('un statut reposé seul garde le numéro déjà connu', () => {
    expect(
      whatsappDuProspect(
        { statut: WhatsappStatus.AUTRE_NUMERO },
        { whatsappStatus: WhatsappStatus.AUTRE_NUMERO, whatsappE164: AUTRE, phoneE164: APPELE },
      ),
    ).toEqual({ whatsappStatus: WhatsappStatus.AUTRE_NUMERO, whatsappE164: AUTRE });
  });
});
