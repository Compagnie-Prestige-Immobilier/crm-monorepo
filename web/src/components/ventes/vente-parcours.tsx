'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, LoaderIcon, MinusIcon, PlusIcon, UserCheckIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import {
  callingCountriesFrom,
  fromE164,
  InternationalPhoneField,
  toInternationalE164,
} from '@/components/forms/international-phone-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchProspects } from '@/lib/data/prospects';
import { fetchReferenceData } from '@/lib/data/reference';
import {
  createVente,
  fetchVentesConfiguration,
  formatFcfa,
  type SiteVente,
  type Vente,
  type VenteInput,
  type VentesConfiguration,
  updateVente,
} from '@/lib/data/ventes';
import { EMPTY_FILTERS } from '@/lib/filters';
import { fetchTeleconseillers } from '@/lib/data/lots-export';
import { formatDate } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

type Draft = VenteInput;
type Patch = Partial<Draft>;
type Fiche = { id: string; nom: string; prenom: string; phoneE164: string | null };

const ECRANS = [
  'telephone',
  'nom',
  'identite',
  'site',
  'canal',
  'suivi',
  'lots',
  'paiement',
  'recap',
] as const;
type Ecran = (typeof ECRANS)[number];
const RECAP = ECRANS.length - 1;
const rang = (ecran: Ecran) => ECRANS.indexOf(ecran);

type ChampTexte =
  | 'email'
  | 'numeroCni'
  | 'dateDelivranceCni'
  | 'autrePiece'
  | 'demeurantA'
  | 'profession'
  | 'adresseProfessionnelle'
  | 'representant'
  | 'nomTeleconseiller'
  | 'responsableClosing';
type Champ = { cle: ChampTexte; label: string; type?: 'email' | 'date'; placeholder?: string };

const CHAMPS_IDENTITE: readonly Champ[] = [
  { cle: 'email', label: 'E-mail', type: 'email' },
  { cle: 'numeroCni', label: 'Numéro CNI' },
  { cle: 'dateDelivranceCni', label: 'Date de délivrance CNI', type: 'date' },
  { cle: 'autrePiece', label: 'Autre pièce', placeholder: 'Ex. passeport n° A0123456' },
  { cle: 'demeurantA', label: 'Demeurant à' },
  { cle: 'profession', label: 'Profession' },
  { cle: 'adresseProfessionnelle', label: 'Adresse professionnelle' },
];

const CHAMPS_SUIVI: readonly Champ[] = [
  { cle: 'representant', label: 'Représentant' },
  { cle: 'responsableClosing', label: 'Responsable closing' },
];

const EMAIL_VALIDE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const entier = (brut: string) => Number(brut.replace(/\D/g, '')) || 0;

const NOUVEAU: Draft = {
  canal: '',
  dateSouscription: '',
  client: '',
  telephone: '',
  site: '',
  nombreLots: 1,
  numerosLots: '',
  superficie: '',
  acompte: 0,
  modePaiement: 'COMPTANT',
  marquerSoldee: false,
  email: '',
  numeroCni: '',
  dateDelivranceCni: '',
  autrePiece: '',
  demeurantA: '',
  profession: '',
  adresseProfessionnelle: '',
  representant: '',
  nomTeleconseiller: '',
  responsableClosing: '',
};

