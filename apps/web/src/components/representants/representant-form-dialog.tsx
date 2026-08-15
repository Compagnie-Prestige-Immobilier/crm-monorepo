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
import type { RepresentantRow } from '@/lib/types';

/**
 * Création et modification d'une fiche de représentant depuis le panel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Le téléphone est la clé, et c'est tout le sujet de cet écran.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le numéro déduplique les représentants dans tout le produit : deux fiches
 * pour la même personne cassent le rattachement des prospects déjà saisis, et
 * cela ne se répare pas en une manipulation. Le contrôle d'unicité est donc
 * posé AU FLOU du champ, avant l'envoi : à chaque frappe ce serait une requête
 * par caractère pour une information qui n'a de sens qu'une fois le numéro
 * complet ; après l'envoi, l'agent aurait tout ressaisi pour rien.
 *
 * L'écran restait volontairement en lecture jusqu'ici : une fiche naît en
 * tournée, face à la personne, et c'est encore le cas courant. Ce dialogue
 * couvre l'exception (corriger depuis le siège, saisir une fiche remontée par
 * téléphone), il ne remplace pas le mobile.
 */
export function RepresentantFormDialog({
  open,
  onOpenChange,
  /** `null` : création. Sinon, modification de cette fiche. */
  representant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  representant: RepresentantRow | null;
}) {
  const queryClient = useQueryClient();
  const nameId = useId();
  const phoneId = useId();
  const notesId = useId();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [departementId, setDepartementId] = useState<string | null>(null);
  const [iefId, setIefId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [conflict, setConflict] = useState<{ label: string; owner: string | null } | null>(null);

  const isEdit = representant !== null;

  // Réinitialisation à chaque ouverture ET à chaque changement de fiche :
  // garder la saisie précédente ferait enregistrer les notes d'une personne
  // sur la fiche d'une autre, en un clic.
  useEffect(() => {
    if (!open) return;
    setFullName(representant?.fullName ?? '');
    setPhone(representant === null ? '' : formatPhone(representant.phoneE164));
    setDepartementId(representant?.departementId ?? null);
    setIefId(representant?.iefId ?? null);
    setNotes(representant?.notes ?? '');
    setConflict(null);
  }, [open, representant]);

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const checkPhone = useMutation({
    mutationFn: (value: string) => lookupRepresentantByPhone(value),
    onSuccess: (lookup) => {
      // Une fiche trouvée qui est CELLE qu'on modifie n'est pas un conflit :
      // sans cette exception, corriger un nom sans toucher au numéro
      // afficherait « ce numéro existe déjà » sur sa propre fiche.
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
      // Un contrôle indisponible ne bloque pas la saisie : le serveur refusera
      // de toute façon un doublon. On efface simplement l'avis.
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
        return updateRepresentant(representant.id, patch);
      }

      // `exactOptionalPropertyTypes` : une clé posée à `undefined` n'est pas
      // une clé absente, et l'API refuserait un UUID vide.
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
              label="Département"
              placeholder="Choisir un département"
              value={departementId}
              options={(reference?.departements ?? []).map((departement) => ({
                value: departement.id,
                label: departement.name,
              }))}
              onChange={(value) => {
                // Une IEF n'appartient qu'à un département : la garder après un
                // changement produirait une fiche incohérente que l'API
                // refuserait sans que l'écran sache le dire.
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
