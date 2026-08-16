'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, LoaderIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { ProspectSegmentHistory } from '@/components/prospects/prospect-segment-history';
import { classifySegment } from '@/components/prospects/segment';
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
import { Textarea } from '@/components/ui/textarea';
import { changeProspectSegment, updateProspect } from '@/lib/data/prospects';
import { fetchReferenceData } from '@/lib/data/reference';
import { withRetired } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { prospectSchema, type ProspectFormInput } from '@/lib/schemas';
import {
  PROSPECT_STATUTS,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  type BddSegment,
  type ProspectRow,
  type UpdateProspectInput,
} from '@/lib/types';

/** Longueur minimale d'un motif, alignée sur le `@MinLength(5)` de l'API. */
const MIN_REASON_LENGTH = 5;

/**
 * Modification d'un prospect.
 *
 * Les listes de banques, syndicats et représentants sont chargées SANS filtre
 * d'activité : un prospect saisi en mars peut référencer une banque retirée
 * depuis. Ne proposer que les actives forcerait à changer une donnée correcte
 * pour pouvoir corriger un nom de famille.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CHANGER DE BANQUE OU DE SYNDICAT N'EST PAS UNE CORRECTION DE SAISIE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ces deux listes déroulantes sont posées au milieu des autres, entre le
 * téléphone et le représentant, et elles ne ressemblent en rien à ce qu'elles
 * font : le segment BDD1–BDD4 se CALCULE en les croisant. Les toucher fait donc
 * basculer la fiche d'une base à l'autre, et cette bascule est le métier même
 * de CPI, celui dont on rend compte au mois.
 *
 * L'écran devait donc changer sur trois points, faute de quoi la trace écrite
 * en base ne vaudrait rien :
 *
 *  1. le segment COURANT est écrit en clair, avant toute manipulation ;
 *  2. le segment RÉSULTANT s'affiche AVANT la confirmation : personne ne peut
 *     déduire de tête que « CBAO + SAES » vaut BDD3 ;
 *  3. le motif est OBLIGATOIRE, et l'écran dit pourquoi.
 *
 * Et les deux clés ne partent plus dans le `PATCH` ordinaire : elles passent
 * par l'opération dédiée, la seule qui écrive la fiche et son histoire dans la
 * même transaction.
 */
