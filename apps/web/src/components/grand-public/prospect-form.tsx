'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, LoaderIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';

import { FilterCombobox } from '@/components/filters/filter-combobox';
import { Field } from '@/components/forms/field';
import {
  InternationalPhoneField,
  callingCountriesFrom,
  fromE164,
  toInternationalE164,
} from '@/components/forms/international-phone-field';
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
import { queryKeys } from '@/lib/query-keys';
import {
  MODE_EPARGNE_LABELS,
  TYPE_CONTRAT_LABELS,
  type ModeEpargne,
  type PaymentMode,
  type ProspectRow,
  type ReferenceData,
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
};

function departDepuis(prospect: ProspectRow): Depart {
  const principal = fromE164(prospect.phoneE164);
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
    phone: prospect.phoneE164,
    type: prospect.type,
    paymentMode: prospect.paymentMode,
    dureeSystemeMois: prospect.dureeSystemeMois,
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
    if (valeur !== null) input[cle] = valeur;
  }
  return input as GrandPublicProspectInput;
}

/** L'API ne sait pas vider ces trois colonnes : un champ repassé à vide n'y touche pas. */
const NON_EFFACABLES = new Set(['type', 'paymentMode', 'dureeSystemeMois']);

/** `null` VIDE la colonne, l'absence la laisse : seuls les champs changés partent. */
function pourModification(avant: Modifiables, apres: Modifiables): UpdateProspectInput {
  const patch: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(apres)) {
    if (valeur === avant[cle as keyof Modifiables]) continue;
    if (valeur === null && NON_EFFACABLES.has(cle)) continue;
    patch[cle] = valeur;
  }
  return patch as UpdateProspectInput;
}

type Envoi =
  | { mode: 'creation'; input: GrandPublicProspectInput; andNext: boolean }
  | { mode: 'modification'; id: string; patch: UpdateProspectInput };

const montre = (type: ProspectType | null, champ: Champ): boolean =>
  type !== null && CHAMPS[type].includes(champ);

/** Ne garde que ce que la nouvelle situation demande. */
function pourSituation(type: ProspectType | null, actuel: Situation): Situation {
  const garde = (champ: Champ): boolean => montre(type, champ);
  return {
    employeurId: garde('employeur') ? actuel.employeurId : null,
    employeur: garde('employeur') ? actuel.employeur : '',
    typeContrat: garde('contrat') ? actuel.typeContrat : null,
    ancienneteMois: garde('anciennete') ? actuel.ancienneteMois : '',
    lieuActivite: garde('lieu') ? actuel.lieuActivite : '',
    modeEpargne: garde('epargne') ? actuel.modeEpargne : null,
    paysResidenceId: garde('pays') ? actuel.paysResidenceId : null,
    villeResidence: garde('pays') ? actuel.villeResidence : '',
    whatsapp: garde('whatsapp') ? actuel.whatsapp : '',
    relaisNom: garde('relais') ? actuel.relaisNom : '',
    relaisPhone: garde('relais') ? actuel.relaisPhone : '',
    banqueId: garde('banque') ? actuel.banqueId : null,
    syndicatId: garde('syndicat') ? actuel.syndicatId : null,
  };
}

