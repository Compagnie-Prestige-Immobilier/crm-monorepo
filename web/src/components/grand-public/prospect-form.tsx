'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, LoaderIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';

import { FilterCombobox } from '@/components/filters/filter-combobox';
import { Field } from '@/components/forms/field';
import { ETAPES_SAISIE, EtapesProgression, PiedEtapes } from '@/components/grand-public/etapes';
import {
  InternationalPhoneField,
  callingCountriesFrom,
  fromE164,
  toInternationalE164,
} from '@/components/forms/international-phone-field';
import { ChampAjoute } from '@/components/forms/champ-ajoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DUREES_MOIS,
  PROSPECT_TYPES,
  PROSPECT_TYPE_LABELS,
  createGrandPublicProspect,
  formatDureeMois,
  fetchCanauxProvenance,
  grandPublicKeys,
  type GrandPublicProspectInput,
  type ProspectType,
} from '@/lib/data/grand-public';
import {
  prospectPhoneConflict,
  updateProspect,
  type ProspectPhoneConflict,
} from '@/lib/data/prospects';
import { fetchReferenceData } from '@/lib/data/reference';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { useChampsConversion, type ChampLibre } from '@/lib/data/champs-conversion';
import { queryKeys } from '@/lib/query-keys';
import {
  MODE_EPARGNE_LABELS,
  PAYMENT_MODE_LABELS,
  PAYMENT_MODES,
  TYPE_BIEN_LABELS,
  TYPE_CONTRAT_LABELS,
  TYPES_BIEN,
  type ModeEpargne,
  type PaymentMode,
  type ProspectRow,
  type ReferenceData,
  type TypeBien,
  type TypeContrat,
  type UpdateProspectInput,
} from '@/lib/types';

type Errors = Partial<Record<'prenom' | 'nom' | 'phone', string>>;

type Champ =
  | 'employeur'
  | 'contrat'
  | 'anciennete'
  | 'banque'
  | 'syndicat'
  | 'lieu'
  | 'epargne'
  | 'pays'
  | 'whatsapp'
  | 'relais';

/**
 * Ce que chaque situation demande, en plus de l'identité, de la profession, du
 * revenu et de la provenance. La MÊME table commande l'affichage et le vidage :
 * un champ montré ailleurs partirait sinon avec la fiche suivante.
 */
const CHAMPS: Record<ProspectType, readonly Champ[]> = {
  FONCTIONNAIRE: ['employeur', 'syndicat', 'banque', 'anciennete'],
  SECTEUR_PRIVE: ['employeur', 'contrat', 'banque', 'anciennete'],
  INFORMEL: ['lieu', 'epargne'],
  DIASPORA: ['pays', 'whatsapp', 'relais', 'banque'],
};

interface Situation {
  employeurId: string | null;
  employeur: string;
  typeContrat: TypeContrat | null;
  ancienneteMois: string;
  lieuActivite: string;
  modeEpargne: ModeEpargne | null;
  paysResidenceId: string | null;
  villeResidence: string;
  whatsapp: string;
  relaisNom: string;
  relaisPhone: string;
  banqueId: string | null;
  syndicatId: string | null;
}

const SITUATION_VIDE: Situation = {
  employeurId: null,
  employeur: '',
  typeContrat: null,
  ancienneteMois: '',
  lieuActivite: '',
  modeEpargne: null,
  paysResidenceId: null,
  villeResidence: '',
  whatsapp: '',
  relaisNom: '',
  relaisPhone: '',
  banqueId: null,
  syndicatId: null,
};

interface Depart {
  prenom: string;
  nom: string;
  phone: string;
  callingCode: string;
  whatsappCode: string;
  professionId: string | null;
  incomeBandId: string | null;
  paymentMode: PaymentMode | null;
  type: ProspectType | null;
  situation: Situation;
  dureeMois: number | null;
  canalId: string | null;
  typeBien: TypeBien | null;
  champsLibres: Record<string, string>;
}

const DEPART_VIDE: Depart = {
  prenom: '',
  nom: '',
  phone: '',
  callingCode: '221',
  whatsappCode: '221',
  professionId: null,
  incomeBandId: null,
  paymentMode: null,
  type: null,
  situation: SITUATION_VIDE,
  dureeMois: null,
  canalId: null,
  typeBien: null,
  champsLibres: {},
};

function departDepuis(prospect: ProspectRow): Depart {
  const principal = fromE164(prospect.phoneE164 ?? '');
  const whatsapp = prospect.whatsappE164;
  return {
    prenom: prospect.prenom,
    nom: prospect.nom,
    phone: principal.phone,
    callingCode: principal.callingCode,
    whatsappCode: whatsapp === null ? principal.callingCode : fromE164(whatsapp).callingCode,
    professionId: prospect.professionId,
    incomeBandId: prospect.incomeBandId,
    paymentMode: prospect.paymentMode,
    type: prospect.type,
    situation: situationDepuis(prospect),
    dureeMois: prospect.dureeSystemeMois,
    canalId: prospect.canalProvenanceId,
    typeBien: prospect.typeBien,
    champsLibres: { ...prospect.champsLibres },
  };
}

