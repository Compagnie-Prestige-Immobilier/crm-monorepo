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

const MIN_REASON_LENGTH = 5;

/**
 * Le formulaire porte `''` là où la fiche porte `null`. Comparés tels quels,
 * toute fiche SANS banque — donc toute fiche Grand Public — s'ouvrait déjà « en
 * bascule », motif obligatoire à l'appui, et plus aucune correction de nom
 * n'était enregistrable.
 */
const memeChoix = (saisi: string, enregistre: string | null): boolean =>
  (saisi === '' ? null : saisi) === enregistre;

function choixReferentiels(
  reference: Awaited<ReturnType<typeof fetchReferenceData>> | undefined,
  banqueId: string,
  syndicatId: string,
) {
  const banques = reference?.banques ?? [];
  const syndicats = reference?.syndicats ?? [];
  const banque = banques.find((item) => item.id === banqueId);
  const syndicat = syndicats.find((item) => item.id === syndicatId);
  const nextSegment: BddSegment | null =
    banque === undefined || syndicat === undefined
      ? null
      : classifySegment({ syndicatSigle: syndicat.sigle, banqueShortName: banque.shortName });

  return {
    banqueItems: banques.map((item) => ({
      value: item.id,
      label: withRetired(item.shortName, item.isActive),
    })),
    syndicatItems: syndicats.map((item) => ({
      value: item.id,
      label: withRetired(item.sigle, item.isActive),
    })),
    representantItems: reference?.representants ?? [],
    nextSegment,
  };
}

function segmentBascule(prospect: ProspectRow, banqueId: string, syndicatId: string): boolean {
  return !memeChoix(banqueId, prospect.banqueId) || !memeChoix(syndicatId, prospect.syndicatId);
}

function isSegmentChanged(
  prospect: ProspectRow | null,
  banqueId: string,
  syndicatId: string,
): boolean {
  if (prospect === null) return false;
  return segmentBascule(prospect, banqueId, syndicatId);
}

function savedByLabel(prospect: ProspectRow | null): string {
  if (prospect === null) return '–';
  return prospect.ownedByCommercialName;
}

function segmentLabel(segment: BddSegment | null, fallback: string): string {
  return segment === null ? fallback : SEGMENT_LABELS[segment];
}

function applyIfSelected<T extends string>(value: T | null, apply: (value: T) => void): void {
  if (value === null) return;
  apply(value);
}

function reasonValidationError(segmentChanged: boolean, reason: string): string | undefined {
  if (!segmentChanged) return undefined;
  if (reason.trim().length >= MIN_REASON_LENGTH) return undefined;
  return 'Expliquez la bascule : elle est enregistrée et rendue à la direction.';
}

function identityPatch(
  values: ProspectFormInput,
  prospect: ProspectRow,
): UpdateProspectInput | null {
  const changed =
    values.nom !== prospect.nom ||
    values.prenom !== prospect.prenom ||
    values.phone !== prospect.phoneE164 ||
    !memeChoix(values.representantId, prospect.representantId) ||
    values.statut !== prospect.statut;
  if (!changed) return null;
  return {
    nom: values.nom,
    prenom: values.prenom,
    phone: values.phone,
    representantId: values.representantId,
    statut: values.statut,
  };
}

function segmentPatchInput(
  values: ProspectFormInput,
  prospect: ProspectRow,
  reason: string,
): { banqueId?: string; syndicatId?: string; reason: string; expectedRev: number } | null {
  const banqueChanged = !memeChoix(values.banqueId, prospect.banqueId);
  const syndicatChanged = !memeChoix(values.syndicatId, prospect.syndicatId);
  if (!banqueChanged && !syndicatChanged) return null;
  return {
    ...(banqueChanged ? { banqueId: values.banqueId } : {}),
    ...(syndicatChanged ? { syndicatId: values.syndicatId } : {}),
    reason: reason.trim(),
    expectedRev: prospect.rev,
  };
}

function SubmitIcon({ pending }: { pending: boolean }) {
  if (!pending) return null;
  return <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />;
}

