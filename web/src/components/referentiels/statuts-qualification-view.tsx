'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, PowerIcon, PowerOffIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { QueryErrorState } from '@/components/query-error-state';
import { RelationBadge } from '@/components/representants/relation-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PRIORITES_TRAITEMENT,
  PRIORITE_TRAITEMENT_LABELS,
  STATUT_QUALIFICATION_EFFECTS,
  STATUT_QUALIFICATION_EFFECT_LABELS,
  createStatutQualification,
  estAbouti,
  exigeMotif,
  fetchAllStatutsQualification,
  setStatutQualificationActive,
  sousStatutsDe,
  statutsRacine,
  updateStatutQualification,
  type PrioriteTraitement,
  type StatutQualification,
  type StatutQualificationEffect,
  type StatutRelationPosee,
} from '@/lib/data/statuts-qualification';
import { REPRESENTANT_RELATION_LABELS } from '@/lib/representant-filters';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

interface Draft {
  label: string;
  effect: StatutQualificationEffect;
  requiresCallback: boolean;
  /** Minutes, en chaîne pour le `Select` ; vide = aucun réessai. */
  reessai: string;
  priorite: PrioriteTraitement;
  relation: RelationChoisie;
  /** Identifiant du statut parent, ou la sentinelle `AUCUNE`. */
  parent: string;
}

/** Les délais proposés d'office après un numéro qui n'a pas répondu. */
const REESSAIS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Aucun' },
  { value: '60', label: 'Dans 1 h' },
  { value: '180', label: 'Dans 3 h' },
  { value: '1440', label: 'Le lendemain' },
];

function libelleReessai(minutes: number): string {
  return REESSAIS.find((r) => r.value === String(minutes))?.label ?? `${String(minutes)} min`;
}

/**
 * Le formulaire ne peut pas porter `null` : la valeur d'un `Select` est une
 * chaine. Cette sentinelle est traduite en `null` a l'enregistrement.
 */
const AUCUNE = 'AUCUNE';

type RelationChoisie = NonNullable<StatutRelationPosee> | typeof AUCUNE;

/** Seules les deux issues qui tranchent se posent : l'étoile, ou le refus. */
const RELATIONS_POSEES: readonly { value: RelationChoisie; label: string }[] = [
  { value: AUCUNE, label: 'Ne tranche pas' },
  { value: 'AMBASSADEUR', label: REPRESENTANT_RELATION_LABELS.AMBASSADEUR },
  { value: 'REFUS', label: REPRESENTANT_RELATION_LABELS.REFUS },
];

const EMPTY: Draft = {
  label: '',
  effect: 'REACHED',
  requiresCallback: false,
  reessai: '',
  priorite: 'NORMALE',
  relation: AUCUNE,
  parent: AUCUNE,
};

/** Chaque statut racine, suivi de ses sous-statuts. */
function parBranche(statuts: StatutQualification[]): StatutQualification[] {
  return statutsRacine(statuts).flatMap((racine) => [racine, ...sousStatutsDe(statuts, racine.id)]);
}

const classeLibelle = (statut: StatutQualification): string =>
  statut.parentId === null ? 'font-[600]' : 'pl-8';

/** Le parent choisi impose son effet ; sans parent, l'effet est celui du formulaire. */
function deriverParent(
  racines: StatutQualification[],
  parent: string,
  effect: StatutQualificationEffect,
) {
  const parentChoisi = racines.find((racine) => racine.id === parent) ?? null;
  return {
    parentChoisi,
    effetRetenu: parentChoisi === null ? effect : parentChoisi.effect,
    descriptionEffet:
      parentChoisi === null
        ? 'Il décide de la branche et de l’issue enregistrée.'
        : `Hérité de « ${parentChoisi.label} ».`,
    parents: [
      { value: AUCUNE, label: 'Aucun, statut de premier niveau' },
      ...racines.map((racine) => ({ value: racine.id, label: racine.label })),
    ],
  };
}