function situationDepuis(prospect: ProspectRow): Situation {
  const whatsapp = prospect.whatsappE164;
  const relais = prospect.relaisPhoneE164;
  return {
    employeurId: prospect.employeurId,
    // `employeur` porte le libellé du référentiel dès qu'un identifiant est posé :
    // la saisie libre ne reprend que ce qui n'en vient pas.
    employeur: prospect.employeurId === null ? (prospect.employeur ?? '') : '',
    typeContrat: prospect.typeContrat,
    ancienneteMois: prospect.ancienneteMois === null ? '' : String(prospect.ancienneteMois),
    lieuActivite: prospect.lieuActivite ?? '',
    modeEpargne: prospect.modeEpargne,
    paysResidenceId: prospect.paysResidenceId,
    villeResidence: prospect.villeResidence ?? '',
    whatsapp: whatsapp === null ? '' : fromE164(whatsapp).phone,
    relaisNom: prospect.relaisNom ?? '',
    relaisPhone: relais === null ? '' : fromE164(relais).phone,
    banqueId: prospect.banqueId,
    syndicatId: prospect.syndicatId,
  };
}

/** Tout ce que ce formulaire écrit, dans la forme qu'attend l'API. */
interface Modifiables {
  nom: string;
  prenom: string;
  phone: string;
  type: ProspectType | null;
  paymentMode: PaymentMode | null;
  dureeSystemeMois: number | null;
  typeBien: TypeBien | null;
  champsLibres: Record<string, string>;
  professionId: string | null;
  incomeBandId: string | null;
  canalProvenanceId: string | null;
  banqueId: string | null;
  syndicatId: string | null;
  employeurId: string | null;
  employeur: string | null;
  typeContrat: TypeContrat | null;
  ancienneteMois: number | null;
  lieuActivite: string | null;
  modeEpargne: ModeEpargne | null;
  paysResidenceId: string | null;
  villeResidence: string | null;
  whatsappE164: string | null;
  relaisNom: string | null;
  relaisPhoneE164: string | null;
}

function modifiablesDepuis(prospect: ProspectRow): Modifiables {
  return {
    nom: prospect.nom,
    prenom: prospect.prenom,
    phone: prospect.phoneE164 ?? '',
    type: prospect.type,
    paymentMode: prospect.paymentMode,
    dureeSystemeMois: prospect.dureeSystemeMois,
    typeBien: prospect.typeBien,
    champsLibres: { ...prospect.champsLibres },
    professionId: prospect.professionId,
    incomeBandId: prospect.incomeBandId,
    canalProvenanceId: prospect.canalProvenanceId,
    banqueId: prospect.banqueId,
    syndicatId: prospect.syndicatId,
    employeurId: prospect.employeurId,
    employeur: prospect.employeurId === null ? prospect.employeur : null,
    typeContrat: prospect.typeContrat,
    ancienneteMois: prospect.ancienneteMois,
    lieuActivite: prospect.lieuActivite,
    modeEpargne: prospect.modeEpargne,
    paysResidenceId: prospect.paysResidenceId,
    villeResidence: prospect.villeResidence,
    whatsappE164: prospect.whatsappE164,
    relaisNom: prospect.relaisNom,
    relaisPhoneE164: prospect.relaisPhoneE164,
  };
}

/** Ce qui n'a pas été renseigné ne part pas : le serveur pose ses propres défauts. */
function pourCreation(valeurs: Modifiables): GrandPublicProspectInput {
  const input: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(valeurs)) {
    if (cle === 'champsLibres') continue;
    if (valeur !== null) input[cle] = valeur;
  }
  if (Object.keys(valeurs.champsLibres).length > 0) input.champsLibres = valeurs.champsLibres;
  return input as GrandPublicProspectInput;
}

/** L'API ne sait pas vider ces trois colonnes : un champ repassé à vide n'y touche pas. */
const NON_EFFACABLES = new Set(['type', 'paymentMode', 'dureeSystemeMois']);

/** L'identité : les trois seuls champs que ce formulaire exige lui-même. */
function identiteManquante(saisie: {
  prenom: string;
  nom: string;
  phone: string;
  e164: string | null;
}): Errors {
  const found: Errors = {};
  if (saisie.prenom.trim() === '') found.prenom = 'Le prénom est obligatoire.';
  if (saisie.nom.trim() === '') found.nom = 'Le nom est obligatoire.';
  if (saisie.phone.trim() === '') found.phone = 'Le numéro est obligatoire.';
  else if (saisie.e164 === null) found.phone = 'Numéro invalide pour le pays choisi.';
  return found;
}

/** Les champs ajoutés que l'administrateur a rendus obligatoires et qui sont vides. */
function libresManquants(
  libres: readonly ChampLibre[],
  reponses: Record<string, string>,
): Record<string, string> {
  const manquants: Record<string, string> = {};
  for (const champ of libres) {
    if (champ.obligatoire && (reponses[champ.id] ?? '').trim() === '') {
      manquants[champ.id] = `« ${champ.libelle} » est obligatoire.`;
    }
  }
  return manquants;
}

