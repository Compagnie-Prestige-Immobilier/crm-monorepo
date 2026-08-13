'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
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
import { updateProspect } from '@/lib/data/prospects';
import { fetchReferenceData } from '@/lib/data/reference';
import { withRetired } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { prospectSchema, type ProspectFormInput } from '@/lib/schemas';
import {
  PROSPECT_STATUTS,
  PROSPECT_STATUT_LABELS,
  type ProspectRow,
  type UpdateProspectInput,
} from '@/lib/types';

/**
 * Modification d'un prospect.
 *
 * Les listes de banques, syndicats et représentants sont chargées SANS filtre
 * d'activité : un prospect saisi en mars peut référencer une banque retirée
 * depuis. Ne proposer que les actives forcerait à changer une donnée correcte
 * pour pouvoir corriger un nom de famille.
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

  useEffect(() => {
    if (prospect === null) return;
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
    mutationFn: (values: ProspectFormInput) => {
      if (prospect === null) throw new Error('Aucun prospect sélectionné.');
      const patch: UpdateProspectInput = {
        nom: values.nom,
        prenom: values.prenom,
        phone: values.phone,
        banqueId: values.banqueId,
        syndicatId: values.syndicatId,
        representantId: values.representantId,
        statut: values.statut,
      };
      return updateProspect(prospect.id, patch);
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
          <DialogDescription>
            Saisi par {prospect?.ownedByCommercialName ?? '–'}.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            void handleSubmit((values) => {
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
                value={statut}
                onValueChange={(value) => {
                  setValue('statut', value as ProspectFormInput['statut'], { shouldDirty: true });
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
                value={banqueId}
                onValueChange={(value) => {
                  setValue('banqueId', value, { shouldDirty: true });
                }}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue placeholder="Choisir une banque" />
                </SelectTrigger>
                <SelectContent>
                  {(reference?.banques ?? []).map((banque) => (
                    <SelectItem key={banque.id} value={banque.id}>
                      {withRetired(banque.shortName, banque.isActive)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field label="Syndicat" required error={formState.errors.syndicatId?.message}>
            {(props) => (
              <Select
                value={syndicatId}
                onValueChange={(value) => {
                  setValue('syndicatId', value, { shouldDirty: true });
                }}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue placeholder="Choisir un syndicat" />
                </SelectTrigger>
                <SelectContent>
                  {(reference?.syndicats ?? []).map((syndicat) => (
                    <SelectItem key={syndicat.id} value={syndicat.id}>
                      {withRetired(syndicat.sigle, syndicat.isActive)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field
            label="Représentant"
            required
            error={formState.errors.representantId?.message}
            description="Change aussi le département rattaché au prospect."
          >
            {(props) => (
              <Select
                value={representantId}
                onValueChange={(value) => {
                  setValue('representantId', value, { shouldDirty: true });
                }}
              >
                <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
                  <SelectValue placeholder="Choisir un représentant" />
                </SelectTrigger>
                <SelectContent>
                  {(reference?.representants ?? []).map((option) => (
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