const PRIORITE_VARIANTS: Record<PrioriteTraitement, 'warning' | 'secondary' | 'outline'> = {
  HAUTE: 'warning',
  NORMALE: 'secondary',
  BASSE: 'outline',
};

const relationPosee = (relation: RelationChoisie): StatutRelationPosee =>
  relation === AUCUNE ? null : relation;

export function StatutsQualificationView() {
  const queryClient = useQueryClient();
  const [edite, setEdite] = useState<StatutQualification | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const statuts = useQuery({
    queryKey: queryKeys.statutsQualificationAdmin,
    queryFn: () => fetchAllStatutsQualification(),
  });

  const invalider = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
  };

  const activation = useMutation({
    mutationFn: (variables: { id: string; isActive: boolean }) =>
      setStatutQualificationActive(variables.id, variables.isActive),
    onSuccess: (statut) => {
      invalider();
      toast.success(statut.isActive ? `${statut.label} réactivé.` : `${statut.label} retiré.`);
    },
    onError: (error) => {
      toastApiError(error, 'Le statut n’a pas pu être modifié.');
    },
  });

  if (statuts.isError) {
    return <QueryErrorState error={statuts.error} onRetry={() => void statuts.refetch()} />;
  }

  const lignes = statuts.data ?? [];
  const abouti = parBranche(lignes.filter((statut) => estAbouti(statut.effect)));
  const nonAbouti = parBranche(lignes.filter((statut) => !estAbouti(statut.effect)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-[0.9375rem] text-muted-foreground">
          Ce que le téléconseiller choisit après avoir dit si l’appel a abouti. L’effet décide de la
          branche où le statut se propose et de l’issue enregistrée.
        </p>
        <Button
          onClick={() => {
            setEdite(null);
            setOuvert(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Nouveau statut
        </Button>
      </div>

      {statuts.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Branche
            titre="Appel abouti"
            statuts={abouti}
            onModifier={(statut) => {
              setEdite(statut);
              setOuvert(true);
            }}
            onBasculer={(statut) =>
              activation.mutate({ id: statut.id, isActive: !statut.isActive })
            }
            enCours={activation.isPending}
          />
          <Branche
            titre="Appel non abouti"
            statuts={nonAbouti}
            onModifier={(statut) => {
              setEdite(statut);
              setOuvert(true);
            }}
            onBasculer={(statut) =>
              activation.mutate({ id: statut.id, isActive: !statut.isActive })
            }
            enCours={activation.isPending}
          />
        </>
      )}

      <FormulaireStatut
        statut={edite}
        racines={statutsRacine(lignes).filter((statut) => statut.isActive)}
        open={ouvert}
        onOpenChange={setOuvert}
        onSaved={() => {
          invalider();
          setOuvert(false);
        }}
      />
    </div>
  );
}

function Branche({
  titre,
  statuts,
  onModifier,
  onBasculer,
  enCours,
}: {
  titre: string;
  statuts: StatutQualification[];
  onModifier: (statut: StatutQualification) => void;
  onBasculer: (statut: StatutQualification) => void;
  enCours: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow rail text-muted-foreground">{titre}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Libellé</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Effet</TableHead>
            <TableHead>Priorité</TableHead>
            <TableHead>Décision</TableHead>
            <TableHead>État</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statuts.map((statut) => (
            <TableRow key={statut.id}>
              <TableCell className={classeLibelle(statut)}>
                {statut.label}
                {statut.requiresCallback ? (
                  <Badge variant="outline" className="ml-2">
                    date exigée
                  </Badge>
                ) : null}
                {statut.retryAfterMinutes === null ? null : (
                  <Badge variant="outline" className="ml-2">
                    réessai {libelleReessai(statut.retryAfterMinutes).toLowerCase()}
                  </Badge>
                )}
                {exigeMotif(statut) ? (
                  <Badge variant="outline" className="ml-2">
                    motif exigé
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-muted-foreground">{statut.code}</TableCell>
              <TableCell>{STATUT_QUALIFICATION_EFFECT_LABELS[statut.effect]}</TableCell>
              <TableCell>
                <Badge variant={PRIORITE_VARIANTS[statut.priorite]}>
                  {PRIORITE_TRAITEMENT_LABELS[statut.priorite]}
                </Badge>
              </TableCell>
              <TableCell>
                {statut.relationStatus === null ? (
                  <span className="text-muted-foreground">Ne tranche pas</span>
                ) : (
                  <RelationBadge status={statut.relationStatus} />
                )}
              </TableCell>
              <TableCell>
                <Badge variant={statut.isActive ? 'default' : 'outline'}>
                  {statut.isActive ? 'Proposé' : 'Retiré'}
                </Badge>
                {statut.isSystem ? (
                  <Badge variant="outline" className="ml-2">
                    système
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onModifier(statut)}
                  aria-label={`Modifier ${statut.label}`}
                >
                  <PencilIcon aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={enCours}
                  onClick={() => onBasculer(statut)}
                  aria-label={
                    statut.isActive ? `Retirer ${statut.label}` : `Réactiver ${statut.label}`
                  }
                >
                  {statut.isActive ? (
                    <PowerOffIcon aria-hidden="true" />
                  ) : (
                    <PowerIcon aria-hidden="true" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function FormulaireStatut({
  statut,
  racines,
  open,
  onOpenChange,
  onSaved,
}: {
  statut: StatutQualification | null;
  racines: StatutQualification[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const modification = statut !== null;
  // La règle d'un statut système est celle du script : elle se lit, elle ne se
  // reconfigure pas. Le serveur refuse de toute façon.
  const regleFigee = statut?.isSystem === true;

  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<Draft>({
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      statut === null
        ? EMPTY
        : {
            label: statut.label,
            effect: statut.effect,
            requiresCallback: statut.requiresCallback,
            reessai: statut.retryAfterMinutes === null ? '' : String(statut.retryAfterMinutes),
            priorite: statut.priorite,
            relation: statut.relationStatus ?? AUCUNE,
            parent: statut.parentId ?? AUCUNE,
          },
    );
  }, [open, statut, reset]);

  // oxlint-disable-next-line react/incompatible-library -- faux positif react-hook-form
  const effect = watch('effect');
  const priorite = watch('priorite');
  const relation = watch('relation');
  const reessai = watch('reessai');
  const parent = watch('parent');
  const { parentChoisi, effetRetenu, descriptionEffet, parents } = deriverParent(
    racines,
    parent,
    effect,
  );

  const save = useMutation({
    mutationFn: (values: Draft) =>
      modification
        ? updateStatutQualification(statut.id, {
            label: values.label.trim(),
            priorite: values.priorite,
            relationStatus: relationPosee(values.relation),
            retryAfterMinutes: values.reessai === '' ? null : Number(values.reessai),
            ...(regleFigee ? {} : { requiresCallback: values.requiresCallback }),
          })
        : createStatutQualification({
            label: values.label.trim(),
            ...(values.parent === AUCUNE ? { effect: values.effect } : { parentId: values.parent }),
            requiresCallback: values.requiresCallback,
            // Cet écran ne pose pas la question : seuls les statuts système
            // exigent un motif, et ils ne se créent pas d'ici.
            requiresComment: false,
            retryAfterMinutes: values.reessai === '' ? null : Number(values.reessai),
            priorite: values.priorite,
            relationStatus: relationPosee(values.relation),
          }),
    onSuccess: () => {
      toast.success(modification ? 'Statut modifié.' : 'Statut ajouté.');
      onSaved();
    },
    onError: (error) => {
      toastApiError(error, 'Le statut n’a pas pu être enregistré.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{modification ? 'Modifier le statut' : 'Nouveau statut'}</DialogTitle>
          <DialogDescription>
            {modification
              ? 'Le code ne se change pas : les appels déjà consignés le désignent.'
              : 'Le code se déduit du libellé, puis se fige : les appels consignés le désigneront.'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) => {
            save.mutate(values);
          })}
        >
          <Field label="Libellé" required error={formState.errors.label?.message}>
            {(props) => (
              <Input
                {...props}
                {...register('label', {
                  required: 'Le libellé est obligatoire.',
                  maxLength: { value: 120, message: 'Libellé trop long.' },
                })}
              />
            )}
          </Field>

          <Field
            label="Sous-statut de"
            description="Un sous-statut se propose après son parent et en garde l’effet."
          >
            {(props) => (
              <Select
                items={[...parents]}
                value={parent}
                onValueChange={(value) => {
                  setValue('parent', value ?? AUCUNE);
                  const racine = racines.find((r) => r.id === value);
                  if (racine && racine.effect !== 'SCHEDULE_CALLBACK') {
                    setValue('requiresCallback', false);
                  }
                }}
                disabled={modification}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {parents.map((choix) => (
                    <SelectItem key={choix.value} value={choix.value}>
                      {choix.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field label="Effet" description={descriptionEffet}>
            {(props) => (
              <Select
                items={STATUT_QUALIFICATION_EFFECTS.map((valeur) => ({
                  value: valeur,
                  label: STATUT_QUALIFICATION_EFFECT_LABELS[valeur],
                }))}
                value={effetRetenu}
                onValueChange={(value) => {
                  setValue('effect', value as StatutQualificationEffect);
                  if (value !== 'SCHEDULE_CALLBACK') setValue('requiresCallback', false);
                }}
                disabled={modification || parentChoisi !== null}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUT_QUALIFICATION_EFFECTS.map((valeur) => (
                    <SelectItem key={valeur} value={valeur}>
                      {STATUT_QUALIFICATION_EFFECT_LABELS[valeur]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          {/* La priorite reste ouverte sur une ligne systeme : elle dit dans
              quel ordre le plateau reprend les fiches, pas ce que fait le
              script. */}
          <Field label="Priorité" description="Ordre dans lequel le plateau reprend les fiches.">
            {(props) => (
              <Select
                items={PRIORITES_TRAITEMENT.map((valeur) => ({
                  value: valeur,
                  label: PRIORITE_TRAITEMENT_LABELS[valeur],
                }))}
                value={priorite}
                onValueChange={(value) => {
                  setValue('priorite', value as PrioriteTraitement);
                }}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITES_TRAITEMENT.map((valeur) => (
                    <SelectItem key={valeur} value={valeur}>
                      {PRIORITE_TRAITEMENT_LABELS[valeur]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field
            label="Décision"
            description="Ce que le statut conclut sur la fiche : l’étoile, le refus, ou rien."
          >
            {(props) => (
              <Select
                items={[...RELATIONS_POSEES]}
                value={relation}
                onValueChange={(value) => {
                  setValue('relation', value as RelationChoisie);
                }}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONS_POSEES.map((choix) => (
                    <SelectItem key={choix.value} value={choix.value}>
                      {choix.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          {/* Seul l'effet qui planifie un rappel peut en exiger la date : le
              serveur refuse le reste, autant ne pas le proposer. */}
          <label className="flex items-center gap-2 text-[0.9375rem]">
            <input
              type="checkbox"
              disabled={regleFigee || effetRetenu !== 'SCHEDULE_CALLBACK'}
              {...register('requiresCallback')}
            />
            Exige la date du rappel
          </label>

          <Field
            label="Réessai proposé"
            description="L’application propose ce délai d’elle-même après l’appel. Le téléconseiller peut le déplacer."
          >
            {(props) => (
              <Select
                items={REESSAIS}
                value={reessai}
                onValueChange={(value) => {
                  setValue('reessai', value ?? '');
                }}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REESSAIS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
