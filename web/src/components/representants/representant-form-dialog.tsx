'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, CheckIcon, LoaderIcon } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
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
  type RepresentantScript,
  type UpdateRepresentantPatch,
  type WhatsappStatus,
} from '@/lib/data/representants';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  REPRESENTANT_RELATION_CHOICES,
  REPRESENTANT_RELATION_LABELS,
  type RepresentantRelation,
} from '@/lib/representant-filters';
import type { RepresentantRow } from '@/lib/types';
import { useRecalage } from '@/lib/use-recalage';

const relationItems = (current: RepresentantRelation) =>
  [...new Set<RepresentantRelation>([...REPRESENTANT_RELATION_CHOICES, current])].map(
    (relation) => ({ value: relation, label: REPRESENTANT_RELATION_LABELS[relation] }),
  );

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

function ChampMotifRefus({
  visible,
  reasonId,
  value,
  onChange,
}: {
  visible: boolean;
  reasonId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  if (!visible) return null;

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <Label htmlFor={reasonId}>Motif du refus</Label>
      <Input
        id={reasonId}
        value={value}
        maxLength={500}
        autoComplete="off"
        placeholder="Ce qu’il a répondu"
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <p className="text-[0.75rem] text-muted-foreground">
        Facultatif. Repris tel quel dans l’histoire de la relation.
      </p>
    </div>
  );
}

function EnTeteFiche({ isEdit }: { isEdit: boolean }) {
  return (
    <DialogHeader>
      <DialogTitle>{isEdit ? 'Modifier le représentant' : 'Nouveau représentant'}</DialogTitle>
      <DialogDescription>
        {isEdit
          ? 'Le numéro sert de clé de rattachement des prospects déjà saisis.'
          : 'Une fiche naît normalement en tournée. Cette saisie couvre l’exception.'}
      </DialogDescription>
    </DialogHeader>
  );
}

function AideNumero({
  phoneId,
  conflict,
  verification,
}: {
  phoneId: string;
  conflict: { label: string; owner: string | null } | null;
  verification: boolean;
}) {
  if (conflict === null) {
    return (
      <p id={`${phoneId}-aide`} className="text-[0.75rem] text-muted-foreground">
        Vérifié contre la base avant enregistrement.
        {verification ? ' Vérification en cours…' : ''}
      </p>
    );
  }

  return (
    <p
      id={`${phoneId}-conflit`}
      role="alert"
      className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-destructive"
    >
      <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" />
      Ce numéro est déjà celui de {conflict.label}
      {conflict.owner === null ? '.' : `, saisi par ${conflict.owner}.`}
    </p>
  );
}

interface ChampsQualificationProps {
  visible: boolean;
  ids: { prenomId: string; etablissementId: string; connaitUESId: string; contacteId: string };
  prenom: string;
  onPrenom: (value: string) => void;
  etablissement: string;
  onEtablissement: (value: string) => void;
  syndicatId: string | null;
  syndicatOptions: { value: string; label: string; hint: string }[];
  onSyndicat: (value: string | null) => void;
  connaitUES: boolean | null;
  onConnaitUES: (value: boolean | null) => void;
  contacte: boolean | null;
  onContacte: (value: boolean | null) => void;
}

