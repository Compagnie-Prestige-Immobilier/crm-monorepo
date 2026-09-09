import type { RefObject } from 'react';

import { Choix, ChoixEcheance, Question, REVELE } from '@/components/chues/console-ui';
import {
  QuestionsJoignable,
  QuestionSuggestion,
  type ChampsJoignable,
  type ChampsSuggestion,
} from '@/components/chues/rep-questions';
import { RESULTATS, type Resultat } from '@/components/chues/rep-reponse';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { libelleStatut, type StatutQualification } from '@/lib/data/statuts-qualification';
import { cn } from '@/lib/utils';

/** Le vocabulaire du référentiel, borné à la branche que le résultat ouvre. */
function ChoixStatut({
  statuts,
  value,
  onChange,
  onFerme,
  pose,
}: {
  statuts: readonly StatutQualification[];
  value: string | null;
  onChange: (valeur: string | null) => void;
  onFerme: () => void;
  pose: StatutQualification | null;
}) {
  const items = statuts.map((statut) => ({ value: statut.id, label: libelleStatut(statut) }));

  return (
    <div className={cn('flex max-w-80 flex-col gap-1.5', REVELE)}>
      <label htmlFor="rep-statut" className="text-[1rem] font-[600]">
        Statut de qualification
      </label>
      <Select
        items={items}
        value={value}
        onValueChange={(valeur) => {
          onChange(valeur === null ? null : String(valeur));
        }}
        onOpenChangeComplete={(ouvert) => {
          if (!ouvert) onFerme();
        }}
      >
        <SelectTrigger id="rep-statut">
          <SelectValue placeholder={pose === null ? 'Choisir un statut' : libelleStatut(pose)} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pose === null || value !== null ? null : (
        <p className="text-[0.8125rem] text-muted-foreground">
          Posé par votre réponse. Choisissez-en un autre s’il y a lieu.
        </p>
      )}
    </div>
  );
}

export interface EtapeQuestionsProps {
  resultat: Resultat | null;
  onResultat: (valeur: Resultat) => void;
  statuts: readonly StatutQualification[];
  statutId: string | null;
  onStatut: (valeur: string | null) => void;
  onStatutFerme: () => void;
  statutPose: StatutQualification | null;
  exigeRappel: boolean;
  joignable: boolean;
  proposeQuelquUn: boolean;
  questionsJoignable: ChampsJoignable;
  suggestion: ChampsSuggestion;
  rappel: { now: number; value: string | null; onChange: (valeur: string | null) => void };
  commentaire: string;
  onCommentaire: (valeur: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  motifObligatoire: boolean;
  manque: string | null;
  onContinuer: () => void;
}

/** La première étape : les questions, dans l'ordre où l'appel les pose. */
export function EtapeQuestions({ inputRef, ...props }: EtapeQuestionsProps) {
  return (
    <div className="flex flex-col gap-5 pb-20">
      <Question titre="Comment s’est passé l’appel ?">
        <Choix options={RESULTATS} value={props.resultat} onChange={props.onResultat} />
      </Question>

      {props.joignable ? <QuestionsJoignable {...props.questionsJoignable} /> : null}

      {props.proposeQuelquUn ? <QuestionSuggestion {...props.suggestion} /> : null}

      {props.resultat === null ? null : (
        <ChoixStatut
          statuts={props.statuts}
          value={props.statutId}
          onChange={props.onStatut}
          onFerme={props.onStatutFerme}
          pose={props.statutPose}
        />
      )}

      {/* L'échéance ne se demande qu'au statut qui la réclame : proposée sur
          tout appel abouti, elle armait un rappel que personne n'avait promis. */}
      {props.exigeRappel ? (
        <Question titre="Quand rappeler ?" anime>
          <ChoixEcheance
            now={props.rappel.now}
            value={props.rappel.value}
            onChange={props.rappel.onChange}
          />
        </Question>
      ) : null}

      {props.resultat === null ? null : (
        <Question
          titre={props.motifObligatoire ? 'Pourquoi ?' : 'Quelque chose à ajouter ? (facultatif)'}
          anime
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rep-commentaire" className="text-[0.875rem] font-[600]">
              {props.motifObligatoire ? 'Motif' : 'Commentaire'}
            </label>
            <Textarea
              id="rep-commentaire"
              ref={inputRef}
              rows={3}
              maxLength={2000}
              placeholder="En une phrase"
              value={props.commentaire}
              onChange={(evenement) => {
                props.onCommentaire(evenement.target.value);
              }}
            />
          </div>
        </Question>
      )}

      <div className="sticky bottom-0 -mx-1 flex flex-col gap-1.5 border-t border-border bg-background px-1 py-3">
        <Button className="self-start" disabled={props.manque !== null} onClick={props.onContinuer}>
          Continuer
        </Button>
        {props.manque === null ? null : (
          <p className="text-[0.8125rem] text-muted-foreground">{props.manque}</p>
        )}
      </div>
    </div>
  );
}
