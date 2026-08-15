'use client';

import { useEffect, useState } from 'react';

/**
 * Une valeur qui n'est publiée qu'après une PAUSE DE FRAPPE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi ce crochet existe, et pourquoi aucune dépendance n'a été ajoutée.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce bloc de six lignes était recopié à l'identique dans neuf composants : les
 * six barres de filtre, la liste des comptes, celle des demandes clients, le
 * rapprochement de doublons et le formulaire d'ouverture de dossier. Neuf
 * copies d'une même règle, dont l'une avait déjà pris 300 ms là où les autres
 * en prennent 350.
 *
 * La règle n'est pas cosmétique : l'API plafonne à 300 requêtes par minute, et
 * une requête par caractère épuise ce quota au premier nom un peu long : puis
 * le limiteur répond 429, et l'utilisateur croit à une panne parce qu'il a
 * tapé vite. Le délai est donc une décision de produit, et il doit être écrit
 * une fois.
 *
 * Aucun paquet n'est ajouté : le motif tenait déjà en un `useEffect` et un
 * `clearTimeout`, correctement écrits ; il n'avait besoin que d'un nom.
 */

/**
 * Délai commun. 350 ms : assez long pour laisser passer un mot entier, assez
 * court pour que le tableau semble suivre la frappe.
 */
export const SEARCH_DEBOUNCE_MS = 350;

export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    // Le nettoyage est le cœur du mécanisme : chaque frappe annule le minuteur
    // précédent, si bien qu'une seule publication survit à une rafale.
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}