/** Les réponses aux champs ajoutés sont un objet : l'égalité se lit sur le contenu. */
const memesReponses = (a: Record<string, string>, b: Record<string, string>): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** `null` VIDE la colonne, l'absence la laisse : seuls les champs changés partent. */
function pourModification(avant: Modifiables, apres: Modifiables): UpdateProspectInput {
  const patch: Record<string, unknown> = {};
  if (!memesReponses(avant.champsLibres, apres.champsLibres)) {
    patch.champsLibres = apres.champsLibres;
  }
  for (const [cle, valeur] of Object.entries(apres)) {
    if (cle === 'champsLibres') continue;
    if (valeur === avant[cle as keyof Modifiables]) continue;
    if (valeur === null && NON_EFFACABLES.has(cle)) continue;
    patch[cle] = valeur;
  }
  return patch as UpdateProspectInput;
}

/** Ce que le téléconseiller a demandé en enregistrant : la suite du geste. */
type Suite = 'suivant' | 'fiche' | 'quitter';

type Envoi =
  | { mode: 'creation'; input: GrandPublicProspectInput; suite: Suite }
  | { mode: 'modification'; id: string; patch: UpdateProspectInput };

const montre = (type: ProspectType | null, champ: Champ): boolean =>
  type !== null && CHAMPS[type].includes(champ);

/** Le champ qui commande chaque colonne de la situation : deux colonnes peuvent dépendre du même. */
const CHAMP_PAR_CLE: Record<keyof Situation, Champ> = {
  employeurId: 'employeur',
  employeur: 'employeur',
  typeContrat: 'contrat',
  ancienneteMois: 'anciennete',
  lieuActivite: 'lieu',
  modeEpargne: 'epargne',
  paysResidenceId: 'pays',
  villeResidence: 'pays',
  whatsapp: 'whatsapp',
  relaisNom: 'relais',
  relaisPhone: 'relais',
  banqueId: 'banque',
  syndicatId: 'syndicat',
};

/** Ne garde que ce que la nouvelle situation demande, vide le reste vers `SITUATION_VIDE`. */
function pourSituation(type: ProspectType | null, actuel: Situation): Situation {
  const result: Record<string, unknown> = { ...actuel };
  for (const [cle, champ] of Object.entries(CHAMP_PAR_CLE)) {
    if (!montre(type, champ)) result[cle] = SITUATION_VIDE[cle as keyof Situation];
  }
  return result as unknown as Situation;
}

const actives = <T extends { isActive: boolean }>(items: readonly T[] | undefined): T[] =>
  (items ?? []).filter((item) => item.isActive);

function searchHrefPourConflit(phone: string, callingCode: string): string {
  return `/grand-public?search=${encodeURIComponent(toInternationalE164(phone, callingCode) ?? phone)}`;
}

function paysDisponibles(reference: ReferenceData | undefined) {
  return callingCountriesFrom(reference?.pays ?? []);
}

function estEnseignante(
  reference: ReferenceData | undefined,
  professionId: string | null,
): boolean {
  return (
    reference?.professions.find((profession) => profession.id === professionId)?.isTeaching === true
  );
}

function countriesPourTelephone(
  type: ProspectType | null,
  paysCountries: readonly { code: string; label: string }[],
) {
  return type === 'DIASPORA' ? paysCountries : undefined;
}

function orEmptyString<T extends string>(value: T | null): string {
  return value ?? '';
}

function dureeSelectValue(dureeMois: number | null): string {
  return dureeMois === null ? '' : String(dureeMois);
}

function libelleProfession(type: ProspectType | null): string {
  return type === 'INFORMEL' ? 'Activité' : 'Profession';
}

function IntroHeader({ embedded }: { embedded: boolean }) {
  if (embedded) return null;
  return (
    <div>
      <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">
        Nouveau prospect Grand Public
      </h1>
      <p className="text-body text-muted-foreground">
        Le nom, le prénom et le téléphone suffisent. Le reste se complète plus tard.
      </p>
    </div>
  );
}