export function ProspectEditDialog({
  prospect,
  onOpenChange,
}: {
  prospect: ProspectRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<ProspectFormInput>({
    resolver: zodResolver(prospectSchema),
    defaultValues: {
      nom: '',
      prenom: '',
      phone: '',
      banqueId: '',
      syndicatId: '',
      representantId: '',
      statut: 'NOUVEAU',
    },
  });

  /**
   * Motif tenu HORS du schéma du formulaire.
   *
   * `prospectSchema` décrit la fiche, et le motif n'en fait pas partie : il
   * décrit un GESTE, il n'est exigé que lorsque les clés de segment bougent, et
   * il n'est jamais renvoyé par l'API. L'ajouter au schéma le rendrait
   * obligatoire pour la correction d'un nom de famille, ou facultatif pour
   * tout le monde — deux façons de perdre ce qu'on cherche à obtenir.
   */
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (prospect === null) return;
    setReason('');
    setReasonError(undefined);
    reset({
      nom: prospect.nom,
      prenom: prospect.prenom,
      phone: prospect.phoneE164,
      banqueId: prospect.banqueId,
      syndicatId: prospect.syndicatId,
      representantId: prospect.representantId,
      statut: prospect.statut,
    });
  }, [prospect, reset]);

  const mutation = useMutation({
    mutationFn: async (values: ProspectFormInput) => {
      if (prospect === null) throw new Error('Aucun prospect sélectionné.');

      const banqueChanged = values.banqueId !== prospect.banqueId;
      const syndicatChanged = values.syndicatId !== prospect.syndicatId;

      // La bascule PASSE EN PREMIER, et seule elle porte les deux clés de
      // segment. Les glisser en plus dans le `PATCH` rejouerait l'écriture sans
      // trace juste après celle qui en laisse une, et une révision de retard
      // suffirait à faire échouer la seconde en laissant la première passée.
      let saved: ProspectRow | undefined;
      if (banqueChanged || syndicatChanged) {
        saved = await changeProspectSegment(prospect.id, {
          ...(banqueChanged ? { banqueId: values.banqueId } : {}),
          ...(syndicatChanged ? { syndicatId: values.syndicatId } : {}),
          reason: reason.trim(),
          expectedRev: prospect.rev,
        });
      }

      const identityChanged =
        values.nom !== prospect.nom ||
        values.prenom !== prospect.prenom ||
        values.phone !== prospect.phoneE164 ||
        values.representantId !== prospect.representantId ||
        values.statut !== prospect.statut;

      if (identityChanged) {
        const patch: UpdateProspectInput = {
          nom: values.nom,
          prenom: values.prenom,
          phone: values.phone,
          representantId: values.representantId,
          statut: values.statut,
        };
        saved = await updateProspect(prospect.id, patch);
      }

      // Ni bascule ni correction : rien n'a été envoyé, et la fiche affichée
      // est déjà celle de la base.
      return saved ?? prospect;
    },
    onSuccess: (saved) => {
      // Les chiffres du tableau de bord dépendent du statut et du référentiel :
      // les invalider aussi, sinon le total « Converti » reste faux à l'écran.
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot });
      toast.success(`${saved.prenom} ${saved.nom} enregistré.`);
      onOpenChange(false);
    },
    onError: (error) => {
      // 409 = un autre prospect porte déjà ce numéro. Le message de l'API nomme
      // la fiche existante ; la fusion est la suite logique.
      toastApiError(error, "L'enregistrement a échoué.");
    },
  });

  const banqueId = watch('banqueId');
  const syndicatId = watch('syndicatId');
  const representantId = watch('representantId');
  const statut = watch('statut');

  /**
   * `Select.Value` de Base UI affiche la VALEUR choisie, pas le texte de l'item.
   * Sans ces tables, les gâchettes montreraient des identifiants bruts au lieu
   * du nom de la banque, du sigle du syndicat ou du libellé du statut.
   */
  const banqueItems = (reference?.banques ?? []).map((banque) => ({
    value: banque.id,
    label: withRetired(banque.shortName, banque.isActive),
  }));
  const syndicatItems = (reference?.syndicats ?? []).map((syndicat) => ({
    value: syndicat.id,
    label: withRetired(syndicat.sigle, syndicat.isActive),
  }));
  const representantItems = reference?.representants ?? [];

  /*
   * L'aperçu du segment d'ARRIVÉE.
   *
   * Il se calcule sur le `shortName` de la banque et le `sigle` du syndicat, et
   * non sur leurs identifiants : ce sont ces deux valeurs qui portent les axes
   * CBAO et CHUES. Tant que le référentiel n'est pas chargé, on ne montre RIEN
   * plutôt qu'un segment deviné : un aperçu faux ferait valider une conversion
   * que personne n'a voulue.
   */
  const selectedBanque = (reference?.banques ?? []).find((banque) => banque.id === banqueId);
  const selectedSyndicat = (reference?.syndicats ?? []).find(
    (syndicat) => syndicat.id === syndicatId,
  );
  const nextSegment: BddSegment | null =
    selectedBanque === undefined || selectedSyndicat === undefined
      ? null
      : classifySegment({
          syndicatSigle: selectedSyndicat.sigle,
          banqueShortName: selectedBanque.shortName,
        });

  const segmentChanged =
    prospect !== null && (banqueId !== prospect.banqueId || syndicatId !== prospect.syndicatId);

  return (
    <Dialog
      open={prospect !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Modifier le prospect</DialogTitle>
          <DialogDescription>Saisi par {prospect?.ownedByCommercialName ?? '–'}.</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            void handleSubmit((values) => {
              // Le motif est contrôlé ICI et pas seulement par l'API : un 400
              // renvoyé après coup dirait « reason must be longer than or equal
              // to 5 characters » sous un formulaire qui ne montre aucun champ
              // fautif, et l'utilisateur ne saurait pas quoi corriger.
              if (segmentChanged && reason.trim().length < MIN_REASON_LENGTH) {
                setReasonError(
                  'Expliquez la bascule : elle est enregistrée et rendue à la direction.',
                );
                return;
              }
              setReasonError(undefined);
              mutation.mutate(values);
            })(event);
          }}
        >
          <Field label="Prénom" required error={formState.errors.prenom?.message}>
            {(props) => <Input {...props} {...register('prenom')} />}
          </Field>

          <Field label="Nom" required error={formState.errors.nom?.message}>
            {(props) => <Input {...props} {...register('nom')} />}
          </Field>

          <Field
            label="Téléphone"
            required
            description="Un seul prospect par numéro."
            error={formState.errors.phone?.message}
          >
            {(props) => <Input {...props} type="tel" {...register('phone')} />}
          </Field>

          <Field label="Statut" required error={formState.errors.statut?.message}>
            {(props) => (
              <Select
                items={PROSPECT_STATUT_LABELS}
                value={statut}
                onValueChange={(value) => {
                  if (value === null) return;
                  setValue('statut', value, { shouldDirty: true });
                }}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECT_STATUTS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PROSPECT_STATUT_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field label="Banque" required error={formState.errors.banqueId?.message}>
            {(props) => (
              <Select
                items={banqueItems}
                value={banqueId}
                onValueChange={(value) => {
                  if (value === null) return;
                  setValue('banqueId', value, { shouldDirty: true });
                }}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue placeholder="Choisir une banque" />
                </SelectTrigger>
                <SelectContent>
                  {banqueItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field label="Syndicat" required error={formState.errors.syndicatId?.message}>
            {(props) => (
              <Select
                items={syndicatItems}
                value={syndicatId}
                onValueChange={(value) => {
                  if (value === null) return;
                  setValue('syndicatId', value, { shouldDirty: true });
                }}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue placeholder="Choisir un syndicat" />
                </SelectTrigger>
                <SelectContent>
                  {syndicatItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          {/*
            LE SEGMENT, ÉCRIT EN CLAIR, DES DEUX CÔTÉS.

            Il occupe les deux colonnes et se place JUSTE SOUS les deux listes
            qui le décident : un encart rangé en bas du formulaire, après le
            représentant, serait lu après le clic sur « Enregistrer ».
          */}
          <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-3 sm:col-span-2">
            <p className="text-[0.8125rem]">
              <span className="text-muted-foreground">Segment actuel&nbsp;: </span>
              <span className="font-[600]">
                {prospect === null ? '–' : SEGMENT_LABELS[prospect.segment]}
              </span>
            </p>

            {segmentChanged ? (
              <div className="flex flex-col gap-3">
                {/*
                  `role="alert"` : le bloc APPARAÎT en cours de saisie, en
                  réaction à un choix. Sans lui, un utilisateur au lecteur
                  d'écran changerait de banque et n'entendrait jamais que la
                  fiche vient de changer de base.
                */}
                <div role="alert" className="flex flex-col gap-1.5">
                  <p className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
                    <span>{SEGMENT_LABELS[prospect.segment]}</span>
                    <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                    <span className="font-[600]">
                      {nextSegment === null ? 'segment indéterminé' : SEGMENT_LABELS[nextSegment]}
                    </span>
                  </p>
                  <p className="text-[0.75rem] text-muted-foreground">
                    Changer de banque ou de syndicat fait CHANGER LA FICHE DE BASE. Ce n’est pas une
                    correction de faute de frappe&nbsp;: la bascule est enregistrée avec votre nom,
                    la date et le motif, et elle est comptée dans les conversions du mois.
                  </p>
                </div>

                <Field label="Motif de la bascule" required error={reasonError}>
                  {(props) => (
                    <Textarea
                      {...props}
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                      }}
                      placeholder="Ex. : le client a domicilié son salaire à la CBAO le 12 août."
                    />
                  )}
                </Field>
              </div>
            ) : null}

            {prospect === null ? null : <ProspectSegmentHistory prospectId={prospect.id} />}
          </div>

          <Field
            label="Représentant"
            required
            error={formState.errors.representantId?.message}
            description="Change aussi le département rattaché au prospect."
          >
            {(props) => (
              <Select
                items={representantItems}
                value={representantId}
                onValueChange={(value) => {
                  if (value === null) return;
                  setValue('representantId', value, { shouldDirty: true });
                }}
              >
                <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
                  <SelectValue placeholder="Choisir un représentant" />
                </SelectTrigger>
                <SelectContent>
                  {representantItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