/** Ce que l'appel a appris de la personne, hors campagne en cours. */
function ChampsQualification(props: ChampsQualificationProps) {
  if (!props.visible) return null;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={props.ids.prenomId}>Prénom</Label>
          <Input
            id={props.ids.prenomId}
            value={props.prenom}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => {
              props.onPrenom(event.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={props.ids.etablissementId}>Établissement</Label>
          <Input
            id={props.ids.etablissementId}
            value={props.etablissement}
            maxLength={160}
            autoComplete="off"
            onChange={(event) => {
              props.onEtablissement(event.target.value);
            }}
          />
        </div>
      </div>

      <FilterCombobox
        label="Syndicat"
        placeholder="Choisir un syndicat"
        value={props.syndicatId}
        options={props.syndicatOptions}
        onChange={props.onSyndicat}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={props.ids.connaitUESId}>Connaît l’UES</Label>
          <Select
            items={TRISTATE_ITEMS}
            value={triToString(props.connaitUES)}
            onValueChange={(value) => {
              if (value === null) return;
              props.onConnaitUES(triFromString(value));
            }}
          >
            <SelectTrigger id={props.ids.connaitUESId} className="w-full">
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
          <Label htmlFor={props.ids.contacteId}>Déjà contacté</Label>
          <Select
            items={TRISTATE_ITEMS}
            value={triToString(props.contacte)}
            onValueChange={(value) => {
              if (value === null) return;
              props.onContacte(triFromString(value));
            }}
          >
            <SelectTrigger id={props.ids.contacteId} className="w-full">
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
  );
}

type Referentiels = Awaited<ReturnType<typeof fetchReferenceData>> | undefined;

function referentielsDe(
  reference: Referentiels,
  choix: { syndicat: string; departementId: string | null; regionDraft: string | null },
) {
  const departements = reference?.departements ?? [];
  const syndicats = reference?.syndicats ?? [];

  return {
    departements,
    syndicatOptions: syndicats
      .filter((item) => item.isActive === true)
      .map((item) => ({ value: item.id, label: item.name ?? '', hint: item.sigle ?? '' })),
    // Le champ stocke le NOM du syndicat ; le combobox choisit par id, résolu ici.
    syndicatId: syndicats.find((item) => item.name === choix.syndicat)?.id ?? null,
    regionId:
      departements.find((departement) => departement.id === choix.departementId)?.regionId ??
      choix.regionDraft,
  };
}

function regionOptionsDe(reference: Referentiels) {
  return (reference?.regions ?? []).map((region) => ({
    value: region.id,
    label: region.name ?? '',
  }));
}

function iefOptionsDe(reference: Referentiels, departementId: string | null) {
  return (reference?.iefs ?? [])
    .filter((ief) => (departementId === null ? true : ief.departementId === departementId))
    .map((ief) => ({
      value: ief.id,
      label: ief.name ?? '',
      hint: ief.departementName ?? undefined,
    }));
}

function ariaDescribedByDe(
  phoneId: string,
  conflict: { label: string; owner: string | null } | null,
): string {
  return conflict === null ? `${phoneId}-aide` : `${phoneId}-conflit`;
}

function ChampRelation({
  visible,
  relationId,
  reasonId,
  representant,
  relationStatus,
  onRelationStatus,
  switchingToRefus,
  relationReason,
  onRelationReason,
}: {
  visible: boolean;
  relationId: string;
  reasonId: string;
  representant: RepresentantRow | null;
  relationStatus: RepresentantRelation;
  onRelationStatus: (value: RepresentantRelation) => void;
  switchingToRefus: boolean;
  relationReason: string;
  onRelationReason: (value: string) => void;
}) {
  if (!visible || representant === null) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={relationId}>Qualification</Label>
      <Select
        items={relationItems(representant.relationStatus)}
        value={relationStatus}
        onValueChange={(value) => {
          if (value === null) return;
          onRelationStatus(value);
        }}
      >
        <SelectTrigger id={relationId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {relationItems(representant.relationStatus).map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[0.75rem] text-muted-foreground">
        Chaque changement est daté et signé dans l’histoire de la fiche.
      </p>

      <ChampMotifRefus
        visible={switchingToRefus}
        reasonId={reasonId}
        value={relationReason}
        onChange={onRelationReason}
      />
    </div>
  );
}

function ChampWhatsapp({
  visible,
  whatsappId,
  whatsappNumberId,
  whatsappStatus,
  onWhatsappStatus,
  whatsappNumber,
  onWhatsappNumber,
}: {
  visible: boolean;
  whatsappId: string;
  whatsappNumberId: string;
  whatsappStatus: WhatsappStatus;
  onWhatsappStatus: (value: WhatsappStatus) => void;
  whatsappNumber: string;
  onWhatsappNumber: (value: string) => void;
}) {
  if (!visible) return null;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={whatsappId}>WhatsApp</Label>
        <Select
          items={WHATSAPP_ITEMS}
          value={whatsappStatus}
          onValueChange={(value) => {
            if (value === null) return;
            onWhatsappStatus(value);
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
          « Non demandé » dit que la question n’a pas été posée, « pas de WhatsApp » qu’elle l’a
          été.
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
              onWhatsappNumber(event.target.value);
            }}
          />
        </div>
      ) : null}
    </>
  );
}

