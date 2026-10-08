'use client';

import { Champ } from '@/components/historique/historique';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProspectRow } from '@/lib/types';

type Question = keyof ProspectRow['reponsesFormulaire'];

const QUESTIONS: readonly (readonly [Question, string])[] = [
  ['projet', 'Projet'],
  ['zone', 'Zone recherchée'],
  ['budget', 'Budget / salaire'],
  ['modalitePaiement', 'Modalité de paiement'],
  ['echeance', 'Échéance du projet'],
  ['roleDecision', 'Rôle dans la décision'],
];

/**
 * Les réponses au formulaire Meta, telles que le classeur des leads les livre :
 * le prospect les saisit librement, elles ne sont jamais interprétées. Sans
 * réponse, pas de carte.
 */
export function ReponsesFormulaire({ prospect }: { prospect: ProspectRow }) {
  const reponses = QUESTIONS.flatMap(([cle, libelle]) => {
    const reponse = prospect.reponsesFormulaire[cle];
    return reponse == null || reponse === '' ? [] : [{ cle, libelle, reponse }];
  });
  if (reponses.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réponses au formulaire</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-[0.875rem] sm:grid-cols-2">
          {reponses.map(({ cle, libelle, reponse }) => (
            <Champ key={cle} label={libelle}>
              <span className="break-words">{reponse}</span>
            </Champ>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