function brouillonDe(vente: Vente | null): Draft {
  if (vente === null) return { ...NOUVEAU, dateSouscription: aujourdhui() };
  const telephone = fromE164(vente.telephone);
  return {
    canal: vente.canal,
    dateSouscription: vente.dateSouscription ?? aujourdhui(),
    client: vente.client,
    telephone: telephone.phone,
    site: vente.site,
    nombreLots: vente.nombreLots,
    numerosLots: vente.numerosLots,
    superficie: vente.superficie,
    prixUnitaire: vente.prixUnitaire,
    acompte: vente.acompte,
    modePaiement: vente.modePaiement === 'CREDIT' ? 'CREDIT' : 'COMPTANT',
    ...(vente.nombreMois === null ? {} : { nombreMois: vente.nombreMois }),
    marquerSoldee: vente.soldeeManuellement,
    email: vente.email,
    numeroCni: vente.numeroCni,
    dateDelivranceCni: vente.dateDelivranceCni ?? '',
    autrePiece: vente.autrePiece,
    demeurantA: vente.demeurantA,
    profession: vente.profession,
    adresseProfessionnelle: vente.adresseProfessionnelle,
    representant: vente.representant,
    nomTeleconseiller: vente.nomTeleconseiller,
    responsableClosing: vente.responsableClosing,
  };
}

/** Ce qui manque sur chaque écran, dit avec les mots de l'écran. */
const MANQUE: Partial<Record<Ecran, (d: Draft) => string | null>> = {
  telephone: (d) => (d.telephone.trim() === '' ? 'Tapez le téléphone du client.' : null),
  nom: (d) => (d.client.trim() === '' ? 'Tapez le nom du client.' : null),
  identite: (d) => {
    const email = d.email?.trim() ?? '';
    return email === '' || EMAIL_VALIDE.test(email) ? null : 'Indiquez un e-mail valide.';
  },
  site: (d) => (d.site === '' ? 'Choisissez un site.' : null),
  canal: (d) => (d.canal === '' ? 'Choisissez un canal.' : null),
  lots: (d) => ((d.prixUnitaire ?? 0) <= 0 ? 'Indiquez le prix d’un lot.' : null),
  paiement: (d) => {
    const prixTotal = (d.prixUnitaire ?? 0) * d.nombreLots;
    if (d.modePaiement === 'COMPTANT' && d.acompte !== prixTotal) {
      return `Au comptant, le montant payé doit être de ${formatFcfa(prixTotal)}.`;
    }
    const moisManquants = d.modePaiement === 'CREDIT' && (d.nombreMois ?? 0) < 1;
    return moisManquants ? 'Indiquez le nombre de mois.' : null;
  },
};

function actifs(configuration: VentesConfiguration | undefined) {
  const sites = configuration?.sites.filter((s) => s.actif) ?? [];
  const canaux = configuration?.canaux.filter((c) => c.actif).map((c) => c.libelle) ?? [];
  return { sites, canaux };
}

function manqueTelephone(draft: Draft, callingCode: string): string | null {
  if (draft.telephone.trim() === '') return 'Tapez le téléphone du client.';
  return toInternationalE164(draft.telephone, callingCode) === null
    ? 'Indiquez un numéro de téléphone valide.'
    : null;
}

function manqueParcours(ecran: Ecran, draft: Draft, callingCode: string): string | null {
  if (ecran === 'telephone') return manqueTelephone(draft, callingCode);
  return MANQUE[ecran]?.(draft) ?? null;
}

function avecSite(draft: Draft, sites: readonly SiteVente[], nom: string): Patch {
  const choix = sites.find((s) => s.nom === nom);
  const prixDuSite = choix?.prixUnitaireDefaut ?? 0;
  return {
    site: nom,
    superficie: draft.superficie || choix?.superficieDefaut || '',
    prixUnitaire: prixDuSite > 0 ? prixDuSite : (draft.prixUnitaire ?? 0),
  };
}

function comptantSolde(draft: Draft, patch: Patch): Draft {
  const suivant = { ...draft, ...patch };
  const prixChange = 'prixUnitaire' in patch || 'nombreLots' in patch || 'modePaiement' in patch;
  if (suivant.modePaiement !== 'COMPTANT' || 'acompte' in patch || !prixChange) return suivant;
  return { ...suivant, acompte: (suivant.prixUnitaire ?? 0) * suivant.nombreLots };
}

