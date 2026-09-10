import type { components } from '@crm/api-client';

type Schemas = components['schemas'];

export type FormulairePublic = Schemas['FormulairePublicDto'];
export type OptionPublique = Schemas['OptionPubliqueDto'];
export type ReglageChampPublic = Schemas['ReglageChampDto'];
export type ChampLibrePublic = Schemas['ChampLibreDto'];
type WhatsappStatus = Schemas['WhatsappStatus'];

export type Saisie = Readonly<Record<string, string>>;

export const MESSAGE_MAX = 500;

export type SourceListe =
  | 'banques'
  | 'syndicats'
  | 'revenus'
  | 'professions'
  | 'dureesEtablissement'
  | 'situations'
  | 'paiements'
  | 'durees'
  | 'whatsapp';

export interface Widget {
  readonly saisie: 'texte' | 'liste' | 'ouinon';
  readonly source?: SourceListe;
  readonly type?: 'tel' | 'email';
  readonly autoComplete?: string;
  readonly nombre?: true;
  readonly longueurMax?: number;
}

export type Etape = 'coordonnees' | 'complement';

interface Section {
  readonly titre: string;
  readonly etape: Etape;
  readonly widgets: Readonly<Record<string, Widget>>;
}

/**
 * Les sections REGROUPENT, elles ne classent pas : l'ordre des champs reste
 * celui que l'API envoie, et une section apparaît là où son premier champ tombe.
 */
const SECTIONS: readonly Section[] = [
  {
    titre: 'Vos coordonnées',
    etape: 'coordonnees',
    widgets: {
      nom: { saisie: 'texte', autoComplete: 'family-name', longueurMax: 120 },
      prenom: { saisie: 'texte', autoComplete: 'given-name', longueurMax: 120 },
      phoneE164: { saisie: 'texte', type: 'tel', autoComplete: 'tel', longueurMax: 40 },
      whatsappStatus: { saisie: 'liste', source: 'whatsapp' },
      whatsappE164: { saisie: 'texte', type: 'tel', longueurMax: 40 },
      email: { saisie: 'texte', type: 'email', autoComplete: 'email', longueurMax: 254 },
    },
  },
  {
    titre: 'Votre situation',
    etape: 'complement',
    widgets: {
      profession: { saisie: 'liste', source: 'professions' },
      etablissement: { saisie: 'texte', autoComplete: 'organization', longueurMax: 160 },
      dureeEtablissementMois: {
        saisie: 'liste',
        source: 'dureesEtablissement',
        nombre: true,
      },
      fonctionnaire: { saisie: 'ouinon' },
      type: { saisie: 'liste', source: 'situations' },
      syndicatId: { saisie: 'liste', source: 'syndicats' },
    },
  },
  {
    titre: 'Votre banque',
    etape: 'complement',
    widgets: {
      banqueId: { saisie: 'liste', source: 'banques' },
      engagementEnCours: { saisie: 'ouinon' },
      incomeBandId: { saisie: 'liste', source: 'revenus' },
      paymentMode: { saisie: 'liste', source: 'paiements' },
      dureeSystemeMois: { saisie: 'liste', source: 'durees', nombre: true },
    },
  },
];

const WIDGETS = new Map<string, Widget>(
  SECTIONS.flatMap((section) => Object.entries(section.widgets)),
);

const ETAPES = new Map<string, Etape>(
  SECTIONS.flatMap((section) => Object.keys(section.widgets).map((cle) => [cle, section.etape])),
);

export const widgetDe = (champ: string): Widget | undefined => WIDGETS.get(champ);

export const etapeDuChamp = (champ: string): Etape | undefined => ETAPES.get(champ);

export const aDesCoordonnees = (champs: readonly ReglageChampPublic[]): boolean =>
  champs.some((champ) => champ.visible && ETAPES.get(champ.champ) === 'coordonnees');

export const CHOIX_WHATSAPP: readonly { readonly value: WhatsappStatus; readonly label: string }[] =
  [
    { value: 'MEME_NUMERO', label: 'Le même que mon téléphone' },
    { value: 'AUTRE_NUMERO', label: 'Un autre numéro' },
    { value: 'AUCUN', label: 'Pas de WhatsApp' },
  ];