function ChampProfession({
  visible,
  professionId,
  profession,
  onProfession,
}: {
  visible: boolean;
  professionId: string;
  profession: string;
  onProfession: (value: string) => void;
}) {
  if (!visible) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={professionId}>Profession</Label>
      <Input
        id={professionId}
        value={profession}
        maxLength={120}
        autoComplete="off"
        list={`${professionId}-frequentes`}
        onChange={(event) => {
          onProfession(event.target.value);
        }}
      />
      <datalist id={`${professionId}-frequentes`}>
        {PROFESSIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </div>
  );
}

function BoutonEnregistrer({ isPending, isEdit }: { isPending: boolean; isEdit: boolean }) {
  if (isPending) {
    return (
      <>
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        Enregistrement…
      </>
    );
  }

  return (
    <>
      <CheckIcon aria-hidden="true" />
      {isEdit ? 'Enregistrer' : 'Créer la fiche'}
    </>
  );
}

function ficheEnvoyable(etat: {
  fullName: string;
  phone: string;
  departementId: string | null;
  sansConflit: boolean;
  pending: boolean;
}): boolean {
  const nom = etat.fullName.trim().length;
  const chiffres = etat.phone.trim().replace(/\D/gu, '').length;
  return (
    nom >= 2 &&
    nom <= 160 &&
    chiffres >= 9 &&
    etat.departementId !== null &&
    etat.sansConflit &&
    !etat.pending
  );
}

interface SaisieFiche {
  fullName: string;
  phone: string;
  departementId: string;
  notes: string;
  iefId: string | null;
  relationStatus: RepresentantRelation;
  relationReason: string;
  switchingToRefus: boolean;
  whatsappStatus: WhatsappStatus;
  whatsappNumber: string;
  profession: string;
  prenom: string;
  etablissement: string;
  syndicat: string;
  connaitUES: boolean | null;
  contacte: boolean | null;
}

function corpsDeCreation(saisie: SaisieFiche): Parameters<typeof createRepresentant>[0] {
  const body: Parameters<typeof createRepresentant>[0] = {
    fullName: saisie.fullName.trim(),
    phone: saisie.phone.trim(),
    departementId: saisie.departementId,
  };
  if (saisie.iefId !== null) body.iefId = saisie.iefId;
  const notes = saisie.notes.trim();
  if (notes !== '') body.notes = notes;
  return body;
}

function patchDuScript(
  saisie: SaisieFiche,
  savedScript: RepresentantScript | null,
): Partial<UpdateRepresentantPatch> {
  const patch: Partial<UpdateRepresentantPatch> = {};
  if (saisie.whatsappStatus !== savedScript?.whatsappStatus) {
    patch.whatsappStatus = saisie.whatsappStatus;
  }
  // Sur MEME_NUMERO le numero se relit sur `phoneE164` : le dupliquer
  // fabriquerait deux verites a maintenir.
  if (saisie.whatsappStatus === 'AUTRE_NUMERO' && saisie.whatsappNumber.trim() !== '') {
    patch.whatsappE164 = saisie.whatsappNumber.trim();
  }
  if (saisie.profession.trim() !== (savedScript?.profession ?? '')) {
    patch.profession = saisie.profession.trim();
  }
  return patch;
}

// Un statut inchangé n'est PAS renvoyé : le serveur le refuserait sans rien
// écrire, et l'écran laisserait croire à une bascule historisée.
function patchRelation(
  patch: UpdateRepresentantPatch,
  representant: RepresentantRow,
  saisie: SaisieFiche,
): void {
  if (saisie.relationStatus !== representant.relationStatus) {
    patch.relationStatus = saisie.relationStatus;
  }
  const reason = saisie.relationReason.trim();
  if (saisie.switchingToRefus && reason !== '') patch.relationReason = reason;
}