export function VenteParcours({
  open,
  onOpenChange,
  vente = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vente?: Vente | null;
}) {
  if (!open) return null;
  return (
    <Parcours key={vente?.id ?? 'nouvelle'} onFermer={() => onOpenChange(false)} vente={vente} />
  );
}

function Parcours({ onFermer, vente }: { onFermer: () => void; vente: Vente | null }) {
  const queryClient = useQueryClient();
  const [pas, setPas] = useState(vente === null ? 0 : RECAP);
  const [erreur, setErreur] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => brouillonDe(vente));
  const [callingCode, setCallingCode] = useState(
    () => fromE164(vente?.telephone ?? '').callingCode,
  );
  const reference = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
  });
  const ecran: Ecran = ECRANS[pas] ?? 'recap';
  const configuration = useQuery({
    queryKey: queryKeys.ventesConfiguration,
    queryFn: () => fetchVentesConfiguration(),
  });
  const telephoneRecherche = toInternationalE164(draft.telephone, callingCode) ?? draft.telephone;
  const recherche = useDebouncedValue(telephoneRecherche);
  const fiches = useQuery({
    queryKey: ['ventes', 'clients', recherche],
    queryFn: () => fetchProspects({ ...EMPTY_FILTERS, search: recherche, pageSize: 3 }),
    enabled: ecran === 'telephone' && recherche.trim().length >= 4,
  });
  const { sites, canaux } = actifs(configuration.data);
  const enregistrer = useMutation({
    mutationFn: () => {
      const telephone = toInternationalE164(draft.telephone, callingCode);
      if (telephone === null) return Promise.reject(new Error('Téléphone invalide.'));
      const input = { ...draft, telephone };
      return vente === null ? createVente(input) : updateVente(vente.id, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ventes });
      toast.success(vente === null ? 'Vente enregistrée.' : 'Vente mise à jour.');
      onFermer();
    },
    onError: (error) => toastApiError(error, 'La vente n’a pas pu être enregistrée.'),
  });

  const changer = (patch: Patch) => {
    setErreur(null);
    setDraft((d) => comptantSolde(d, patch));
  };
  const aller = (cible: number) => {
    setErreur(null);
    setPas(Math.max(0, Math.min(RECAP, cible)));
  };
  const continuer = () => {
    const bloquant = manqueParcours(ecran, draft, callingCode);
    if (bloquant === null) aller(pas + 1);
    else setErreur(bloquant);
  };
  const valider = () => (pas === RECAP ? enregistrer.mutate() : continuer());

  return (
    <Cadre
      titre={vente === null ? 'Nouvelle vente' : 'Modifier la vente'}
      pas={pas}
      ecran={ecran}
      erreur={erreur}
      enregistrementEnCours={enregistrer.isPending}
      onFermer={onFermer}
      onRetour={() => aller(pas - 1)}
      onValider={valider}
    >
      <EcranCourant
        ecran={ecran}
        draft={draft}
        changer={changer}
        sites={sites}
        canaux={canaux}
        fiches={fiches.data?.items ?? []}
        countries={callingCountriesFrom(reference.data?.pays ?? [])}
        callingCode={callingCode}
        onCallingCode={setCallingCode}
        onFiche={(fiche) => {
          const telephone = fromE164(fiche.phoneE164 ?? '');
          setCallingCode(telephone.callingCode);
          changer({
            client: `${fiche.prenom} ${fiche.nom}`.trim(),
            telephone: telephone.phone,
          });
          aller(rang('identite'));
        }}
        onSite={(nom) => {
          changer(avecSite(draft, sites, nom));
          aller(rang('canal'));
        }}
        onCanal={(canal) => {
          changer({ canal });
          aller(rang('suivi'));
        }}
      />
    </Cadre>
  );
}