function ProspectSegmentHistoryOrNull({ prospect }: { prospect: ProspectRow | null }) {
  if (prospect === null) return null;
  return <ProspectSegmentHistory prospectId={prospect.id} />;
}

function SegmentBasculePanel({
  prospect,
  segmentChanged,
  nextSegment,
  reason,
  setReason,
  reasonError,
}: {
  prospect: ProspectRow | null;
  segmentChanged: boolean;
  nextSegment: BddSegment | null;
  reason: string;
  setReason: (value: string) => void;
  reasonError: string | undefined;
}) {
  if (!segmentChanged || prospect === null) return null;

  return (
    <div className="flex flex-col gap-3">
      {/*
        `role="alert"` : le bloc APPARAÎT en cours de saisie, en
        réaction à un choix. Sans lui, un utilisateur au lecteur
        d'écran changerait de banque et n'entendrait jamais que la
        fiche vient de changer de base.
      */}
      <div role="alert" className="flex flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
          <span>{segmentLabel(prospect.segment, 'Aucun')}</span>
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          <span className="font-[600]">{segmentLabel(nextSegment, 'segment indéterminé')}</span>
        </p>
        <p className="text-[0.75rem] text-muted-foreground">
          Changer de banque ou de syndicat fait CHANGER LA FICHE DE BASE. Ce n’est pas une
          correction de faute de frappe&nbsp;: la bascule est enregistrée avec votre nom, la date
          et le motif, et elle est comptée dans les conversions du mois.
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
  );
}

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
      banqueId: prospect.banqueId ?? '',
      syndicatId: prospect.syndicatId ?? '',
      representantId: prospect.representantId ?? '',
      statut: prospect.statut,
    });
  }, [prospect, reset]);

  const mutation = useMutation({
    mutationFn: async (values: ProspectFormInput) => {
      if (prospect === null) throw new Error('Aucun prospect sélectionné.');

      let saved: ProspectRow | undefined;

      const segmentPatch = segmentPatchInput(values, prospect, reason);
      if (segmentPatch !== null) {
        saved = await changeProspectSegment(prospect.id, segmentPatch);
      }

      const patch = identityPatch(values, prospect);
      if (patch !== null) {
        saved = await updateProspect(prospect.id, patch);
      }

      return saved ?? prospect;
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot });
      toast.success(`${saved.prenom} ${saved.nom} enregistré.`);
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, "L'enregistrement a échoué.");
    },
  });

  // oxlint-disable-next-line react/incompatible-library -- faux positif react-hook-form
  const banqueId = watch('banqueId');
  const syndicatId = watch('syndicatId');
  const representantId = watch('representantId');
  const statut = watch('statut');

  const { banqueItems, syndicatItems, representantItems, nextSegment } = choixReferentiels(
    reference,
    banqueId,
    syndicatId,
  );

  const segmentChanged = isSegmentChanged(prospect, banqueId, syndicatId);

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
          <DialogDescription>Saisi par {savedByLabel(prospect)}.</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            void handleSubmit((values) => {
              const error = reasonValidationError(segmentChanged, reason);
              setReasonError(error);
              if (error === undefined) mutation.mutate(values);
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
                  applyIfSelected(value, (statutValue) => {
                    setValue('statut', statutValue, { shouldDirty: true });
                  });
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
                  applyIfSelected(value, (banqueValue) => {
                    setValue('banqueId', banqueValue, { shouldDirty: true });
                  });
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
                  applyIfSelected(value, (syndicatValue) => {
                    setValue('syndicatId', syndicatValue, { shouldDirty: true });
                  });
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
                {segmentLabel(prospect === null ? null : prospect.segment, 'Aucun')}
              </span>
            </p>

            <SegmentBasculePanel
              prospect={prospect}
              segmentChanged={segmentChanged}
              nextSegment={nextSegment}
              reason={reason}
              setReason={setReason}
              reasonError={reasonError}
            />

            <ProspectSegmentHistoryOrNull prospect={prospect} />
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
                  applyIfSelected(value, (representantValue) => {
                    setValue('representantId', representantValue, { shouldDirty: true });
                  });
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
              <SubmitIcon pending={mutation.isPending} />
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
