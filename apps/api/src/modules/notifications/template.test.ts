import { describe, expect, it } from 'vitest';

import { extractVariables, renderNotification, renderTemplate } from './template.js';
import { mergedVariables } from './templates.service.js';

/**
 * Substitution de gabarit.
 *
 * Ces tests fixent la décision la plus discutable du module : une variable
 * manquante laisse son marqueur VISIBLE au lieu d'être remplacée par du vide ou
 * de faire échouer l'envoi. Voir l'en-tête de `template.ts` pour le pourquoi.
 */

describe('extraction des variables', () => {
  it('liste les variables dans l’ordre, sans doublon', () => {
    expect(extractVariables('{{nom}} a {{nombre}} fiches, {{nom}} !')).toEqual(['nom', 'nombre']);
  });

  it('tolère les espaces autour des accolades, qu’un auteur humain met', () => {
    expect(extractVariables('Bonjour {{ nom }}')).toEqual(['nom']);
  });

  it('ignore une accolade simple, qui n’est pas une variable', () => {
    expect(extractVariables('Un objet { nom } littéral')).toEqual([]);
  });

  it('fusionne titre et corps sans doublon, titre d’abord', () => {
    expect(mergedVariables('{{nom}} — rappel', 'Vous avez {{nombre}} tâches, {{nom}}.')).toEqual([
      'nom',
      'nombre',
    ]);
  });
});

describe('substitution', () => {
  it('remplace chaque occurrence', () => {
    const result = renderTemplate('{{nom}} et encore {{nom}}', { nom: 'Awa' });
    expect(result.text).toBe('Awa et encore Awa');
    expect(result.missing).toEqual([]);
  });

  it('accepte un nombre et le rend en texte', () => {
    expect(renderTemplate('{{n}} fiches', { n: 12 }).text).toBe('12 fiches');
  });

  it('LAISSE le marqueur visible quand la variable manque, et la signale', () => {
    // Décision assumée : ni exception (le rappel nocturne ne partirait plus),
    // ni chaîne vide (« Bonjour , vous avez… » ressemble à un bug sans dire
    // lequel). Le marqueur intact NOMME ce qui manque.
    const result = renderTemplate('Bonjour {{nom}}, {{nombre}} fiches', { nombre: 3 });
    expect(result.text).toBe('Bonjour {{nom}}, 3 fiches');
    expect(result.missing).toEqual(['nom']);
  });

  it('traite une chaîne vide comme manquante', () => {
    // Une variable fournie mais vide produirait une phrase trouée exactement
    // comme une variable absente : même traitement, même signalement.
    expect(renderTemplate('Bonjour {{nom}}', { nom: '' }).missing).toEqual(['nom']);
  });

  it('traite null et undefined comme manquants', () => {
    expect(renderTemplate('{{a}}{{b}}', { a: null, b: undefined }).missing).toEqual(['a', 'b']);
  });

  it('ne signale qu’une fois une variable manquante citée deux fois', () => {
    expect(renderTemplate('{{nom}} {{nom}}', {}).missing).toEqual(['nom']);
  });

  it('fusionne les manquantes du titre et du corps', () => {
    const rendered = renderNotification('{{titre}}', 'Bonjour {{nom}}, {{titre}}', {
      autre: 'x',
    });
    expect(rendered.title).toBe('{{titre}}');
    expect(rendered.missing).toEqual(['titre', 'nom']);
  });

  it('laisse un texte sans variable strictement intact', () => {
    const result = renderTemplate('Aucune variable ici.', { nom: 'Awa' });
    expect(result.text).toBe('Aucune variable ici.');
    expect(result.missing).toEqual([]);
  });
});
