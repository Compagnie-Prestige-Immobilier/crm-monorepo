'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, CheckIcon, LoaderIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { FilterCombobox } from '@/components/filters/filter-combobox';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { fetchReferenceData } from '@/lib/data/reference';
import {
  createRepresentant,
  lookupRepresentantByPhone,
  updateRepresentant,
} from '@/lib/data/representants';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  REPRESENTANT_RELATION_LABELS,
  REPRESENTANT_RELATIONS,
  type RepresentantRelation,
} from '@/lib/representant-filters';
import type { RepresentantRow } from '@/lib/types';

const RELATION_ITEMS = REPRESENTANT_RELATIONS.map((relation) => ({
  value: relation,
  label: REPRESENTANT_RELATION_LABELS[relation],
}));

export interface RepresentantPrefill {
  fullName: string;
  phone: string;
  notes: string;
}

export function RepresentantFormDialog({
  open,
  onOpenChange,
  representant,
  prefill = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  representant: RepresentantRow | null;
  /** Amorce d'une création : un numéro suggéré par un représentant. */
  prefill?: RepresentantPrefill | null;
}) {
  const queryClient = useQueryClient();
  const nameId = useId();
  const phoneId = useId();
  const notesId = useId();
  const relationId = useId();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [regionDraft, setRegionDraft] = useState<string | null>(null);
  const [departementId, setDepartementId] = useState<string | null>(null);
  const [iefId, setIefId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [relationStatus, setRelationStatus] = useState<RepresentantRelation>('INCONNU');
  const [conflict, setConflict] = useState<{ label: string; owner: string | null } | null>(null);

  const isEdit = representant !== null;

  useEffect(() => {
    if (!open) return;
    setFullName(representant?.fullName ?? prefill?.fullName ?? '');
    setPhone(representant === null ? (prefill?.phone ?? '') : formatPhone(representant.phoneE164));
    setRegionDraft(null);
    setDepartementId(representant?.departementId ?? null);
    setIefId(representant?.iefId ?? null);
    setNotes(representant?.notes ?? prefill?.notes ?? '');
    setRelationStatus(representant?.relationStatus ?? 'INCONNU');
    setConflict(null);
  }, [open, representant, prefill]);

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const departements = reference?.departements ?? [];
  const regionId =
    departements.find((departement) => departement.id === departementId)?.regionId ?? regionDraft;

  const checkPhone = useMutation({
    mutationFn: (value: string) => lookupRepresentantByPhone(value),
    onSuccess: (lookup) => {
      if (!lookup.found || lookup.representant === null) {
        setConflict(null);
        return;
      }
      if (representant !== null && lookup.representant.id === representant.id) {
        setConflict(null);
        return;
      }
      setConflict({
        label: lookup.representant.fullName,
        owner: lookup.ownedByCommercialName,
      });
    },
    onError: () => {
      setConflict(null);
    },
  });

  const save = useMutation({
    mutationFn: () => {
      if (departementId === null) throw new Error('Département manquant.');

      if (representant !== null) {
        const patch: Parameters<typeof updateRepresentant>[1] = {
          fullName: fullName.trim(),
          phone: phone.trim(),
          departementId,
          notes: notes.trim(),
        };
        if (iefId !== null) patch.iefId = iefId;
        // Un statut inchangé n'est PAS renvoyé : le serveur le refuserait sans
        // rien écrire, et l'écran laisserait croire à une bascule historisée.
        if (relationStatus !== representant.relationStatus) patch.relationStatus = relationStatus;
        return updateRepresentant(representant.id, patch);
      }

      const body: Parameters<typeof createRepresentant>[0] = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        departementId,
      };
      if (iefId !== null) body.iefId = iefId;
      const trimmedNotes = notes.trim();
      if (trimmedNotes !== '') body.notes = trimmedNotes;
      return createRepresentant(body);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
      toast.success(isEdit ? `Fiche de ${saved.fullName} mise à jour.` : `${saved.fullName} créé.`);
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'La fiche n’a pas pu être enregistrée.');
    },
  });

  const nameValid = fullName.trim().length >= 2 && fullName.trim().length <= 160;
  const phoneValid = phone.trim().replace(/\D/gu, '').length >= 9;
  const canSubmit =
    nameValid && phoneValid && departementId !== null && conflict === null && !save.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && save.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le représentant' : 'Nouveau représentant'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Le numéro sert de clé de rattachement des prospects déjà saisis.'
              : 'Une fiche naît normalement en tournée. Cette saisie couvre l’exception.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={nameId}>
              Nom complet
              <span className="text-destructive" aria-label="obligatoire">
                *
              </span>
            </Label>
            <Input
              id={nameId}
              value={fullName}
              maxLength={160}
              autoComplete="off"
              onChange={(event) => {
                setFullName(event.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={phoneId}>
              Téléphone
              <span className="text-destructive" aria-label="obligatoire">
                *
              </span>
            </Label>
            <Input
              id={phoneId}
              value={phone}
              maxLength={40}
              inputMode="tel"
              autoComplete="off"
              placeholder="77 123 45 67"
              aria-invalid={conflict !== null}
              aria-describedby={conflict === null ? `${phoneId}-aide` : `${phoneId}-conflit`}
              onChange={(event) => {
                setPhone(event.target.value);
                setConflict(null);
              }}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value.replace(/\D/gu, '').length >= 9) checkPhone.mutate(value);
              }}
            />
            {conflict === null ? (
              <p id={`${phoneId}-aide`} className="text-[0.75rem] text-muted-foreground">
                Vérifié contre la base avant enregistrement.
                {checkPhone.isPending ? ' Vérification en cours…' : ''}
              </p>
            ) : (
              <p
                id={`${phoneId}-conflit`}
                role="alert"
                className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-destructive"
              >
                <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" />
                Ce numéro est déjà celui de {conflict.label}
                {conflict.owner === null ? '.' : `, saisi par ${conflict.owner}.`}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FilterCombobox
              label="Région"
              placeholder="Toutes les régions"
              value={regionId}
              options={(reference?.regions ?? []).map((region) => ({
                value: region.id,
                label: region.name,
              }))}
              onChange={(value) => {
                setRegionDraft(value);
                setDepartementId(null);
                setIefId(null);
              }}
            />
            <FilterCombobox
              label="Département"
              placeholder="Choisir un département"
              value={departementId}
              options={departements
                .filter((departement) => regionId === null || departement.regionId === regionId)
                .map((departement) => ({
                  value: departement.id,
                  label: departement.name,
                  hint: departement.regionName,
                }))}
              onChange={(value) => {
                setDepartementId(value);
                setIefId(null);
              }}
            />
            <FilterCombobox
              label="IEF"
              placeholder="Aucune"
              value={iefId}
              options={(reference?.iefs ?? [])
                .filter((ief) =>
                  departementId === null ? true : ief.departementId === departementId,
                )
                .map((ief) => ({
                  value: ief.id,
                  label: ief.name,
                  hint: ief.departementName,
                }))}
              onChange={setIefId}
            />
          </div>
          <p className="-mt-2 text-[0.75rem] text-muted-foreground">
            L’IEF est facultative : les fiches saisies avant l’arrivée de ce référentiel n’en
            portent pas, et l’exiger les invaliderait rétroactivement.
          </p>

          {isEdit ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={relationId}>Relation</Label>
              <Select
                items={RELATION_ITEMS}
                value={relationStatus}
                onValueChange={(value) => {
                  if (value === null) return;
                  setRelationStatus(value);
                }}
              >
                <SelectTrigger id={relationId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATION_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[0.75rem] text-muted-foreground">
                Chaque changement est daté et signé dans l’histoire de la fiche.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={notesId}>Notes</Label>
            <Textarea
              id={notesId}
              value={notes}
              rows={3}
              maxLength={2000}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              save.mutate();
            }}
          >
            {save.isPending ? (
              <>
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              <>
                <CheckIcon aria-hidden="true" />
                {isEdit ? 'Enregistrer' : 'Créer la fiche'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
