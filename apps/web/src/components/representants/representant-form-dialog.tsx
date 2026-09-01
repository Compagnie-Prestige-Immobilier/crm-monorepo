'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, CheckIcon, LoaderIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
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
  scriptOf,
  updateRepresentant,
  PROFESSIONS,
  WHATSAPP_STATUS_LABELS,
  WHATSAPP_STATUSES,
  type UpdateRepresentantPatch,
  type WhatsappStatus,
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

const WHATSAPP_ITEMS = WHATSAPP_STATUSES.map((status) => ({
  value: status,
  label: WHATSAPP_STATUS_LABELS[status],
}));

/** Trois états, car le contrat porte `boolean | null` : « Indéterminé » n'écrit rien. */
const TRISTATE_ITEMS: { value: 'oui' | 'non' | 'na'; label: string }[] = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
  { value: 'na', label: 'Indéterminé' },
];

function triToString(value: boolean | null): 'oui' | 'non' | 'na' {
  if (value === null) return 'na';
  return value ? 'oui' : 'non';
}

function triFromString(value: string): boolean | null {
  if (value === 'oui') return true;
  if (value === 'non') return false;
  return null;
}

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
  onSaved,
  pendantAppel = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  representant: RepresentantRow | null;
  /** Amorce d'une création : un numéro suggéré par un représentant. */
  prefill?: RepresentantPrefill | null;
  onSaved?: ((representant: RepresentantRow) => void) | undefined;
  /**
   * Ouverte depuis l'écran d'appel. La relation, son motif et le canal WhatsApp
   * sont ce que l'appel en cours est en train de décider : les régler à la main
   * ici écraserait la réponse qui va suivre.
   */
  pendantAppel?: boolean;
}) {
  const queryClient = useQueryClient();
  const nameId = useId();
  const phoneId = useId();
  const notesId = useId();
  const relationId = useId();
  const reasonId = useId();
  const whatsappId = useId();
  const whatsappNumberId = useId();
  const professionId = useId();
  const prenomId = useId();
  const etablissementId = useId();
  const connaitUESId = useId();
  const contacteId = useId();

  const [fullName, setFullName] = useState('');
  const [prenom, setPrenom] = useState('');
  const [etablissement, setEtablissement] = useState('');
  const [syndicat, setSyndicat] = useState('');
  const [connaitUES, setConnaitUES] = useState<boolean | null>(null);
  const [contacte, setContacte] = useState<boolean | null>(null);
  const [phone, setPhone] = useState('');
  const [regionDraft, setRegionDraft] = useState<string | null>(null);
  const [departementId, setDepartementId] = useState<string | null>(null);
  const [iefId, setIefId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [relationStatus, setRelationStatus] = useState<RepresentantRelation>('INCONNU');
  const [relationReason, setRelationReason] = useState('');
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsappStatus>('NON_DEMANDE');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [profession, setProfession] = useState('');
  const [conflict, setConflict] = useState<{ label: string; owner: string | null } | null>(null);

  const savedScript = useMemo(
    () => (representant === null ? null : scriptOf(representant)),
    [representant],
  );

  const isEdit = representant !== null;
  const switchingToRefus =
    representant !== null && relationStatus === 'REFUS' && representant.relationStatus !== 'REFUS';

  useEffect(() => {
    if (!open) return;
    setFullName(representant?.fullName ?? prefill?.fullName ?? '');
    setPrenom(representant?.prenom ?? '');
    setEtablissement(representant?.etablissement ?? '');
    setSyndicat(representant?.syndicat ?? '');
    setConnaitUES(representant?.connaitUES ?? null);
    setContacte(representant?.contacte ?? null);
    setPhone(representant === null ? (prefill?.phone ?? '') : formatPhone(representant.phoneE164));
    setRegionDraft(null);
    setDepartementId(representant?.departementId ?? null);
    setIefId(representant?.iefId ?? null);
    setNotes(representant?.notes ?? prefill?.notes ?? '');
    setRelationStatus(representant?.relationStatus ?? 'INCONNU');
    setRelationReason('');
    setWhatsappStatus(savedScript?.whatsappStatus ?? 'NON_DEMANDE');
    setWhatsappNumber(savedScript?.whatsappE164 ?? '');
    setProfession(savedScript?.profession ?? '');
    setConflict(null);
  }, [open, representant, prefill, savedScript]);

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const departements = reference?.departements ?? [];
  const syndicatOptions = (reference?.syndicats ?? [])
    .filter((item) => item.isActive)
    .map((item) => ({ value: item.id, label: item.name, hint: item.sigle }));
  // Le champ stocke le NOM du syndicat ; le combobox choisit par id, résolu ici.
  const syndicatId = reference?.syndicats.find((item) => item.name === syndicat)?.id ?? null;
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
        const patch: UpdateRepresentantPatch = {
          fullName: fullName.trim(),
          phone: phone.trim(),
          departementId,
          notes: notes.trim(),
        };
        if (iefId !== null) patch.iefId = iefId;
        // Un statut inchangé n'est PAS renvoyé : le serveur le refuserait sans
        // rien écrire, et l'écran laisserait croire à une bascule historisée.
        if (relationStatus !== representant.relationStatus) patch.relationStatus = relationStatus;
        const reason = relationReason.trim();
        if (switchingToRefus && reason !== '') patch.relationReason = reason;

        if (whatsappStatus !== savedScript?.whatsappStatus) patch.whatsappStatus = whatsappStatus;
        // Sur MEME_NUMERO le numero se relit sur `phoneE164` : le dupliquer
        // fabriquerait deux verites a maintenir.
        if (whatsappStatus === 'AUTRE_NUMERO' && whatsappNumber.trim() !== '') {
          patch.whatsappE164 = whatsappNumber.trim();
        }
        if (profession.trim() !== (savedScript?.profession ?? '')) {
          patch.profession = profession.trim();
        }
        if (prenom.trim() !== (representant.prenom ?? '')) patch.prenom = prenom.trim();
        if (etablissement.trim() !== (representant.etablissement ?? '')) {
          patch.etablissement = etablissement.trim();
        }
        if (syndicat.trim() !== (representant.syndicat ?? '')) patch.syndicat = syndicat.trim();
        // Le contrat n'admet que `boolean` : « Indéterminé » ne peut pas remettre
        // la valeur à null, il laisse donc la fiche telle quelle.
        if (connaitUES !== null && connaitUES !== representant.connaitUES) {
          patch.connaitUES = connaitUES;
        }
        if (contacte !== null && contacte !== representant.contacte) patch.contacte = contacte;
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
      onSaved?.(saved);
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

          {isEdit && !pendantAppel ? (
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

              {switchingToRefus ? (
                <div className="mt-1 flex flex-col gap-1.5">
                  <Label htmlFor={reasonId}>Motif du refus</Label>
                  <Input
                    id={reasonId}
                    value={relationReason}
                    maxLength={500}
                    autoComplete="off"
                    placeholder="Ce qu’il a répondu"
                    onChange={(event) => {
                      setRelationReason(event.target.value);
                    }}
                  />
                  <p className="text-[0.75rem] text-muted-foreground">
                    Facultatif. Repris tel quel dans l’histoire de la relation.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {isEdit && !pendantAppel ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={whatsappId}>WhatsApp</Label>
                <Select
                  items={WHATSAPP_ITEMS}
                  value={whatsappStatus}
                  onValueChange={(value) => {
                    if (value === null) return;
                    setWhatsappStatus(value);
                  }}
                >
                  <SelectTrigger id={whatsappId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WHATSAPP_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[0.75rem] text-muted-foreground">
                  « Non demandé » dit que la question n’a pas été posée, « pas de WhatsApp » qu’elle
                  l’a été.
                </p>
              </div>

              {whatsappStatus === 'AUTRE_NUMERO' ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={whatsappNumberId}>Numéro WhatsApp</Label>
                  <Input
                    id={whatsappNumberId}
                    value={whatsappNumber}
                    maxLength={40}
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="77 123 45 67"
                    onChange={(event) => {
                      setWhatsappNumber(event.target.value);
                    }}
                  />
                </div>
              ) : null}
            </>
          ) : null}

          {isEdit ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={professionId}>Profession</Label>
              <Input
                id={professionId}
                value={profession}
                maxLength={120}
                autoComplete="off"
                list={`${professionId}-frequentes`}
                onChange={(event) => {
                  setProfession(event.target.value);
                }}
              />
              <datalist id={`${professionId}-frequentes`}>
                {PROFESSIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
          ) : null}

          {isEdit && !pendantAppel ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={prenomId}>Prénom</Label>
                  <Input
                    id={prenomId}
                    value={prenom}
                    maxLength={120}
                    autoComplete="off"
                    onChange={(event) => {
                      setPrenom(event.target.value);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={etablissementId}>Établissement</Label>
                  <Input
                    id={etablissementId}
                    value={etablissement}
                    maxLength={160}
                    autoComplete="off"
                    onChange={(event) => {
                      setEtablissement(event.target.value);
                    }}
                  />
                </div>
              </div>

              <FilterCombobox
                label="Syndicat"
                placeholder="Choisir un syndicat"
                value={syndicatId}
                options={syndicatOptions}
                onChange={(value) => {
                  setSyndicat(
                    reference?.syndicats.find((item) => item.id === value)?.name ?? '',
                  );
                }}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={connaitUESId}>Connaît l’UES</Label>
                  <Select
                    items={TRISTATE_ITEMS}
                    value={triToString(connaitUES)}
                    onValueChange={(value) => {
                      if (value === null) return;
                      setConnaitUES(triFromString(value));
                    }}
                  >
                    <SelectTrigger id={connaitUESId} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRISTATE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={contacteId}>Déjà contacté</Label>
                  <Select
                    items={TRISTATE_ITEMS}
                    value={triToString(contacte)}
                    onValueChange={(value) => {
                      if (value === null) return;
                      setContacte(triFromString(value));
                    }}
                  >
                    <SelectTrigger id={contacteId} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRISTATE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
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