const actives = <T extends { isActive: boolean }>(items: readonly T[] | undefined): T[] =>
  (items ?? []).filter((item) => item.isActive);

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
  const [errors, setErrors] = useState<Errors>({});
  const [conflict, setConflict] = useState<ProspectPhoneConflict | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  const reference = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

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

      if (!variables.andNext) {
        if (onSaved !== undefined) {
          onSaved(prospect);
          return;
        }
        router.push(`/grand-public/${prospect.id}`);
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

  function submit(andNext: boolean): void {
    if (save.isPending) return;

    const e164 = toInternationalE164(phone, callingCode);
    const found: Errors = {};
    if (prenom.trim() === '') found.prenom = 'Le prénom est obligatoire.';
    if (nom.trim() === '') found.nom = 'Le nom est obligatoire.';
    if (phone.trim() === '') found.phone = 'Le numéro est obligatoire.';
    else if (e164 === null) found.phone = 'Numéro invalide pour le pays choisi.';

    setErrors(found);
    if (e164 === null || Object.keys(found).length > 0) return;

    setConflict(null);
    const vide = (texte: string): string | null => (texte.trim() === '' ? null : texte.trim());
    const valeurs: Modifiables = {
      prenom: prenom.trim(),
      nom: nom.trim(),
      phone: e164,
      type,
      paymentMode,
      dureeSystemeMois: paymentMode === 'ECHELONNE' ? dureeMois : null,
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

    save.mutate({ mode: 'creation', input: pourCreation(valeurs), andNext });
  }

  const searchHref = `/grand-public?search=${encodeURIComponent(toInternationalE164(phone, callingCode) ?? phone)}`;
  const paysCountries = callingCountriesFrom(reference.data?.pays ?? []);
  const enseignante =
    reference.data?.professions.find((profession) => profession.id === professionId)?.isTeaching ===
    true;

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- raccourci Ctrl+Entrée du formulaire
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit(true);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLFormElement>) => {
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        submit(true);
      }}
    >
      {embedded ? null : (
        <div>
          <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">
            Nouveau prospect Grand Public
          </h1>
          <p className="text-body text-muted-foreground">
            Le nom, le prénom et le téléphone suffisent. Le reste se complète plus tard.
          </p>
        </div>
      )}

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
        countries={type === 'DIASPORA' ? paysCountries : undefined}
        onCallingCodeChange={setCallingCode}
        onChange={(value) => {
          setPhone(value);
          setConflict(null);
        }}
      />

      {conflict !== null ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3">
            <AlertTriangleIcon
              className="mt-0.5 size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
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
      ) : null}

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

      <FilterCombobox
        label={type === 'INFORMEL' ? 'Activité' : 'Profession'}
        placeholder="Rechercher une profession"
        value={professionId}
        options={actives(reference.data?.professions).map((profession) => ({
          value: profession.id,
          label: profession.label,
        }))}
        onChange={(value) => {
          setProfessionId(value);
          const profession = reference.data?.professions.find((item) => item.id === value);
          if (profession?.isTeaching !== true) {
            setSituation((previous) => ({ ...previous, syndicatId: null }));
          }
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

      <div className="grid gap-4 sm:grid-cols-2">
        <FilterCombobox
          label="Revenu mensuel"
          placeholder="Choisir une tranche"
          value={incomeBandId}
          options={actives(reference.data?.incomeBands).map((band) => ({
            value: band.id,
            label: band.label,
          }))}
          onChange={setIncomeBandId}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="gp-paiement">Paiement</Label>
          <Select
            value={paymentMode ?? ''}
            onValueChange={(value) => {
              const mode = value === '' || value === null ? null : (value as PaymentMode);
              setPaymentMode(mode);
              if (mode !== 'ECHELONNE') setDureeMois(null);
            }}
          >
            <SelectTrigger id="gp-paiement">
              <SelectValue placeholder="Choisir un mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMPTANT">Comptant</SelectItem>
              <SelectItem value="ECHELONNE">Échelonné</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {paymentMode === 'ECHELONNE' ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="gp-duree">Durée de remboursement</Label>
            <Select
              value={dureeMois === null ? '' : String(dureeMois)}
              onValueChange={(value) => {
                setDureeMois(value === null || value === '' ? null : Number(value));
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
        ) : null}

        <FilterCombobox
          label="Canal de provenance"
          placeholder="Choisir un canal"
          value={canalId}
          options={actives(canaux.data).map((canal) => ({ value: canal.id, label: canal.label }))}
          onChange={setCanalId}
        />
      </div>

      <PiedDeFormulaire
        modification={initial !== undefined}
        saved={saved}
        pending={save.isPending}
        onOuvrirLaFiche={() => {
          submit(false);
        }}
      />
    </form>
  );
}

function PiedDeFormulaire({
  modification,
  saved,
  pending,
  onOuvrirLaFiche,
}: {
  modification: boolean;
  saved: readonly string[];
  pending: boolean;
  onOuvrirLaFiche: () => void;
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
            onClick={onOuvrirLaFiche}
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
      {montre(type, 'employeur') ? (
        <ChampEmployeur type={type} valeurs={valeurs} reference={reference} onPatch={onPatch} />
      ) : null}

      {montre(type, 'contrat') ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="gp-contrat">Type de contrat</Label>
          <Select
            value={valeurs.typeContrat ?? ''}
            onValueChange={(value) => {
              onPatch({
                typeContrat: value === '' || value === null ? null : (value as TypeContrat),
              });
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
      ) : null}

      {montre(type, 'banque') ? (
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
      ) : null}

      {montre(type, 'syndicat') && enseignante ? (
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
      ) : null}

      {montre(type, 'anciennete') ? (
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
      ) : null}

      {montre(type, 'lieu') ? (
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
      ) : null}

      {montre(type, 'epargne') ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="gp-epargne">Mode d’épargne</Label>
          <Select
            value={valeurs.modeEpargne ?? ''}
            onValueChange={(value) => {
              onPatch({
                modeEpargne: value === '' || value === null ? null : (value as ModeEpargne),
              });
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
      ) : null}

      {montre(type, 'pays') ? (
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
      ) : null}

      {montre(type, 'whatsapp') ? (
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
      ) : null}

      {montre(type, 'relais') ? (
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
      ) : null}
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