function EcranCourant({
  ecran,
  draft,
  changer,
  sites,
  canaux,
  fiches,
  countries,
  callingCode,
  onCallingCode,
  onFiche,
  onSite,
  onCanal,
}: EcranProps & {
  ecran: Ecran;
  sites: readonly SiteVente[];
  canaux: readonly string[];
  fiches: readonly Fiche[];
  countries: readonly { code: string; label: string }[];
  callingCode: string;
  onCallingCode: (callingCode: string) => void;
  onFiche: (fiche: Fiche) => void;
  onSite: (nom: string) => void;
  onCanal: (canal: string) => void;
}) {
  switch (ecran) {
    case 'telephone':
      return (
        <EcranTelephone
          draft={draft}
          fiches={fiches}
          changer={changer}
          onFiche={onFiche}
          countries={countries}
          callingCode={callingCode}
          onCallingCode={onCallingCode}
        />
      );
    case 'nom':
      return <EcranNom draft={draft} changer={changer} />;
    case 'identite':
      return (
        <Question titre="Qui est le client ?">
          <Champs champs={CHAMPS_IDENTITE} draft={draft} changer={changer} />
        </Question>
      );
    case 'suivi':
      return (
        <Question titre="Qui a suivi la vente ?">
          <ChoixTeleconseiller draft={draft} changer={changer} />
          <Champs champs={CHAMPS_SUIVI} draft={draft} changer={changer} />
        </Question>
      );
    case 'site':
      return (
        <Question titre="Sur quel site ?">
          <Grille
            options={sites.map((s) => ({
              valeur: s.nom,
              detail: formatFcfa(s.prixUnitaireDefaut),
            }))}
            valeur={draft.site}
            onChoisir={onSite}
          />
        </Question>
      );
    case 'canal':
      return (
        <Question titre="Par quel canal est-il venu ?">
          <Grille
            options={canaux.map((c) => ({ valeur: c, detail: '' }))}
            valeur={draft.canal}
            onChoisir={onCanal}
          />
        </Question>
      );
    case 'lots':
      return <EcranLots draft={draft} changer={changer} />;
    case 'paiement':
      return <EcranPaiement draft={draft} changer={changer} />;
    default:
      return <EcranRecap draft={draft} changer={changer} />;
  }
}

/** La fenêtre a une hauteur fixe : seul l'écran d'identité défile, sur téléphone. */
function Cadre({
  titre,
  pas,
  ecran,
  erreur,
  enregistrementEnCours,
  onFermer,
  onRetour,
  onValider,
  children,
}: {
  titre: string;
  pas: number;
  ecran: Ecran;
  erreur: string | null;
  enregistrementEnCours: boolean;
  onFermer: () => void;
  onRetour: () => void;
  onValider: () => void;
  children: ReactNode;
}) {
  const corps = useRef<HTMLDivElement>(null);
  useEffect(() => {
    corps.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, [ecran]);
  const dernier = pas === RECAP;
  return (
    <Dialog open onOpenChange={(ouvert) => (ouvert ? null : onFermer())} disablePointerDismissal>
      <DialogContent
        showCloseButton={false}
        className="grid h-[min(38rem,92dvh)] grid-rows-[auto_1fr_auto] gap-0 p-0 sm:max-w-2xl"
      >
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            onValider();
          }}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <DialogTitle className="text-[1.125rem]">{titre}</DialogTitle>
            <div className="flex items-center gap-2">
              <DialogDescription className="tabular-nums">
                {pas + 1} sur {ECRANS.length}
              </DialogDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mr-2"
                aria-label="Fermer"
                onClick={onFermer}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div
            ref={corps}
            className="flex min-h-0 flex-col justify-center gap-5 overflow-y-auto px-6 py-5"
          >
            <div key={ecran}>{children}</div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
            {erreur === null ? null : (
              <p
                role="alert"
                className="basis-full rounded-md bg-destructive/10 px-4 py-2 font-[600] text-destructive"
              >
                {erreur}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={pas === 0 ? onFermer : onRetour}
            >
              {pas === 0 ? 'Annuler' : 'Retour'}
            </Button>
            <Button type="submit" size="lg" disabled={enregistrementEnCours}>
              {dernier ? <IconeValider enCours={enregistrementEnCours} /> : null}
              {dernier ? 'Enregistrer' : 'Continuer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IconeValider({ enCours }: { enCours: boolean }) {
  if (enCours) return <LoaderIcon className="animate-spin" aria-hidden="true" />;
  return <CheckIcon aria-hidden="true" />;
}

function Question({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-[1.5rem] font-[700] tracking-[-0.02em]">{titre}</h2>
      {children}
    </div>
  );
}

function Grille({
  options,
  valeur,
  onChoisir,
}: {
  options: readonly { valeur: string; detail: string }[];
  valeur: string;
  onChoisir: (valeur: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.valeur}
          type="button"
          aria-pressed={o.valeur === valeur}
          onClick={() => onChoisir(o.valeur)}
          className={cn(
            'flex min-h-14 flex-col justify-center rounded-md border-2 px-3 py-2 text-left hover:bg-secondary',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            o.valeur === valeur ? 'border-primary bg-primary/10' : 'border-border bg-card',
          )}
        >
          <span className="font-[600]">{o.valeur}</span>
          {o.detail === '' ? null : (
            <span className="text-[0.8125rem] text-muted-foreground">{o.detail}</span>
          )}
        </button>
      ))}
    </div>
  );
}