/** L'identité et le numéro portent la demande : l'API les exige quel que soit le réglage. */
const TOUJOURS_REQUIS = new Set(['nom', 'prenom', 'phoneE164']);

export const estRequis = (champ: ReglageChampPublic): boolean =>
  champ.obligatoire || TOUJOURS_REQUIS.has(champ.champ);

export const cleLibre = (id: string): string => `libre:${id}`;

export function valeursLibre(champ: ChampLibrePublic): readonly string[] {
  if (champ.type === 'OUI_NON') return ['Oui', 'Non'];
  return champ.options;
}

function champMasque(champ: string, saisie: Saisie): boolean {
  if (champ === 'whatsappE164') return saisie.whatsappStatus !== 'AUTRE_NUMERO';
  if (champ === 'dureeSystemeMois') return saisie.paymentMode !== 'ECHELONNE';
  return false;
}

const lire = (saisie: Saisie, cle: string): string => (saisie[cle] ?? '').trim();

export function champsRendus(
  champs: readonly ReglageChampPublic[],
  saisie: Saisie,
): readonly ReglageChampPublic[] {
  return champs.filter(
    (champ) => champ.visible && WIDGETS.has(champ.champ) && !champMasque(champ.champ, saisie),
  );
}

export interface SectionRendue {
  readonly titre: string;
  readonly etape: Etape;
  readonly champs: readonly ReglageChampPublic[];
}

export function grouperChamps(
  rendus: readonly ReglageChampPublic[],
  etape: Etape,
): readonly SectionRendue[] {
  return SECTIONS.filter((section) => section.etape === etape)
    .map((section) => ({
      titre: section.titre,
      etape: section.etape,
      rang: rendus.findIndex((champ) => Object.hasOwn(section.widgets, champ.champ)),
      champs: rendus.filter((champ) => Object.hasOwn(section.widgets, champ.champ)),
    }))
    .filter((section) => section.champs.length > 0)
    .sort((gauche, droite) => gauche.rang - droite.rang);
}

const REQUIS = 'À renseigner.';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const trop = (max: number): string => `Ne dépassez pas ${String(max)} caractères.`;

function formatInvalide(widget: Widget, valeur: string): string | undefined {
  if (widget.longueurMax !== undefined && valeur.length > widget.longueurMax)
    return trop(widget.longueurMax);
  if (widget.type === 'email' && !EMAIL.test(valeur)) return 'Adresse e-mail invalide.';
  if (widget.type === 'tel' && valeur.replaceAll(/\D/g, '').length < 6) return 'Numéro incomplet.';
  return undefined;
}

function erreurDuChamp(champ: ReglageChampPublic, valeur: string): string | undefined {
  const widget = widgetDe(champ.champ);
  if (widget === undefined) return undefined;
  if (valeur === '') return estRequis(champ) ? REQUIS : undefined;
  return formatInvalide(widget, valeur);
}

function erreursDesChamps(
  saisie: Saisie,
  champs: readonly ReglageChampPublic[],
  portee: Etape | 'tout',
): Record<string, string> {
  const erreurs: Record<string, string> = {};
  for (const champ of champsRendus(champs, saisie)) {
    if (portee !== 'tout' && etapeDuChamp(champ.champ) !== portee) continue;
    const probleme = erreurDuChamp(champ, lire(saisie, champ.champ));
    if (probleme !== undefined) erreurs[champ.champ] = probleme;
  }
  return erreurs;
}

function erreursDesLibres(
  saisie: Saisie,
  libres: readonly ChampLibrePublic[],
): Record<string, string> {
  const erreurs: Record<string, string> = {};
  for (const libre of libres) {
    const cle = cleLibre(libre.id);
    if (libre.obligatoire && lire(saisie, cle) === '') erreurs[cle] = REQUIS;
  }
  return erreurs;
}

/**
 * `portee` arrête la validation à l'étape en cours : sans elle, l'étape 1
 * signalerait des champs que le visiteur n'a pas encore vus.
 */
