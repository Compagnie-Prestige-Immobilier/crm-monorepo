import { describe, expect, it } from 'vitest';

import {
  EMPTY_AUDIENCE,
  audienceProblem,
  audienceQuery,
  confirmationSentence,
  describeAudience,
  routeProblem,
} from '@/components/notifications/audience';
import {
  extractVariables,
  mergedVariables,
  previewClamp,
  renderNotification,
  renderTemplate,
} from '@/components/notifications/template';
import type { NotificationRow } from '@/components/notifications/types';

/**
 * Compositeur de notifications — logique pure.
 *
 * Ces tests portent sur ce qui décide d'un ENVOI NON ANNULABLE : la description
 * du public, le nombre annoncé, et la substitution du texte. Le rendu React
 * n'est pas testé ici — le projet n'embarque ni jsdom ni testing-library, et
 * l'essentiel de ce qui peut mal tourner est de toute façon dans ces fonctions.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Substitution — doit avoir la MÊME sémantique que le serveur
// ─────────────────────────────────────────────────────────────────────────────

describe('substitution de gabarit (miroir du serveur)', () => {
  it('remplace ce qui est fourni', () => {
    expect(renderTemplate('Bonjour {{nom}}', { nom: 'Awa' }).text).toBe('Bonjour Awa');
  });

  it('LAISSE le marqueur visible quand la variable manque, et la signale', () => {
    // Sémantique identique à `apps/api/src/modules/notifications/template.ts`.
    // Si les deux divergent, l'aperçu ment sur ce qui partira.
    const result = renderTemplate('Bonjour {{nom}}, {{nombre}} fiches', { nombre: 3 });
    expect(result.text).toBe('Bonjour {{nom}}, 3 fiches');
    expect(result.missing).toEqual(['nom']);
  });

  it('traite une variable vide comme manquante', () => {
    expect(renderTemplate('Bonjour {{nom}}', { nom: '' }).missing).toEqual(['nom']);
  });

  it('tolère les espaces dans les accolades', () => {
    expect(extractVariables('{{ nom }} et {{nombre}}')).toEqual(['nom', 'nombre']);
  });

  it('fusionne les variables du titre puis du corps, sans doublon', () => {
    expect(mergedVariables('{{nom}} — rappel', '{{nombre}} fiches pour {{nom}}')).toEqual([
      'nom',
      'nombre',
    ]);
  });

  it('fusionne les manquantes du titre et du corps', () => {
    const rendered = renderNotification('{{a}}', '{{b}} et {{a}}', {});
    expect(rendered.missing).toEqual(['a', 'b']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aperçu Android
// ─────────────────────────────────────────────────────────────────────────────

describe('troncature de l’aperçu', () => {
  it('laisse un texte court intact', () => {
    expect(previewClamp('Réunion demain', 42)).toEqual({
      text: 'Réunion demain',
      truncated: false,
    });
  });

  it('coupe et SIGNALE la coupure', () => {
    // L'auteur doit savoir que sa phrase sera coupée. L'apprendre après l'envoi,
    // sur son propre téléphone, est trop tard.
    const result = previewClamp('a'.repeat(60), 42);
    expect(result.truncated).toBe(true);
    expect(result.text.endsWith('…')).toBe(true);
  });

  it('aplatit les retours à la ligne, qu’Android n’affiche pas repliés', () => {
    expect(previewClamp('Ligne 1\n\nLigne 2', 80).text).toBe('Ligne 1 Ligne 2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Public
// ─────────────────────────────────────────────────────────────────────────────

describe('validation du public', () => {
  it('« tout le monde » est complet en soi', () => {
    expect(audienceProblem(EMPTY_AUDIENCE)).toBeNull();
  });

  it('« par rôle » exige un rôle, et le DIT', () => {
    // Un booléen nu obligerait l'interface à réinventer la raison du refus,
    // et elle finirait par afficher « formulaire invalide ».
    expect(audienceProblem({ ...EMPTY_AUDIENCE, audience: 'ROLE' })).toBe('Choisissez un rôle.');
    expect(
      audienceProblem({ ...EMPTY_AUDIENCE, audience: 'ROLE', audienceRole: 'COMMERCIAL' }),
    ).toBeNull();
  });

  it('« par département » exige un département', () => {
    expect(audienceProblem({ ...EMPTY_AUDIENCE, audience: 'DEPARTEMENT' })).toBe(
      'Choisissez un département.',
    );
  });

  it('« comptes choisis » exige au moins un compte', () => {
    expect(audienceProblem({ ...EMPTY_AUDIENCE, audience: 'USERS' })).toBe(
      'Choisissez au moins un compte.',
    );
    expect(
      audienceProblem({ ...EMPTY_AUDIENCE, audience: 'USERS', audienceUserIds: ['a'] }),
    ).toBeNull();
  });
});

describe('paramètres de l’aperçu', () => {
  it('n’envoie que ce qui concerne le public choisi', () => {
    // Le filtre de l'aperçu doit être EXACTEMENT celui de l'envoi : c'est ce
    // qui garantit que le nombre annoncé est celui qui sera servi.
    expect(
      audienceQuery({
        audience: 'ROLE',
        audienceRole: 'COMMERCIAL',
        audienceDepartementId: 'dep-1',
        audienceUserIds: ['a', 'b'],
      }),
    ).toEqual({ audience: 'ROLE', audienceRole: 'COMMERCIAL' });
  });

  it('sérialise les comptes en liste séparée par des virgules', () => {
    expect(
      audienceQuery({ ...EMPTY_AUDIENCE, audience: 'USERS', audienceUserIds: ['a', 'b'] }),
    ).toEqual({ audience: 'USERS', audienceUserIds: 'a,b' });
  });

  it('omet un champ vide plutôt que d’envoyer une chaîne vide', () => {
    expect(audienceQuery({ ...EMPTY_AUDIENCE, audience: 'DEPARTEMENT' })).toEqual({
      audience: 'DEPARTEMENT',
    });
  });
});

describe('description du public dans l’historique', () => {
  const row = (
    over: Partial<Pick<NotificationRow, 'audience' | 'audienceRole' | 'audienceUserIds'>>,
  ): Pick<NotificationRow, 'audience' | 'audienceRole' | 'audienceUserIds'> => ({
    audience: 'ALL',
    audienceRole: null,
    audienceUserIds: [],
    ...over,
  });

  it('nomme le rôle plutôt que « par rôle »', () => {
    expect(describeAudience(row({ audience: 'ROLE', audienceRole: 'COMMERCIAL' }))).toBe(
      'Commercial',
    );
  });

  it('accorde le singulier', () => {
    expect(describeAudience(row({ audience: 'USERS', audienceUserIds: ['a'] }))).toBe(
      '1 compte choisi',
    );
    expect(describeAudience(row({ audience: 'USERS', audienceUserIds: ['a', 'b'] }))).toBe(
      '2 comptes choisis',
    );
  });

  it('nomme le département quand il est connu', () => {
    expect(describeAudience(row({ audience: 'DEPARTEMENT' }), 'Dakar')).toBe('Département Dakar');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Confirmation
// ─────────────────────────────────────────────────────────────────────────────

describe('phrase de confirmation', () => {
  it('annonce le NOMBRE — sans lui, la confirmation ne protège de rien', () => {
    expect(confirmationSentence(400, 400)).toBe('Cet envoi s’adresse à 400 personnes.');
  });

  it('accorde le singulier', () => {
    expect(confirmationSentence(1, 1)).toBe('Cet envoi s’adresse à 1 personne.');
  });

  it('DISTINGUE les destinataires injoignables', () => {
    // Sans cette phrase, l'admin croit avoir touché 400 personnes alors que 120
    // n'ont aucun appareil enregistré.
    const sentence = confirmationSentence(400, 280);
    expect(sentence).toContain('400 personnes');
    expect(sentence).toContain('120');
    expect(sentence).toContain('n’ont aucun appareil enregistré');
  });

  it('accorde le singulier sur les injoignables', () => {
    expect(confirmationSentence(2, 1)).toContain('1 d’entre elles n’a aucun appareil');
  });

  it('dit franchement qu’un public vide n’enverra rien', () => {
    expect(confirmationSentence(0, 0)).toBe(
      'Ce public ne correspond à aucun compte actif. Rien ne sera envoyé.',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lien profond
// ─────────────────────────────────────────────────────────────────────────────

describe('validation du lien profond', () => {
  it('accepte une route interne', () => {
    expect(routeProblem('/phase2')).toBeNull();
    expect(routeProblem('/phase2?phone=%2B221771234567')).toBeNull();
    expect(routeProblem('/a-corriger')).toBeNull();
  });

  it('accepte le champ vide — le lien est facultatif', () => {
    expect(routeProblem('')).toBeNull();
    expect(routeProblem('   ')).toBeNull();
  });

  it('REFUSE une adresse web', () => {
    // Une URL dans une notification portant le logo de l'application est un
    // vecteur d'hameçonnage que l'utilisateur ne peut pas inspecter avant
    // d'appuyer.
    expect(routeProblem('https://exemple.test/piege')).not.toBeNull();
    expect(routeProblem('http://exemple.test')).not.toBeNull();
  });

  it('refuse une route sans barre oblique initiale', () => {
    expect(routeProblem('phase2')).not.toBeNull();
  });
});