function assignTexteSiChange(
  patch: UpdateRepresentantPatch,
  key: 'prenom' | 'etablissement' | 'syndicat',
  value: string,
  previous: string,
): void {
  if (value !== previous) patch[key] = value;
}

// Le contrat n'admet que `boolean` : « Indéterminé » ne peut pas remettre la
// valeur à null, il laisse donc la fiche telle quelle.
function assignTriSiChange(
  patch: UpdateRepresentantPatch,
  key: 'connaitUES' | 'contacte',
  value: boolean | null,
  previous: boolean | null,
): void {
  if (value !== null && value !== previous) patch[key] = value;
}

/** Ne repart que ce qui a CHANGÉ : le serveur refuse une bascule sans écart. */
function patchDeFiche(
  representant: RepresentantRow,
  saisie: SaisieFiche,
  savedScript: RepresentantScript | null,
): UpdateRepresentantPatch {
  const patch: UpdateRepresentantPatch = {
    rev: representant.rev,
    fullName: saisie.fullName.trim(),
    phone: saisie.phone.trim(),
    departementId: saisie.departementId,
    notes: saisie.notes.trim(),
  };
  if (saisie.iefId !== null) patch.iefId = saisie.iefId;
  patchRelation(patch, representant, saisie);
  Object.assign(patch, patchDuScript(saisie, savedScript));
  assignTexteSiChange(patch, 'prenom', saisie.prenom.trim(), representant.prenom ?? '');
  assignTexteSiChange(
    patch,
    'etablissement',
    saisie.etablissement.trim(),
    representant.etablissement ?? '',
  );
  assignTexteSiChange(patch, 'syndicat', saisie.syndicat.trim(), representant.syndicat ?? '');
  assignTriSiChange(patch, 'connaitUES', saisie.connaitUES, representant.connaitUES);
  assignTriSiChange(patch, 'contacte', saisie.contacte, representant.contacte);
  return patch;
}

function texteOuRepli(value: string | null | undefined, repli: string): string {
  return value ?? repli;
}

function champsDeFicheVierge(prefill: RepresentantPrefill | null) {
  return {
    fullName: texteOuRepli(prefill?.fullName, ''),
    prenom: '',
    etablissement: '',
    syndicat: '',
    connaitUES: null as boolean | null,
    contacte: null as boolean | null,
    phone: texteOuRepli(prefill?.phone, ''),
    departementId: null as string | null,
    iefId: null as string | null,
    notes: texteOuRepli(prefill?.notes, ''),
    relationStatus: 'INCONNU' as RepresentantRelation,
  };
}

function champsDeFicheExistante(
  representant: RepresentantRow,
  prefill: RepresentantPrefill | null,
) {
  return {
    fullName: representant.fullName,
    prenom: texteOuRepli(representant.prenom, ''),
    etablissement: texteOuRepli(representant.etablissement, ''),
    syndicat: texteOuRepli(representant.syndicat, ''),
    connaitUES: representant.connaitUES ?? null,
    contacte: representant.contacte ?? null,
    phone: formatPhone(representant.phoneE164),
    departementId: representant.departementId as string | null,
    iefId: representant.iefId ?? null,
    notes: texteOuRepli(representant.notes, texteOuRepli(prefill?.notes, '')),
    relationStatus: representant.relationStatus as RepresentantRelation,
  };
}

function champsDeFiche(representant: RepresentantRow | null, prefill: RepresentantPrefill | null) {
  if (representant === null) return champsDeFicheVierge(prefill);
  return champsDeFicheExistante(representant, prefill);
}

