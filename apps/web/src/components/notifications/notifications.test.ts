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

describe('substitution de gabarit (miroir du serveur)', () => {
  it('remplace ce qui est fourni', () => {
    expect(renderTemplate('Bonjour {{nom}}', { nom: 'Awa' }).text).toBe('Bonjour Awa');
  });

  it('LAISSE le marqueur visible quand la variable manque, et la signale', () => {
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
    expect(mergedVariables('{{nom}} : rappel', '{{nombre}} fiches pour {{nom}}')).toEqual([
      'nom',
      'nombre',
    ]);
  });

  it('fusionne les manquantes du titre et du corps', () => {
    const rendered = renderNotification('{{a}}', '{{b}} et {{a}}', {});
    expect(rendered.missing).toEqual(['a', 'b']);
  });
});

describe('troncature de l’aperçu', () => {
  it('laisse un texte court intact', () => {
    expect(previewClamp('Réunion demain', 42)).toEqual({
      text: 'Réunion demain',
      truncated: false,
    });
  });

  it('coupe et SIGNALE la coupure', () => {
    const result = previewClamp('a'.repeat(60), 42);
    expect(result.truncated).toBe(true);
    expect(result.text.endsWith('…')).toBe(true);
  });

  it('aplatit les retours à la ligne, qu’Android n’affiche pas repliés', () => {
    expect(previewClamp('Ligne 1\n\nLigne 2', 80).text).toBe('Ligne 1 Ligne 2');
  });
});

describe('validation du public', () => {
  it('« tout le monde » est complet en soi', () => {
    expect(audienceProblem(EMPTY_AUDIENCE)).toBeNull();
  });

  it('« par rôle » exige un rôle, et le DIT', () => {
    expect(audienceProblem({ ...EMPTY_AUDIENCE, audience: 'ROLE' })).toBe('Choisissez un rôle.');
    expect(
      audienceProblem({ ...EMPTY_AUDIENCE, audience: 'ROLE', audienceRole: 'COMMERCIAL' }),
    ).toBeNull();
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
    expect(
      audienceQuery({
        audience: 'ROLE',
        audienceRole: 'COMMERCIAL',
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
    expect(audienceQuery({ ...EMPTY_AUDIENCE, audience: 'USERS' })).toEqual({
      audience: 'USERS',
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
      'Téléconseiller',
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

  it('garde une étiquette lisible pour les envois « par département » déjà partis', () => {
    expect(describeAudience(row({ audience: 'DEPARTEMENT' }))).toBe('Par département');
  });
});

describe('phrase de confirmation', () => {
  it('annonce le NOMBRE : sans lui, la confirmation ne protège de rien', () => {
    expect(confirmationSentence(400)).toBe('Cet envoi s’adresse à 400 personnes.');
  });

  it('accorde le singulier', () => {
    expect(confirmationSentence(1)).toBe('Cet envoi s’adresse à 1 personne.');
  });

  it('ne parle plus d’appareils enregistrés', () => {
    expect(confirmationSentence(400)).not.toContain('appareil');
  });

  it('dit franchement qu’un public vide n’enverra rien', () => {
    expect(confirmationSentence(0)).toBe(
      'Ce public ne correspond à aucun compte actif. Rien ne sera envoyé.',
    );
  });
});

describe('validation du lien profond', () => {
  it('accepte une route interne', () => {
    expect(routeProblem('/phase2')).toBeNull();
    expect(routeProblem('/phase2?phone=%2B221771234567')).toBeNull();
    expect(routeProblem('/a-corriger')).toBeNull();
  });

  it('accepte le champ vide : le lien est facultatif', () => {
    expect(routeProblem('')).toBeNull();
    expect(routeProblem('   ')).toBeNull();
  });

  it('REFUSE une adresse web', () => {
    expect(routeProblem('https://exemple.test/piege')).not.toBeNull();
    expect(routeProblem('http://exemple.test')).not.toBeNull();
  });

  it('refuse une route sans barre oblique initiale', () => {
    expect(routeProblem('phase2')).not.toBeNull();
  });
});