const PLAFOND_MONTANT = 999_999_999_999;
const espaces = (n: number) => (n === 0 ? '' : n.toLocaleString('fr-FR'));

/** Le montant se tape en chiffres, s'affiche par milliers, ne dépasse jamais `max`. */
function Montant({
  id,
  label,
  valeur,
  max = PLAFOND_MONTANT,
  onChange,
  children,
}: {
  id: string;
  label: string;
  valeur: number;
  max?: number;
  onChange: (montant: number) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[1rem] font-[600]">
        {label}
      </label>
      <span className="flex items-center gap-3">
        <Input
          id={id}
          inputMode="numeric"
          className="h-14 text-[1.375rem] tabular-nums placeholder:text-[1rem] placeholder:text-muted-foreground/15"
          placeholder="0"
          value={espaces(valeur)}
          onChange={(e) => onChange(Math.min(max, entier(e.target.value)))}
        />
        <span className="shrink-0 whitespace-nowrap font-[400] text-muted-foreground">FCFA</span>
      </span>
      {children}
    </div>
  );
}

function Total({ label, montant }: { label: string; montant: number }) {
  return (
    <p className="flex items-baseline justify-between rounded-md bg-secondary px-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-[1.5rem] tabular-nums">{formatFcfa(montant)}</strong>
    </p>
  );
}

type EcranProps = { draft: Draft; changer: (patch: Patch) => void };

function EcranTelephone({
  draft,
  fiches,
  changer,
  onFiche,
  countries,
  callingCode,
  onCallingCode,
}: EcranProps & {
  fiches: readonly Fiche[];
  onFiche: (fiche: Fiche) => void;
  countries: readonly { code: string; label: string }[];
  callingCode: string;
  onCallingCode: (callingCode: string) => void;
}) {
  return (
    <Question titre="Quel est le téléphone du client ?">
      <InternationalPhoneField
        label="Téléphone du client"
        description="Choisissez le pays, puis saisissez le numéro."
        countries={countries}
        value={draft.telephone}
        callingCode={callingCode}
        onCallingCodeChange={onCallingCode}
        onChange={(telephone) => changer({ telephone })}
      />
      {fiches.map((fiche) => (
        <button
          key={fiche.id}
          type="button"
          onClick={() => onFiche(fiche)}
          className="flex items-center gap-3 rounded-md border-2 border-primary/40 bg-card p-4 text-left hover:bg-secondary"
        >
          <UserCheckIcon className="size-6 text-primary" aria-hidden="true" />
          <span className="flex-1">
            <strong className="block text-[1.0625rem]">
              {fiche.prenom} {fiche.nom}
            </strong>
            <span className="text-muted-foreground">{fiche.phoneE164}</span>
          </span>
          <span className="font-[600] text-primary">C'est lui</span>
        </button>
      ))}
    </Question>
  );
}