function PhoneConflictCard({
  conflict,
  searchHref,
}: {
  conflict: ProspectPhoneConflict | null;
  searchHref: string;
}) {
  if (conflict === null) return null;
  return (
    <Card className="border-destructive/40">
      <CardContent className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div role="alert" className="flex min-w-0 flex-col gap-1">
          <p className="font-[600]">
            Ce numéro est déjà celui de {conflict.prenom} {conflict.nom}.
          </p>
          <p className="text-[0.8125rem] text-muted-foreground">
            Saisi par le téléconseiller {conflict.ownedByCommercialName} le{' '}
            {formatDateTime(conflict.createdAt)}.
          </p>
          <Link
            href={searchHref}
            className="w-fit rounded-sm font-[600] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Chercher cette fiche dans le Grand Public
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfessionField({
  type,
  professionId,
  reference,
  onChange,
}: {
  type: ProspectType | null;
  professionId: string | null;
  reference: ReferenceData | undefined;
  onChange: (professionId: string | null, isTeaching: boolean) => void;
}) {
  return (
    <FilterCombobox
      label={libelleProfession(type)}
      placeholder="Rechercher une profession"
      value={professionId}
      options={actives(reference?.professions).map((profession) => ({
        value: profession.id,
        label: profession.label,
      }))}
      onChange={(value) => {
        const profession = reference?.professions.find((item) => item.id === value);
        onChange(value, profession?.isTeaching === true);
      }}
    />
  );
}

function MontantsFields({
  incomeBandId,
  onIncomeBandChange,
  paymentMode,
  onPaymentModeChange,
  dureeMois,
  onDureeChange,
  canalId,
  onCanalChange,
  reference,
  canaux,
}: {
  incomeBandId: string | null;
  onIncomeBandChange: (value: string | null) => void;
  paymentMode: PaymentMode | null;
  onPaymentModeChange: (mode: PaymentMode | null) => void;
  dureeMois: number | null;
  onDureeChange: (value: number | null) => void;
  canalId: string | null;
  onCanalChange: (value: string | null) => void;
  reference: ReferenceData | undefined;
  canaux: readonly { id: string; label: string; isActive: boolean }[] | undefined;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FilterCombobox
        label="Revenu mensuel"
        placeholder="Choisir une tranche"
        value={incomeBandId}
        options={actives(reference?.incomeBands).map((band) => ({
          value: band.id,
          label: band.label,
        }))}
        onChange={onIncomeBandChange}
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="gp-paiement">Paiement</Label>
        <Select
          value={orEmptyString(paymentMode)}
          onValueChange={(value) => {
            const mode = value === '' || value === null ? null : (value as PaymentMode);
            onPaymentModeChange(mode);
          }}
        >
          <SelectTrigger id="gp-paiement">
            <SelectValue placeholder="Choisir un mode" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {PAYMENT_MODE_LABELS[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DureeField paymentMode={paymentMode} dureeMois={dureeMois} onDureeChange={onDureeChange} />

      <FilterCombobox
        label="Canal de provenance"
        placeholder="Choisir un canal"
        value={canalId}
        options={actives(canaux).map((canal) => ({ value: canal.id, label: canal.label }))}
        onChange={onCanalChange}
      />
    </div>
  );
}

function DureeField({
  paymentMode,
  dureeMois,
  onDureeChange,
}: {
  paymentMode: PaymentMode | null;
  dureeMois: number | null;
  onDureeChange: (value: number | null) => void;
}) {
  if (paymentMode !== 'ECHELONNE') return null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor="gp-duree">Durée de remboursement</Label>
      <Select
        value={dureeSelectValue(dureeMois)}
        onValueChange={(value) => {
          onDureeChange(value === null || value === '' ? null : Number(value));
        }}
      >
        <SelectTrigger id="gp-duree">
          <SelectValue placeholder="Choisir une durée" />
        </SelectTrigger>
        <SelectContent>
          {DUREES_MOIS.map((mois) => (
            <SelectItem key={mois} value={String(mois)}>
              {formatDureeMois(mois)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function GrandPublicProspectForm({
  embedded = false,
  initial,
  onSaved,
}: {
  embedded?: boolean;
  /** Présent : le formulaire MODIFIE cette fiche au lieu d'en créer une. */
  initial?: ProspectRow;
  onSaved?: (prospect: ProspectRow) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const prenomRef = useRef<HTMLInputElement>(null);

  const [depart] = useState(() => (initial === undefined ? DEPART_VIDE : departDepuis(initial)));
  const [prenom, setPrenom] = useState(depart.prenom);
  const [nom, setNom] = useState(depart.nom);
  const [phone, setPhone] = useState(depart.phone);
  const [callingCode, setCallingCode] = useState(depart.callingCode);
  const [whatsappCode, setWhatsappCode] = useState(depart.whatsappCode);
  const [professionId, setProfessionId] = useState(depart.professionId);
  const [incomeBandId, setIncomeBandId] = useState(depart.incomeBandId);
  const [paymentMode, setPaymentMode] = useState(depart.paymentMode);
  const [type, setType] = useState(depart.type);
  const [situation, setSituation] = useState(depart.situation);
  const [dureeMois, setDureeMois] = useState(depart.dureeMois);
  const [canalId, setCanalId] = useState(depart.canalId);
  const [typeBien, setTypeBien] = useState(depart.typeBien);
  const [champsLibres, setChampsLibres] = useState(depart.champsLibres);
  const [errorsLibres, setErrorsLibres] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [etape, setEtape] = useState(0);
  const [conflict, setConflict] = useState<ProspectPhoneConflict | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  const reference = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  const formulaire = useChampsConversion('GRAND_PUBLIC');

  const canaux = useQuery({
    queryKey: grandPublicKeys.canaux,
    queryFn: () => fetchCanauxProvenance(),
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: (variables: Envoi) =>
      variables.mode === 'creation'
        ? createGrandPublicProspect(variables.input)
        : updateProspect(variables.id, variables.patch),
    onSuccess: (prospect, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot });

      if (variables.mode === 'modification') {
        toast.success('Fiche modifiée.');
        // La fiche est rendue par le serveur : sans cela, revenir dessus
        // afficherait encore l'état d'avant.
        router.refresh();
        onSaved?.(prospect);
        return;
      }

      setSaved((previous) => [...previous, `${prospect.prenom} ${prospect.nom}`]);
      toast.success(`${prospect.prenom} ${prospect.nom} enregistré.`);

      if (variables.suite !== 'suivant') {
        // La boîte de création se referme, PUIS l'écran demandé s'ouvre : s'arrêter
        // à `onSaved` laissait « ouvrir la fiche » n'ouvrir rien.
        onSaved?.(prospect);
        router.push(variables.suite === 'fiche' ? `/grand-public/${prospect.id}` : '/grand-public');
        return;
      }

      // Seule l'identité repart de zéro : une rafale vient du même canal et
      // s'accorde sur la même durée de système.
      setPrenom('');
      setNom('');
      setPhone('');
      setProfessionId(null);
      setIncomeBandId(null);
      setType(null);
      setSituation(SITUATION_VIDE);
      setErrors({});
      prenomRef.current?.focus();
    },
    onError: (error) => {
      const existing = prospectPhoneConflict(error);
      if (existing !== null) {
        setConflict(existing);
        return;
      }
      toastApiError(error, 'Le prospect n’a pas pu être enregistré.');
    },
  });

  function submit(suite: Suite): void {
    if (save.isPending) return;

    const e164 = toInternationalE164(phone, callingCode);
    const found = identiteManquante({ prenom, nom, phone, e164 });
    const manquants = libresManquants(formulaire.libres, champsLibres);
    setErrorsLibres(manquants);
    setErrors(found);
    if (e164 === null || Object.keys(found).length > 0 || Object.keys(manquants).length > 0) {
      if (e164 === null || Object.keys(found).length > 0) setEtape(0);
      return;
    }

    setConflict(null);
    const vide = (texte: string): string | null => (texte.trim() === '' ? null : texte.trim());
    const valeurs: Modifiables = {
      prenom: prenom.trim(),
      nom: nom.trim(),
      phone: e164,
      type,
      paymentMode,
      dureeSystemeMois: paymentMode === 'ECHELONNE' ? dureeMois : null,
      typeBien,
      champsLibres,
      professionId,
      incomeBandId,
      canalProvenanceId: canalId,
      banqueId: situation.banqueId,
      syndicatId: situation.syndicatId,
      employeurId: situation.employeurId,
      employeur: vide(situation.employeur),
      typeContrat: situation.typeContrat,
      ancienneteMois: anciennete(situation.ancienneteMois),
      lieuActivite: vide(situation.lieuActivite),
      modeEpargne: situation.modeEpargne,
      paysResidenceId: situation.paysResidenceId,
      villeResidence: vide(situation.villeResidence),
      whatsappE164: toInternationalE164(situation.whatsapp, whatsappCode),
      relaisNom: vide(situation.relaisNom),
      // Le relais est AU SÉNÉGAL : son numéro ne suit pas le pays de résidence.
      relaisPhoneE164: toInternationalE164(situation.relaisPhone, '221'),
    };

    if (initial !== undefined) {
      save.mutate({
        mode: 'modification',
        id: initial.id,
        patch: pourModification(modifiablesDepuis(initial), valeurs),
      });
      return;
    }

    save.mutate({ mode: 'creation', input: pourCreation(valeurs), suite });
  }

  const searchHref = searchHrefPourConflit(phone, callingCode);
  const paysCountries = paysDisponibles(reference.data);
  const enseignante = estEnseignante(reference.data, professionId);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- raccourci Ctrl+Entrée du formulaire
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit('suivant');
      }}
      onKeyDown={(event: KeyboardEvent<HTMLFormElement>) => {
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        submit('suivant');
      }}
    >
      <IntroHeader embedded={embedded} />

      <EtapesProgression etapes={ETAPES_SAISIE} courante={etape} onChoisir={setEtape} />

      {etape === 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" required error={errors.prenom}>
              {(props) => (
                <Input
                  {...props}
                  ref={prenomRef}
                  value={prenom}
                  maxLength={120}
                  autoComplete="off"
                  // oxlint-disable-next-line jsx-a11y/no-autofocus -- premier champ du formulaire
                  autoFocus
                  onChange={(event) => {
                    setPrenom(event.target.value);
                  }}
                />
              )}
            </Field>

            <Field label="Nom" required error={errors.nom}>
              {(props) => (
                <Input
                  {...props}
                  value={nom}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(event) => {
                    setNom(event.target.value);
                  }}
                />
              )}
            </Field>
          </div>

          <InternationalPhoneField
            value={phone}
            callingCode={callingCode}
            error={errors.phone}
            countries={countriesPourTelephone(type, paysCountries)}
            onCallingCodeChange={setCallingCode}
            onChange={(value) => {
              setPhone(value);
              setConflict(null);
            }}
          />

          <PhoneConflictCard conflict={conflict} searchHref={searchHref} />
        </>
      ) : null}

      {etape === 1 ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[0.875rem] font-[600] text-foreground">Situation</legend>
            <div className="flex flex-wrap gap-2">
              {PROSPECT_TYPES.map((option) => {
                const active = type === option;
                return (
                  <Button
                    key={option}
                    type="button"
                    size="lg"
                    variant={active ? 'default' : 'outline'}
                    aria-pressed={active}
                    onClick={() => {
                      const next = active ? null : option;
                      setType(next);
                      setErrors({});
                      setSituation((previous) => pourSituation(next, previous));
                      // L'indicatif venait du pays de résidence : hors diaspora, il
                      // repart du Sénégal plutôt que de suivre une fiche abandonnée.
                      if (type === 'DIASPORA' && next !== 'DIASPORA') {
                        setCallingCode('221');
                        setWhatsappCode('221');
                      }
                    }}
                  >
                    {PROSPECT_TYPE_LABELS[option]}
                  </Button>
                );
              })}
            </div>
          </fieldset>

          <ProfessionField
            type={type}
            professionId={professionId}
            reference={reference.data}
            onChange={(value, isTeaching) => {
              setProfessionId(value);
              if (!isTeaching) setSituation((previous) => ({ ...previous, syndicatId: null }));
            }}
          />

          <ChampsSituation
            type={type}
            valeurs={situation}
            reference={reference.data}
            enseignante={enseignante}
            paysCountries={paysCountries}
            whatsappCode={whatsappCode}
            onWhatsappCode={setWhatsappCode}
            onIndicatifResidence={(indicatif) => {
              setCallingCode(indicatif);
              setWhatsappCode(indicatif);
            }}
            onPatch={(patch) => {
              setSituation((previous) => ({ ...previous, ...patch }));
            }}
          />
        </>
      ) : null}

      {etape === 2 ? (
        <>
          <MontantsFields
            incomeBandId={incomeBandId}
            onIncomeBandChange={setIncomeBandId}
            paymentMode={paymentMode}
            onPaymentModeChange={(mode) => {
              setPaymentMode(mode);
              if (mode !== 'ECHELONNE') setDureeMois(null);
            }}
            dureeMois={dureeMois}
            onDureeChange={setDureeMois}
            canalId={canalId}
            onCanalChange={setCanalId}
            reference={reference.data}
            canaux={canaux.data}
          />

          {formulaire.libres.map((champ) => (
            <ChampAjoute
              key={champ.id}
              champ={champ}
              value={champsLibres[champ.id] ?? ''}
              error={errorsLibres[champ.id]}
              onChange={(valeur) => {
                setChampsLibres((precedent) => ({ ...precedent, [champ.id]: valeur }));
              }}
            />
          ))}

          <Field label="Type de bien">
            {(props) => (
              <Select
                value={orEmptyString(typeBien)}
                onValueChange={(valeur) => {
                  setTypeBien(valeur === '' ? null : (valeur as TypeBien));
                }}
              >
                <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
                  <SelectValue placeholder="Non renseigné" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_BIEN.map((valeur) => (
                    <SelectItem key={valeur} value={valeur}>
                      {TYPE_BIEN_LABELS[valeur]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <PiedDeFormulaire
            modification={initial !== undefined}
            saved={saved}
            pending={save.isPending}
            onSuite={submit}
          />
        </>
      ) : null}

      <PiedEtapes
        courante={etape}
        total={ETAPES_SAISIE.length}
        desactive={save.isPending}
        onRetour={() => {
          setEtape(etape - 1);
        }}
        onSuite={() => {
          setEtape(etape + 1);
        }}
      />
    </form>
  );
}

function PiedDeFormulaire({
  modification,
  saved,
  pending,
  onSuite,
}: {
  modification: boolean;
  saved: readonly string[];
  pending: boolean;
  onSuite: (suite: Suite) => void;
}) {
  const last = saved.at(-1);
  const plural = saved.length > 1 ? 's' : '';

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {modification ? null : (
        <>
          <p aria-live="polite" className="mr-auto text-[0.8125rem] text-muted-foreground">
            {last === undefined
              ? 'Ctrl + Entrée enregistre et enchaîne. Le canal et la durée restent en place.'
              : `${String(saved.length)} prospect${plural} enregistré${plural}. Dernier : ${last}.`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => {
              onSuite('quitter');
            }}
          >
            Enregistrer et quitter
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => {
              onSuite('fiche');
            }}
          >
            Enregistrer et ouvrir la fiche
          </Button>
        </>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? (
          <>
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Enregistrement…
          </>
        ) : (
          libelleEnvoi(modification)
        )}
      </Button>
    </div>
  );
}

const libelleEnvoi = (modification: boolean): string =>
  modification ? 'Enregistrer les modifications' : 'Enregistrer et suivant';

/** Un entier de mois, ou `null` : le serveur refuse tout le reste. */
function anciennete(saisie: string): number | null {
  const valeur = Number(saisie.trim());
  if (saisie.trim() === '' || !Number.isInteger(valeur) || valeur < 0 || valeur > 840) return null;
  return valeur;
}

interface ChampSituationProps {
  type: ProspectType | null;
  valeurs: Situation;
  reference: ReferenceData | undefined;
  onPatch: (patch: Partial<Situation>) => void;
}

function ContratField({ type, valeurs, onPatch }: ChampSituationProps) {
  if (!montre(type, 'contrat')) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor="gp-contrat">Type de contrat</Label>
      <Select
        value={orEmptyString(valeurs.typeContrat)}
        onValueChange={(value) => {
          onPatch({ typeContrat: value === '' || value === null ? null : (value as TypeContrat) });
        }}
      >
        <SelectTrigger id="gp-contrat">
          <SelectValue placeholder="Choisir un contrat" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TYPE_CONTRAT_LABELS).map(([valeur, libelle]) => (
            <SelectItem key={valeur} value={valeur}>
              {libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function BanqueField({ type, valeurs, reference, onPatch }: ChampSituationProps) {
  if (!montre(type, 'banque')) return null;
  return (
    <FilterCombobox
      label={type === 'DIASPORA' ? 'Banque au Sénégal' : 'Banque de domiciliation'}
      placeholder="Choisir une banque"
      value={valeurs.banqueId}
      options={actives(reference?.banques).map((banque) => ({
        value: banque.id,
        label: banque.name,
        hint: banque.shortName,
      }))}
      onChange={(banqueId) => {
        onPatch({ banqueId });
      }}
    />
  );
}

function SyndicatField({
  type,
  enseignante,
  valeurs,
  reference,
  onPatch,
}: ChampSituationProps & { enseignante: boolean }) {
  if (!montre(type, 'syndicat') || !enseignante) return null;
  return (
    <FilterCombobox
      label="Syndicat"
      placeholder="Choisir un syndicat"
      value={valeurs.syndicatId}
      options={actives(reference?.syndicats).map((syndicat) => ({
        value: syndicat.id,
        label: syndicat.name,
        hint: syndicat.sigle,
      }))}
      onChange={(syndicatId) => {
        onPatch({ syndicatId });
      }}
    />
  );
}

function AncienneteField({ type, valeurs, onPatch }: ChampSituationProps) {
  if (!montre(type, 'anciennete')) return null;
  return (
    <Field label="Ancienneté (mois)" description="Chez l’employeur actuel.">
      {(props) => (
        <Input
          {...props}
          type="number"
          min="0"
          max="840"
          inputMode="numeric"
          value={valeurs.ancienneteMois}
          onChange={(event) => {
            onPatch({ ancienneteMois: event.target.value });
          }}
        />
      )}
    </Field>
  );
}

function LieuField({ type, valeurs, onPatch }: ChampSituationProps) {
  if (!montre(type, 'lieu')) return null;
  return (
    <Field label="Lieu d’activité">
      {(props) => (
        <Input
          {...props}
          value={valeurs.lieuActivite}
          maxLength={160}
          onChange={(event) => {
            onPatch({ lieuActivite: event.target.value });
          }}
        />
      )}
    </Field>
  );
}

function EpargneField({ type, valeurs, onPatch }: ChampSituationProps) {
  if (!montre(type, 'epargne')) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor="gp-epargne">Mode d’épargne</Label>
      <Select
        value={orEmptyString(valeurs.modeEpargne)}
        onValueChange={(value) => {
          onPatch({ modeEpargne: value === '' || value === null ? null : (value as ModeEpargne) });
        }}
      >
        <SelectTrigger id="gp-epargne">
          <SelectValue placeholder="Choisir un mode" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(MODE_EPARGNE_LABELS).map(([valeur, libelle]) => (
            <SelectItem key={valeur} value={valeur}>
              {libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PaysField({
  type,
  valeurs,
  reference,
  onIndicatifResidence,
  onPatch,
}: ChampSituationProps & { onIndicatifResidence: (indicatif: string) => void }) {
  if (!montre(type, 'pays')) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FilterCombobox
        label="Pays de résidence"
        placeholder="Choisir un pays"
        value={valeurs.paysResidenceId}
        options={actives(reference?.pays).map((pays) => ({
          value: pays.id,
          label: pays.label,
          hint: `+${pays.indicatif}`,
        }))}
        onChange={(paysResidenceId) => {
          onPatch({ paysResidenceId });
          const choisi = reference?.pays.find((pays) => pays.id === paysResidenceId);
          if (choisi !== undefined) onIndicatifResidence(choisi.indicatif);
        }}
      />
      <Field label="Ville de résidence">
        {(props) => (
          <Input
            {...props}
            value={valeurs.villeResidence}
            maxLength={120}
            onChange={(event) => {
              onPatch({ villeResidence: event.target.value });
            }}
          />
        )}
      </Field>
    </div>
  );
}

function WhatsappField({
  type,
  valeurs,
  paysCountries,
  whatsappCode,
  onWhatsappCode,
  onPatch,
}: ChampSituationProps & {
  paysCountries: readonly { code: string; label: string }[];
  whatsappCode: string;
  onWhatsappCode: (value: string) => void;
}) {
  if (!montre(type, 'whatsapp')) return null;
  return (
    <InternationalPhoneField
      label="WhatsApp"
      countryLabel="Pays WhatsApp"
      description="Laissez vide s’il est identique au téléphone."
      required={false}
      placeholder="6 12 34 56 78"
      countries={paysCountries}
      value={valeurs.whatsapp}
      callingCode={whatsappCode}
      onCallingCodeChange={onWhatsappCode}
      onChange={(whatsapp) => {
        onPatch({ whatsapp });
      }}
    />
  );
}

function RelaisField({ type, valeurs, onPatch }: ChampSituationProps) {
  if (!montre(type, 'relais')) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Personne relais au Sénégal">
        {(props) => (
          <Input
            {...props}
            value={valeurs.relaisNom}
            maxLength={160}
            onChange={(event) => {
              onPatch({ relaisNom: event.target.value });
            }}
          />
        )}
      </Field>
      <Field label="Téléphone du relais">
        {(props) => (
          <Input
            {...props}
            value={valeurs.relaisPhone}
            maxLength={40}
            inputMode="tel"
            placeholder="77 123 45 67"
            onChange={(event) => {
              onPatch({ relaisPhone: event.target.value });
            }}
          />
        )}
      </Field>
    </div>
  );
}

function ChampsSituation({
  type,
  valeurs,
  reference,
  enseignante,
  paysCountries,
  whatsappCode,
  onWhatsappCode,
  onIndicatifResidence,
  onPatch,
}: {
  type: ProspectType | null;
  valeurs: Situation;
  reference: ReferenceData | undefined;
  enseignante: boolean;
  paysCountries: readonly { code: string; label: string }[];
  whatsappCode: string;
  onWhatsappCode: (value: string) => void;
  onIndicatifResidence: (indicatif: string) => void;
  onPatch: (patch: Partial<Situation>) => void;
}) {
  if (type === null) return null;

  return (
    <div className="flex flex-col gap-4">
      <ChampEmployeur type={type} valeurs={valeurs} reference={reference} onPatch={onPatch} />
      <ContratField type={type} valeurs={valeurs} reference={reference} onPatch={onPatch} />
      <BanqueField type={type} valeurs={valeurs} reference={reference} onPatch={onPatch} />
      <SyndicatField
        type={type}
        enseignante={enseignante}
        valeurs={valeurs}
        reference={reference}
        onPatch={onPatch}
      />
      <AncienneteField type={type} valeurs={valeurs} reference={reference} onPatch={onPatch} />
      <LieuField type={type} valeurs={valeurs} reference={reference} onPatch={onPatch} />
      <EpargneField type={type} valeurs={valeurs} reference={reference} onPatch={onPatch} />
      <PaysField
        type={type}
        valeurs={valeurs}
        reference={reference}
        onIndicatifResidence={onIndicatifResidence}
        onPatch={onPatch}
      />
      <WhatsappField
        type={type}
        valeurs={valeurs}
        reference={reference}
        paysCountries={paysCountries}
        whatsappCode={whatsappCode}
        onWhatsappCode={onWhatsappCode}
        onPatch={onPatch}
      />
      <RelaisField type={type} valeurs={valeurs} reference={reference} onPatch={onPatch} />
    </div>
  );
}

/**
 * Référentiel d'abord, saisie libre ensuite : « Créer » retient le texte tapé
 * dans `employeur`, que le serveur garde tel quel faute d'entrée de référence.
 */
function ChampEmployeur({
  type,
  valeurs,
  reference,
  onPatch,
}: {
  type: ProspectType;
  valeurs: Situation;
  reference: ReferenceData | undefined;
  onPatch: (patch: Partial<Situation>) => void;
}) {
  const attendu = type === 'FONCTIONNAIRE' ? 'MINISTERE' : 'ENTREPRISE';
  const options = actives(reference?.employeurs)
    .filter((employeur) => employeur.type === attendu)
    .map((employeur) => ({ value: employeur.id, label: employeur.label }));

  const libre = valeurs.employeur.trim() !== '' && valeurs.employeurId === null;

  return (
    <FilterCombobox
      label={type === 'FONCTIONNAIRE' ? 'Ministère ou structure' : 'Employeur'}
      placeholder="Rechercher ou saisir"
      value={libre ? '__libre__' : valeurs.employeurId}
      options={
        libre
          ? [{ value: '__libre__', label: valeurs.employeur, hint: 'Saisi à la main' }, ...options]
          : options
      }
      onChange={(value) => {
        onPatch({ employeurId: value === '__libre__' ? null : value, employeur: '' });
      }}
      onCreate={(texte) => {
        onPatch({ employeurId: null, employeur: texte.slice(0, 160) });
      }}
    />
  );
}