function valeursDeFiche(
  representant: RepresentantRow | null,
  prefill: RepresentantPrefill | null,
  savedScript: RepresentantScript | null,
) {
  return {
    ...champsDeFiche(representant, prefill),
    whatsappStatus: savedScript?.whatsappStatus ?? ('NON_DEMANDE' as WhatsappStatus),
    whatsappNumber: savedScript?.whatsappE164 ?? '',
    profession: savedScript?.profession ?? '',
  };
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
  const showEditFields = isEdit && !pendantAppel;

  useRecalage([open, representant, prefill, savedScript], () => {
    if (!open) return;
    const depart = valeursDeFiche(representant, prefill, savedScript);
    setFullName(depart.fullName);
    setPrenom(depart.prenom);
    setEtablissement(depart.etablissement);
    setSyndicat(depart.syndicat);
    setConnaitUES(depart.connaitUES);
    setContacte(depart.contacte);
    setPhone(depart.phone);
    setRegionDraft(null);
    setDepartementId(depart.departementId);
    setIefId(depart.iefId);
    setNotes(depart.notes);
    setRelationStatus(depart.relationStatus);
    setRelationReason('');
    setWhatsappStatus(depart.whatsappStatus);
    setWhatsappNumber(depart.whatsappNumber);
    setProfession(depart.profession);
    setConflict(null);
  });

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const { departements, syndicatOptions, syndicatId, regionId } = referentielsDe(reference, {
    syndicat,
    departementId,
    regionDraft,
  });

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
      const saisie: SaisieFiche = {
        fullName,
        phone,
        departementId,
        notes,
        iefId,
        relationStatus,
        relationReason,
        switchingToRefus,
        whatsappStatus,
        whatsappNumber,
        profession,
        prenom,
        etablissement,
        syndicat,
        connaitUES,
        contacte,
      };

      if (representant === null) return createRepresentant(corpsDeCreation(saisie));
      return updateRepresentant(
        representant.id,
        patchDeFiche(representant, saisie, savedScript ?? null),
      );
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

  const canSubmit = ficheEnvoyable({
    fullName,
    phone,
    departementId,
    sansConflit: conflict === null,
    pending: save.isPending,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && save.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <EnTeteFiche isEdit={isEdit} />

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
              aria-describedby={ariaDescribedByDe(phoneId, conflict)}
              onChange={(event) => {
                setPhone(event.target.value);
                setConflict(null);
              }}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value.replace(/\D/gu, '').length >= 9) checkPhone.mutate(value);
              }}
            />
            <AideNumero phoneId={phoneId} conflict={conflict} verification={checkPhone.isPending} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FilterCombobox
              label="Région"
              placeholder="Toutes les régions"
              value={regionId}
              options={regionOptionsDe(reference)}
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
                  label: departement.name ?? '',
                  hint: departement.regionName ?? undefined,
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
              options={iefOptionsDe(reference, departementId)}
              onChange={setIefId}
            />
          </div>
          <p className="-mt-2 text-[0.75rem] text-muted-foreground">
            L’IEF est facultative : les fiches saisies avant l’arrivée de ce référentiel n’en
            portent pas, et l’exiger les invaliderait rétroactivement.
          </p>

          <ChampRelation
            visible={showEditFields}
            relationId={relationId}
            reasonId={reasonId}
            representant={representant}
            relationStatus={relationStatus}
            onRelationStatus={setRelationStatus}
            switchingToRefus={switchingToRefus}
            relationReason={relationReason}
            onRelationReason={setRelationReason}
          />

          <ChampWhatsapp
            visible={showEditFields}
            whatsappId={whatsappId}
            whatsappNumberId={whatsappNumberId}
            whatsappStatus={whatsappStatus}
            onWhatsappStatus={setWhatsappStatus}
            whatsappNumber={whatsappNumber}
            onWhatsappNumber={setWhatsappNumber}
          />

          <ChampProfession
            visible={isEdit}
            professionId={professionId}
            profession={profession}
            onProfession={setProfession}
          />

          <ChampsQualification
            visible={showEditFields}
            ids={{ prenomId, etablissementId, connaitUESId, contacteId }}
            prenom={prenom}
            onPrenom={setPrenom}
            etablissement={etablissement}
            onEtablissement={setEtablissement}
            syndicatId={syndicatId}
            syndicatOptions={syndicatOptions}
            onSyndicat={(value) => {
              setSyndicat(reference?.syndicats.find((item) => item.id === value)?.name ?? '');
            }}
            connaitUES={connaitUES}
            onConnaitUES={setConnaitUES}
            contacte={contacte}
            onContacte={setContacte}
          />

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
            <BoutonEnregistrer isPending={save.isPending} isEdit={isEdit} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