function EcranNom({ draft, changer }: EcranProps) {
  return (
    <Question titre="Comment s'appelle le client ?">
      <Input
        aria-label="Nom du client"
        className="h-14 text-[1.375rem] placeholder:text-muted-foreground/50"
        placeholder="Prénom et nom"
        value={draft.client}
        onChange={(e) => changer({ client: e.target.value })}
      />
    </Question>
  );
}

function Champs({ champs, draft, changer }: EcranProps & { champs: readonly Champ[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {champs.map((champ) => (
        <label
          key={champ.cle}
          htmlFor={`parcours-${champ.cle}`}
          className="flex flex-col gap-1 text-[0.875rem] font-[600]"
        >
          {champ.label}
          <Input
            id={`parcours-${champ.cle}`}
            type={champ.type ?? 'text'}
            placeholder={champ.placeholder}
            value={draft[champ.cle] ?? ''}
            onChange={(e) => changer({ [champ.cle]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}

const AUCUN = 'aucun';

function ChoixTeleconseiller({ draft, changer }: EcranProps) {
  const teleconseillers = useQuery({
    queryKey: queryKeys.lotsExportTeleconseillers,
    queryFn: () => fetchTeleconseillers(),
    staleTime: 5 * 60_000,
  });
  const choisi = draft.nomTeleconseiller ?? '';
  const noms = (teleconseillers.data ?? []).map((t) => t.fullName);
  // Un compte désactivé depuis la vente garde son nom à l'écran de modification.
  if (choisi !== '' && !noms.includes(choisi)) noms.unshift(choisi);
  return (
    <div className="flex flex-col gap-1 text-[0.875rem] font-[600]">
      Nom du téléconseiller
      <Select
        value={choisi === '' ? AUCUN : choisi}
        onValueChange={(valeur) => {
          if (valeur !== null) changer({ nomTeleconseiller: valeur === AUCUN ? '' : valeur });
        }}
      >
        <SelectTrigger aria-label="Nom du téléconseiller" className="w-full">
          <SelectValue>
            {(valeur: string) => (valeur === AUCUN ? 'Non renseigné' : valeur)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUCUN}>Non renseigné</SelectItem>
          {noms.map((nom) => (
            <SelectItem key={nom} value={nom}>
              {nom}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EcranLots({ draft, changer }: EcranProps) {
  const prixTotal = (draft.prixUnitaire ?? 0) * draft.nombreLots;
  return (
    <Question titre={`Combien de lots à ${draft.site} ?`}>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-14"
          aria-label="Un lot de moins"
          disabled={draft.nombreLots <= 1}
          onClick={() => changer({ nombreLots: draft.nombreLots - 1 })}
        >
          <MinusIcon className="size-6" aria-hidden="true" />
        </Button>
        <Input
          inputMode="numeric"
          aria-label="Nombre de lots"
          className="h-14 w-24 text-center text-[1.75rem] tabular-nums"
          value={draft.nombreLots}
          onChange={(e) =>
            changer({ nombreLots: Math.min(999, Math.max(1, entier(e.target.value))) })
          }
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-14"
          aria-label="Un lot de plus"
          onClick={() => changer({ nombreLots: draft.nombreLots + 1 })}
        >
          <PlusIcon className="size-6" aria-hidden="true" />
        </Button>
      </div>
      <Montant
        id="parcours-prix"
        label="Prix d'un lot"
        valeur={draft.prixUnitaire ?? 0}
        onChange={(prixUnitaire) => changer({ prixUnitaire })}
      />
      <Total label="Prix total" montant={prixTotal} />
    </Question>
  );
}

const PARTS_ACOMPTE: [string, number][] = [
  ['Rien', 0],
  ['Un quart', 0.25],
  ['La moitié', 0.5],
  ['Tout', 1],
];

function Mensualites({ draft, reste, changer }: EcranProps & { reste: number }) {
  const mois = draft.nombreMois ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="parcours-mois" className="text-[1rem] font-[600]">
        Sur combien de mois ?
      </label>
      <Input
        id="parcours-mois"
        inputMode="numeric"
        className="h-14 w-24 text-center text-[1.375rem] tabular-nums placeholder:text-[1rem] placeholder:text-muted-foreground/15"
        placeholder="12"
        value={mois === 0 ? '' : mois}
        onChange={(e) => changer({ nombreMois: Math.min(120, entier(e.target.value)) })}
      />
      {mois > 0 ? (
        <span className="text-muted-foreground">
          soit{' '}
          <strong className="text-foreground tabular-nums">
            {formatFcfa(Math.ceil(reste / mois))}
          </strong>{' '}
          par mois
        </span>
      ) : null}
    </div>
  );
}

function EcranPaiement({ draft, changer }: EcranProps) {
  const prixTotal = (draft.prixUnitaire ?? 0) * draft.nombreLots;
  const reste = prixTotal - draft.acompte;
  const credit = draft.modePaiement === 'CREDIT';
  const soldee = draft.acompte >= prixTotal || draft.marquerSoldee === true;
  const etat = etatPaiement(soldee, credit);
  const changerMode = (mode: string) =>
    changer({ modePaiement: mode === 'CREDIT' ? 'CREDIT' : 'COMPTANT', marquerSoldee: false });
  const changerMontant = (acompte: number) => {
    const patch: Patch = { acompte };
    if (credit || acompte >= prixTotal) patch.marquerSoldee = false;
    changer(patch);
  };
  return (
    <Question titre="Comment le client paie-t-il ?">
      <Grille
        options={[
          { valeur: 'COMPTANT', detail: 'Montant payé maintenant' },
          { valeur: 'CREDIT', detail: 'Acompte puis versements' },
        ]}
        valeur={draft.modePaiement}
        onChoisir={changerMode}
      />
      <Montant
        id="parcours-acompte"
        label={
          credit
            ? `Acompte reçu aujourd'hui, sur ${formatFcfa(prixTotal)}`
            : `Montant payé, sur ${formatFcfa(prixTotal)}`
        }
        valeur={draft.acompte}
        max={prixTotal}
        onChange={changerMontant}
      >
        <PartsAcompte visible={credit} prixTotal={prixTotal} draft={draft} changer={changer} />
      </Montant>
      {credit ? <Mensualites draft={draft} reste={reste} changer={changer} /> : null}
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary p-3">
        <span className="text-[0.9375rem]">Statut</span>
        <Badge variant={etat.variant}>{etat.libelle}</Badge>
      </div>
      <Total label="Reste à payer" montant={reste} />
    </Question>
  );
}

function etatPaiement(
  soldee: boolean,
  credit: boolean,
): { variant: 'success' | 'info' | 'warning'; libelle: string } {
  if (soldee) return { variant: 'success', libelle: 'Soldée' };
  if (credit) return { variant: 'info', libelle: 'À crédit' };
  return { variant: 'warning', libelle: 'À solder' };
}

function PartsAcompte({
  visible,
  prixTotal,
  draft,
  changer,
}: EcranProps & { visible: boolean; prixTotal: number }) {
  if (!visible) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {PARTS_ACOMPTE.map(([libelle, part]) => (
        <Button
          key={libelle}
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={draft.acompte === Math.round(prixTotal * part)}
          onClick={() => changer({ acompte: Math.round(prixTotal * part) })}
        >
          {libelle}
        </Button>
      ))}
    </div>
  );
}

function ConfirmationSoldee({ visible, draft, changer }: EcranProps & { visible: boolean }) {
  if (!visible) return null;
  return (
    <label className="flex items-start gap-3 rounded-md border border-accent-border/40 bg-warning-surface p-3 text-[0.9375rem] text-warning">
      <input
        type="checkbox"
        className="mt-1 size-4 accent-primary"
        checked={draft.marquerSoldee === true}
        onChange={(event) => changer({ marquerSoldee: event.target.checked })}
      />
      <span>Je confirme que cette vente doit être marquée soldée malgré le montant saisi.</span>
    </label>
  );
}

const joindre = (valeurs: readonly (string | undefined)[]) =>
  valeurs.filter((valeur) => (valeur ?? '').trim() !== '').join(' · ');

function pieceDe(draft: Draft): string {
  const cni = draft.numeroCni?.trim() ?? '';
  const delivrance = draft.dateDelivranceCni ?? '';
  return joindre([
    cni === '' ? '' : `CNI ${cni}`,
    delivrance === '' ? '' : `délivrée le ${formatDate(delivrance)}`,
    draft.autrePiece,
  ]);
}

function EcranRecap({ draft, changer }: EcranProps) {
  const [details, setDetails] = useState(false);
  const prixTotal = (draft.prixUnitaire ?? 0) * draft.nombreLots;
  const paiement =
    draft.modePaiement === 'CREDIT'
      ? `À crédit sur ${draft.nombreMois ?? '?'} mois`
      : 'Au comptant';
  const soldee = draft.acompte >= prixTotal || draft.marquerSoldee === true;
  const lots = `${draft.nombreLots} lot${draft.nombreLots > 1 ? 's' : ''}`;
  const lignes = [
    ['Client', `${draft.client} · ${draft.telephone}`],
    ['Site', `${draft.site} · ${lots} · ${draft.canal}`],
    ['Prix total', formatFcfa(prixTotal)],
    ['Acompte', `${formatFcfa(draft.acompte)} · ${paiement}`],
    ['Reste à payer', formatFcfa(prixTotal - draft.acompte)],
    ['Statut', soldee ? 'Soldée' : 'À solder'],
    ['Pièce', pieceDe(draft)],
    ['Suivi', joindre([draft.representant, draft.nomTeleconseiller, draft.responsableClosing])],
  ].filter((ligne): ligne is [string, string] => ligne[1] !== '');
  return (
    <Question titre="Tout est bon ?">
      <dl className="divide-y divide-border rounded-md border border-border">
        {lignes.map(([label, valeur]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-[600] tabular-nums">{valeur}</dd>
          </div>
        ))}
      </dl>
      {details ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label htmlFor="parcours-date" className="flex flex-col gap-1 text-[0.875rem] font-[600]">
            Date
            <Input
              id="parcours-date"
              type="date"
              value={draft.dateSouscription}
              onChange={(e) => changer({ dateSouscription: e.target.value })}
            />
          </label>
          <label
            htmlFor="parcours-numeros"
            className="flex flex-col gap-1 text-[0.875rem] font-[600]"
          >
            Numéros des lots
            <Input
              id="parcours-numeros"
              value={draft.numerosLots}
              placeholder="Ex. 1416 - 1417"
              onChange={(e) => changer({ numerosLots: e.target.value })}
            />
          </label>
          <label
            htmlFor="parcours-superficie"
            className="flex flex-col gap-1 text-[0.875rem] font-[600]"
          >
            Superficie
            <Input
              id="parcours-superficie"
              value={draft.superficie}
              placeholder="Ex. 225 m²"
              onChange={(e) => changer({ superficie: e.target.value })}
            />
          </label>
        </div>
      ) : (
        <Button
          type="button"
          variant="link"
          className="self-start"
          onClick={() => setDetails(true)}
        >
          Ajouter la date, les numéros de lots ou la superficie
        </Button>
      )}
    </Question>
  );
}
