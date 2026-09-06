import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { PARAMETRES_USINE, ecrireValeur, lireValeur, peutEcrire } from './parametres.js';

describe('qui règle quoi', () => {
  it('l’administrateur règle tout', () => {
    expect(peutEcrire(Role.ADMIN, 'plateformeChuesUrl')).toBe(true);
    expect(peutEcrire(Role.ADMIN, 'destinatairesBpe')).toBe(true);
    expect(peutEcrire(Role.ADMIN, 'messageWhatsapp')).toBe(true);
  });

  // Un lien ou une adresse faux détournent des inscriptions sans que personne
  // ne s'en aperçoive, et la liste des destinataires décide qui lit les
  // demandes. Les deux textes n'engagent que leur formulation.
  it('la supervision et la direction n’écrivent que les deux textes', () => {
    for (const role of [Role.SUPERVISEUR, Role.DIRECTION]) {
      expect(peutEcrire(role, 'messageWhatsapp')).toBe(true);
      expect(peutEcrire(role, 'accuseReceptionObjet')).toBe(true);
      expect(peutEcrire(role, 'accuseReceptionCorps')).toBe(true);
      expect(peutEcrire(role, 'plateformeChuesUrl')).toBe(false);
      expect(peutEcrire(role, 'emailChues')).toBe(false);
      expect(peutEcrire(role, 'destinatairesSupervision')).toBe(false);
    }
  });

  it('le téléconseiller ne règle rien', () => {
    expect(peutEcrire(Role.COMMERCIAL, 'messageWhatsapp')).toBe(false);
    expect(peutEcrire(Role.COMMERCIAL, 'plateformeChuesUrl')).toBe(false);
  });
});

describe('les listes de destinataires', () => {
  it('font l’aller-retour par la colonne de texte', () => {
    const ecrite = ecrireValeur(['a@cpi.sn', 'b@cpi.sn']);

    expect(lireValeur('destinatairesBpe', ecrite)).toEqual(['a@cpi.sn', 'b@cpi.sn']);
  });

  // Une valeur illisible ne doit pas emporter l'écran entier : le réglage
  // retombe sur sa valeur d'usine, et l'administrateur le corrige.
  it('une valeur illisible rend une liste vide, pas une exception', () => {
    expect(lireValeur('destinatairesBpe', 'ceci n’est pas du JSON')).toEqual([]);
    expect(lireValeur('destinatairesBpe', '"une chaîne"')).toEqual([]);
    expect(lireValeur('destinatairesBpe', '[1, "a@cpi.sn", null]')).toEqual(['a@cpi.sn']);
  });

  it('un texte reste un texte', () => {
    expect(lireValeur('messageWhatsapp', 'Bonjour {prenom}')).toBe('Bonjour {prenom}');
  });
});

describe('les valeurs d’usine', () => {
  // Inventer une URL enverrait les prospects nulle part sans que personne ne
  // s'en aperçoive. Les deux textes, eux, viennent de l'expression de besoins.
  it('laissent vides les liens, l’adresse et le numéro', () => {
    expect(PARAMETRES_USINE.plateformeChuesUrl).toBe('');
    expect(PARAMETRES_USINE.plateformeGrandPublicUrl).toBe('');
    expect(PARAMETRES_USINE.emailChues).toBe('');
    expect(PARAMETRES_USINE.whatsappChuesE164).toBe('');
  });

  it('portent les deux textes du document', () => {
    expect(PARAMETRES_USINE.accuseReceptionObjet).toBe('Votre demande CPI CHUES a bien été reçue');
    expect(PARAMETRES_USINE.messageWhatsapp).toContain('{lien}');
    expect(PARAMETRES_USINE.accuseReceptionCorps).toContain('{informations}');
  });
});