export function validerDemande(
  saisie: Saisie,
  champs: readonly ReglageChampPublic[],
  libres: readonly ChampLibrePublic[],
  portee: Etape | 'tout' = 'tout',
): Readonly<Record<string, string>> {
  const erreurs = erreursDesChamps(saisie, champs, portee);
  if (portee === 'coordonnees') return erreurs;

  Object.assign(erreurs, erreursDesLibres(saisie, libres));
  if (lire(saisie, 'message').length > MESSAGE_MAX) erreurs.message = trop(MESSAGE_MAX);
  return erreurs;
}

export interface Brouillon {
  readonly saisie: Saisie;
  readonly etape: Etape;
}

const cleBrouillon = (jeton: string): string => `cpi:demande:${jeton}`;

const ETAPES_CONNUES = new Set<string>(['coordonnees', 'complement']);

function estSaisie(charge: unknown): charge is Saisie {
  if (typeof charge !== 'object' || charge === null) return false;
  return Object.values(charge as Record<string, unknown>).every(
    (valeur) => typeof valeur === 'string',
  );
}

/**
 * Le formulaire se remplit sur un téléphone ou un poste partagé : le brouillon
 * meurt avec l'onglet. Le jeton anti-robot et le champ piège vivent dans le
 * DOM, hors de `saisie` : ils ne peuvent pas s'y glisser.
 */
export function lireBrouillon(jeton: string): Brouillon | null {
  try {
    const brut = globalThis.sessionStorage.getItem(cleBrouillon(jeton));
    if (brut === null) return null;
    const { saisie, etape } = JSON.parse(brut) as { saisie?: unknown; etape?: unknown };
    if (!estSaisie(saisie)) return null;
    if (typeof etape !== 'string' || !ETAPES_CONNUES.has(etape)) return null;
    return { saisie, etape: etape as Etape };
  } catch {
    return null;
  }
}

export function ecrireBrouillon(jeton: string, brouillon: Brouillon): void {
  try {
    globalThis.sessionStorage.setItem(cleBrouillon(jeton), JSON.stringify(brouillon));
  } catch {
    // Navigation privée ou stockage refusé : la page marche sans brouillon.
  }
}

export function effacerBrouillon(jeton: string): void {
  try {
    globalThis.sessionStorage.removeItem(cleBrouillon(jeton));
  } catch {
    // Idem : rien à rattraper, le brouillon n'a jamais été écrit.
  }
}

function valeurEnvoyee(widget: Widget, valeur: string): unknown {
  if (widget.saisie === 'ouinon') return valeur === 'oui';
  if (widget.nombre === true) return Number(valeur);
  return valeur;
}

function reponsesLibres(
  saisie: Saisie,
  libres: readonly ChampLibrePublic[],
): Record<string, string> {
  const reponses: Record<string, string> = {};
  for (const libre of libres) {
    const valeur = lire(saisie, cleLibre(libre.id));
    if (valeur !== '') reponses[libre.id] = valeur;
  }
  return reponses;
}

/**
 * `phone` distingue le numéro saisi librement de `phoneE164` que le serveur
 * normalise ; `professionId` dit que la liste est fermée, là où `profession`
 * restait du texte.
 */
const CLES_ENVOI: Readonly<Record<string, string>> = {
  phoneE164: 'phone',
  profession: 'professionId',
};

export function corpsDemande(
  saisie: Saisie,
  champs: readonly ReglageChampPublic[],
  libres: readonly ChampLibrePublic[],
): Record<string, unknown> {
  const corps: Record<string, unknown> = {};

  for (const champ of champsRendus(champs, saisie)) {
    const widget = widgetDe(champ.champ);
    const valeur = lire(saisie, champ.champ);
    if (widget === undefined || valeur === '') continue;
    corps[CLES_ENVOI[champ.champ] ?? champ.champ] = valeurEnvoyee(widget, valeur);
  }

  const reponses = reponsesLibres(saisie, libres);
  if (Object.keys(reponses).length > 0) corps.champsLibres = reponses;

  const message = lire(saisie, 'message');
  if (message !== '') corps.message = message;

  return corps;
}
