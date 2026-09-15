'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { CATALOGUE_SECOURS } from '@/components/console/console-view';
import { SelectStatut } from '@/components/console/select-statut';
import { Field } from '@/components/forms/field';
import {
  CarteHistoire,
  Champ,
  Historique,
  type EvenementHistorique,
} from '@/components/historique/historique';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fetchMotifsAppel, issueDuMotif } from '@/lib/data/call-outcome-reasons';
import {
  fetchProspect,
  fetchProspectCallAttempts,
  updateCallAttempt,
  type CallAttemptState,
  type ProspectCallAttempt,
  type UpdateCallAttemptInput,
} from '@/lib/data/prospects';
import { dakarLocalToIso, formatDate, formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { CALL_OUTCOME_LABELS, CALL_OUTCOME_VARIANTS, type ProspectRow } from '@/lib/types';

type Modification = ProspectCallAttempt['modifications'][number];

const statutDe = (etat: Pick<CallAttemptState, 'outcome' | 'reasonLabel'>): string =>
  etat.reasonLabel ?? CALL_OUTCOME_LABELS[etat.outcome];

const commentaireDe = (comment: string | null): string =>
  comment === null || comment === '' ? 'Aucun' : comment;

const rappelDe = (callbackAt: string | null): string =>
  callbackAt === null ? 'Aucun' : formatDateTime(callbackAt);

const auteurDe = (modification: Modification): string => modification.userName ?? 'Auteur inconnu';

const cleAppels = (prospectId: string) => ['prospects', 'call-attempts', prospectId] as const;

function Changements({ modification }: { modification: Modification }) {
  const { avant, apres } = modification;
  const lignes = [
    { label: 'Statut', avant: statutDe(avant), apres: statutDe(apres) },
    {
      label: 'Commentaire',
      avant: commentaireDe(avant.comment),
      apres: commentaireDe(apres.comment),
    },
    { label: 'Rappel', avant: rappelDe(avant.callbackAt), apres: rappelDe(apres.callbackAt) },
  ].filter((ligne) => ligne.avant !== ligne.apres);

  if (lignes.length === 0) {
    return <p className="text-muted-foreground">Enregistré sans changement.</p>;
  }
  return (
    <dl className="grid gap-3">
      {lignes.map((ligne) => (
        <Champ key={ligne.label} label={ligne.label}>
          {ligne.avant} → {ligne.apres}
        </Champ>
      ))}
    </dl>
  );
}

function evenementAppel(appel: ProspectCallAttempt, action: ReactNode): EvenementHistorique {
  return {
    id: appel.id,
    categorie: 'appel',
    at: appel.clientCreatedAt,
    titre: statutDe(appel),
    variant: CALL_OUTCOME_VARIANTS[appel.outcome],
    resume: appel.comment,
    acteur: appel.performedByName,
    source: appel.modifications.length === 0 ? null : 'Modifié',
    action: appel.editable ? action : undefined,
    detail: (
      <>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Champ label="Statut">{statutDe(appel)}</Champ>
          <Champ label="Rappel">{rappelDe(appel.callbackAt)}</Champ>
        </dl>
        <section className="flex flex-col gap-1">
          <p className="eyebrow text-muted-foreground">Commentaire</p>
          <p className="whitespace-pre-wrap">{commentaireDe(appel.comment)}</p>
        </section>
        {appel.modifications.length === 0 ? null : (
          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="eyebrow text-muted-foreground">Modifications</p>
            <ol className="flex flex-col gap-4">
              {appel.modifications.map((modification) => (
                <li key={modification.at} className="flex flex-col gap-2">
                  <p className="text-[0.75rem] text-muted-foreground tabular-nums">
                    {formatDateTime(modification.at)} · {auteurDe(modification)}
                  </p>
                  <Changements modification={modification} />
                </li>
              ))}
            </ol>
          </section>
        )}
      </>
    ),
  };
}

const evenementsModification = (appel: ProspectCallAttempt): EvenementHistorique[] =>
  appel.modifications.map((modification) => ({
    id: `${appel.id}-${modification.at}`,
    categorie: 'appel',
    at: modification.at,
    titre: 'Appel modifié',
    resume: `Appel du ${formatDateTime(appel.clientCreatedAt)}`,
    acteur: auteurDe(modification),
    detail: <Changements modification={modification} />,
  }));

function ModifierAppel({
  appel,
  prospectId,
  onFicheModifiee,
}: {
  appel: ProspectCallAttempt;
  prospectId: string;
  onFicheModifiee: (fiche: ProspectRow) => void;
}) {
  const queryClient = useQueryClient();
  const motifs = useQuery({
    queryKey: queryKeys.motifsAppel,
    queryFn: () => fetchMotifsAppel(),
    staleTime: 300_000,
  });
  const proposes = (motifs.data ?? CATALOGUE_SECOURS).filter(
    (motif) => motif.effect !== 'CLOSE_METHOD',
  );
  const [ouvert, setOuvert] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [rappel, setRappel] = useState('');
  const motif = proposes.find((item) => item.code === code) ?? null;
  const avecRappel = motif?.effect === 'SCHEDULE_CALLBACK';

  const envoi = useMutation({
    mutationFn: (corps: UpdateCallAttemptInput) => updateCallAttempt(appel.id, corps),
    onSuccess: async () => {
      toast.success(`Appel du ${formatDate(appel.clientCreatedAt)} modifié.`);
      setOuvert(false);
      void queryClient.invalidateQueries({ queryKey: cleAppels(prospectId) });
      try {
        onFicheModifiee(await fetchProspect(prospectId));
      } catch (error) {
        toastApiError(error, 'La fiche n’a pas pu être rafraîchie. Rechargez la page.');
      }
    },
    onError: (error) => {
      toastApiError(error, 'L’appel n’a pas été modifié. Réessayez.');
    },
  });

  const ouvrir = () => {
    setCode(appel.reasonCode);
    setCommentaire(appel.comment ?? '');
    // Dakar est à UTC+0 : l'heure UTC est celle que le champ attend.
    setRappel(
      appel.callbackAt === null ? '' : new Date(appel.callbackAt).toISOString().slice(0, 16),
    );
    setOuvert(true);
  };

  const enregistrer = () => {
    if (motif === null || envoi.isPending) return;
    const texte = commentaire.trim();
    envoi.mutate({
      outcome: issueDuMotif(motif),
      reasonCode: motif.code,
      comment: texte === '' ? null : texte,
      callbackAt: avecRappel ? dakarLocalToIso(rappel) : null,
    });
  };

  return (
    <>
      <Button size="sm" onClick={ouvrir}>
        <PencilIcon aria-hidden="true" />
        Modifier l’appel
      </Button>
      <Dialog
        open={ouvert}
        onOpenChange={(suivant) => {
          if (!suivant && envoi.isPending) return;
          setOuvert(suivant);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l’appel du {formatDate(appel.clientCreatedAt)}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              enregistrer();
            }}
          >
            <SelectStatut
              catalogue={proposes}
              motif={motif}
              disabled={envoi.isPending}
              onChange={(choisi) => {
                setCode(choisi.code);
              }}
            />
            <Field label="Commentaire">
              {(props) => (
                <Textarea
                  {...props}
                  value={commentaire}
                  disabled={envoi.isPending}
                  onChange={(event) => {
                    setCommentaire(event.target.value);
                  }}
                />
              )}
            </Field>
            {avecRappel ? (
              <Field label="Date du rappel" description="Heure de Dakar.">
                {(props) => (
                  <Input
                    {...props}
                    type="datetime-local"
                    className="max-w-64"
                    value={rappel}
                    disabled={envoi.isPending}
                    onChange={(event) => {
                      setRappel(event.target.value);
                    }}
                  />
                )}
              </Field>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={envoi.isPending}
                onClick={() => {
                  setOuvert(false);
                }}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={motif === null || envoi.isPending}>
                {envoi.isPending ? 'Enregistrement' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Les appels consignés sur la fiche Grand Public et leurs modifications. */
export function HistoriqueAppels({
  prospect,
  onFicheModifiee,
}: {
  prospect: ProspectRow;
  onFicheModifiee: (fiche: ProspectRow) => void;
}) {
  const appels = useQuery({
    queryKey: cleAppels(prospect.id),
    queryFn: () => fetchProspectCallAttempts(prospect.id),
  });
  const evenements = (appels.data ?? []).flatMap((appel) => [
    evenementAppel(
      appel,
      <ModifierAppel appel={appel} prospectId={prospect.id} onFicheModifiee={onFicheModifiee} />,
    ),
    ...evenementsModification(appel),
  ]);

  return (
    <CarteHistoire
      titre="Historique"
      description="Chaque appel et chaque modification. Cliquez une ligne pour le détail."
      sources={[appels]}
    >
      <Historique
        evenements={evenements}
        categories={['appel']}
        vide="Aucun appel consigné. Appelez ce prospect pour commencer son historique."
      />
    </CarteHistoire>
  );
}
