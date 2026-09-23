import { columnTitle, CONFIG, selText } from './fields';

export type Sector = 'individual' | 'informal' | 'formal' | 'collective';
export type Residence = 'local' | 'diaspora';
export type Crit = 'budget' | 'authority' | 'need' | 'timeline';
export type Classe = 'A' | 'B' | 'C' | 'D';
export type Verdict = 'ok' | 'limite' | 'ko';
export type Entry = {
  date: string;
  etape: string;
  action: string;
  commercial: string;
  note: string;
};
export type Fiche = {
  id: string;
  cree: string;
  maj: string;
  sector: Sector;
  residence: Residence;
  values: Record<string, string>;
  scores: Record<Crit, number>;
  motivations: string[];
  history: Entry[];
};
export type Lot = {
  id: string;
  programme: string;
  localite: string;
  superficie: string;
  prix: number;
  papiers: string;
  etat: string;
};

export const SECTOR_LABELS: Record<Sector, string> = {
  individual: 'Particulier',
  informal: 'Informel',
  formal: 'Entreprise / institution',
  collective: 'Groupement',
};
export const SECTOR_DESCRIPTIONS: Record<Sector, string> = {
  individual: 'Un particulier achète en son nom',
  informal: 'Commerçants, artisans, activité informelle',
  formal: 'La structure signe : convention, prélèvement, achat groupé',
  collective: 'GIE, coopératives, associations, amicales',
};
export const CLASSES: Record<Classe, { label: string; sub: Record<Sector, string> }> = {
  A: {
    label: 'À conclure',
    sub: { formal: 'Très chaud', informal: 'Prêt', individual: 'Acheteur', collective: 'Mobilisé' },
  },
  B: {
    label: 'À pousser',
    sub: {
      formal: 'Prometteur',
      informal: 'Intéressé',
      individual: 'Motivé',
      collective: 'Engagé',
    },
  },
  C: {
    label: 'À faire mûrir',
    sub: {
      formal: 'À développer',
      informal: 'Hésitant',
      individual: 'Réfléchit',
      collective: 'Divisé',
    },
  },
  D: {
    label: 'À éduquer',
    sub: {
      formal: 'Non qualifié',
      informal: 'Pas mûr',
      individual: 'Curieux',
      collective: 'Exploratoire',
    },
  },
};
export const VERDICT_LABELS: Record<Verdict, string> = {
  ok: 'Confirmée',
  limite: 'Limite',
  ko: 'Insuffisante',
};

type GridKey = 'common' | 'informal' | 'diaspora' | 'formal' | 'collective';
const GRIDS: Record<GridKey, Record<Crit, string[]>> = {
  common: {
    budget: [
      "A l'acompte 50% + peut payer 24 mois",
      'A 40-50%, négociation possible',
      'A 30-40%, doit mobiliser (tontine, vente)',
      'Moins de 30%, revenus incertains',
      "Pas d'argent disponible",
    ],
    authority: [
      'Décide seul(e), indépendant(e)',
      'Va en parler au conjoint mais peut décider',
      "Doit avoir l'accord du conjoint",
      'Doit demander père/mère/tuteur/famille',
      "La famille décide, pas d'autonomie",
    ],
    need: [
      'Besoin critique urgent (situation difficile)',
      'Besoin fort motivé (projet 6-12 mois)',
      'Besoin identifié pas urgent (futur)',
      'Envie sans besoin précis',
      'Curiosité pure, pas de projet',
    ],
    timeline: [
      'Urgence, décision sous 10 jours',
      'Court terme, sous 1 mois',
      'Moyen terme, 2-3 mois',
      'Long terme, 6-12 mois',
      'Pas de calendrier défini',
    ],
  },
  informal: {
    budget: [
      'Acompte réuni (épargne, tontine prise) + recettes régulières',
      'Tontine à prendre bientôt ou bonne saison de ventes',
      'Doit mobiliser (vente de stock, tontine lointaine)',
      "Recettes irrégulières, pas d'épargne",
      'Pas de moyens',
    ],
    authority: [
      'Patron de son affaire, décide seul(e)',
      'En parlera au conjoint mais peut décider',
      "Doit avoir l'accord du conjoint ou de l'associé",
      'La famille ou le « grand frère » doit valider',
      'Ne décide pas, simple intermédiaire',
    ],
    need: [
      'Besoin urgent (loyer, famille à loger, local)',
      "Projet concret dans l'année",
      'Projet identifié, pas urgent',
      'Envie sans projet précis',
      'Simple curiosité',
    ],
    timeline: [
      "Décide dès la prochaine rentrée d'argent (< 10 jours)",
      'Après la prochaine tontine (< 1 mois)',
      'Après la bonne saison (2-3 mois)',
      'Horizon 6-12 mois',
      'Pas de calendrier',
    ],
  },
  diaspora: {
    budget: [
      "Apport 50% disponible + revenus stables à l'étranger",
      'Épargne 40-50%, peut virer chaque mois',
      'Doit mobiliser (épargne, prêt dans son pays de résidence)',
      'Moins de 30%, revenus précaires',
      'Pas de budget',
    ],
    authority: [
      'Décide seul + mandataire avec procuration au Sénégal',
      'Décide seul, mandataire à désigner',
      'Doit consulter le conjoint (ici ou là-bas)',
      'La famille au Sénégal doit valider',
      'La famille choisit, lui ne fait que financer',
    ],
    need: [
      'Retour définitif prévu / famille à loger au Sénégal',
      'Projet concret (maison familiale, retraite, locatif)',
      'Projet à long terme, pas encore daté',
      "Envie d'avoir « quelque chose au pays »",
      'Simple curiosité',
    ],
    timeline: [
      'Décide avant ou pendant son prochain séjour (< 1 mois)',
      'Décide à distance sous 1 mois',
      'Attend ses prochaines vacances (2-3 mois)',
      'Horizon 6-12 mois',
      'Pas de calendrier',
    ],
  },
  formal: {
    budget: [
      'Budget logement validé (convention, fonds social) ou prélèvement sur salaire accepté',
      'Budget identifié, validation en cours',
      'La structure facilite (prélèvement) mais les salariés financent seuls',
      "Pas de budget, simple relais d'information",
      "Aucune capacité ni intention de s'engager",
    ],
    authority: [
      "L'interlocuteur est le décideur (DG, dirigeant)",
      'DRH / responsable social avec mandat de la direction',
      "L'interlocuteur doit convaincre sa direction",
      'Délégué du personnel / amicale, sans pouvoir de signature',
      'Contact sans rôle dans la décision',
    ],
    need: [
      'Forte demande logement des salariés, projet prioritaire',
      'Demande avérée, projet inscrit au plan social',
      'Intérêt de quelques salariés',
      'Idée à explorer',
      'Pas de besoin identifié',
    ],
    timeline: [
      'Signature de convention sous 1 mois',
      'Validation au prochain comité (1-3 mois)',
      "Inscrit au budget de l'année prochaine",
      'Horizon supérieur à 12 mois',
      'Aucun calendrier',
    ],
  },
  collective: {
    budget: [
      'Caisse pleine + accord unanime',
      'Tontine active, fonds prochains',
      'Doit mobiliser les cotisations',
      'Recherche subvention / financement',
      'Pas de fonds',
    ],
    authority: [
      'AG convoquée, tous d’accord',
      'Bureau aligné, AG prochaine',
      'Présidente favorable, membres divisés',
      'Simple membre, bureau pas informé',
      'Contact externe',
    ],
    need: [
      'Urgence collective, impacte tout le monde',
      'Besoin validé, projet prioritaire',
      'Quelques intéressés, pas de consensus',
      'Idée évoquée, pas formelle',
      'Simple curiosité',
    ],
    timeline: [
      'Décision en AG, immédiate',
      'Vote à la prochaine réunion',
      'À discuter dans 1-3 mois',
      'Long terme',
      'Pas de calendrier',
    ],
  },
};
const CRIT_NAMES: Record<Crit, string> = {
  budget: 'Budget',
  authority: 'Autorité',
  need: 'Besoin',
  timeline: 'Calendrier',
};
const CRIT_DESC: Record<Crit, string> = {
  budget: 'Capacité financière',
  authority: 'Qui décide',
  need: 'Urgence du besoin',
  timeline: 'Quand décider',
};
const CRIT_DESC_BY_GRID: Record<GridKey, Partial<Record<Crit, string>>> = {
  common: {},
  informal: {},
  diaspora: {
    budget: "Capacité financière depuis l'étranger",
    authority: 'Qui décide, qui agit sur place',
    timeline: 'Lié à son prochain séjour',
  },
  formal: {
    budget: 'Engagement financier de la structure',
    authority: "Pouvoir de décision de l'interlocuteur",
  },
  collective: { authority: 'Consensus du groupe' },
};

export const MOTIVATIONS = [
  {
    id: 'primo',
    label: 'Se loger / quitter la location',
    arg: "Comparer le loyer payé chaque mois à la mensualité CPI : il paie déjà l'équivalent pour un bien qui ne lui appartiendra jamais.",
  },
  {
    id: 'maison',
    label: 'Construire la maison familiale',
    arg: "Mettre en avant la superficie, la viabilisation et l'offre Terrain + Construction : un seul interlocuteur du terrain aux clés.",
  },
  {
    id: 'locatif',
    label: 'Investissement locatif',
    arg: 'Parler demande locative de la zone, formule studios/appartements et revenus complémentaires une fois construit.',
  },
  {
    id: 'retraite',
    label: 'Préparer la retraite',
    arg: "Acheter tant qu'il a des revenus d'activité : un logement payé avant la retraite, c'est zéro loyer après.",
  },
  {
    id: 'transmission',
    label: 'Transmettre un patrimoine',
    arg: "Le titre foncier est un patrimoine sécurisé et transmissible ; proposer d'en parler avec le notaire (acquisition au nom des enfants, indivision).",
  },
  {
    id: 'securisation',
    label: 'Profiter de son contrat',
    arg: "Utiliser la stabilité actuelle (contrat, salaire domicilié) pour obtenir un financement tant qu'il est éligible.",
  },
  {
    id: 'retour',
    label: 'Préparer le retour au pays',
    arg: "Terrain sécurisé aujourd'hui, construction suivie à distance, maison prête à l'arrivée.",
  },
  {
    id: 'placement',
    label: 'Sécuriser son épargne',
    arg: "Un foncier viabilisé avec des papiers en règle protège l'épargne mieux qu'un compte qui dort ; insister sur la sécurité juridique.",
  },
  {
    id: 'revente',
    label: 'Plus-value / revente',
    arg: "Présenter l'évolution de la zone (infrastructures à venir) et les conditions de cession prévues au contrat.",
  },
  {
    id: 'pro',
    label: 'Projet professionnel',
    arg: "Mettre en avant l'emplacement, l'accès et la possibilité d'un usage mixte (commerce au rez-de-chaussée).",
  },
  {
    id: 'flou',
    label: 'Pas de motivation claire',
    arg: 'Ne pas pousser la vente : poser des questions ouvertes pour faire émerger le besoin, puis proposer une visite de site.',
  },
];
const motivationLabel = (id: string) => MOTIVATIONS.find((m) => m.id === id)?.label ?? id;

const v = (f: Fiche, id: string) => f.values[id] ?? '';
const n = (f: Fiche, id: string) => {
  const x = parseFloat(v(f, id));
  return Number.isNaN(x) ? 0 : x;
};
const is = (f: Fiche, id: string, ...values: string[]) => values.includes(v(f, id));
const isText = (x: unknown): x is string => typeof x === 'string' && x !== '';
const grouped = (x: number) => Math.round(x).toLocaleString('fr-FR').replace(/ | /g, ' ');
export const fcfa = (x: number) => `${grouped(x)} FCFA`;
export const today = () => new Date().toISOString().slice(0, 10);
export const frDate = (d: string) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');

export function blankFiche(): Fiche {
  const now = new Date().toISOString();
  return {
    id: '',
    cree: now,
    maj: now,
    sector: 'individual',
    residence: 'local',
    values: {},
    scores: { budget: 0, authority: 0, need: 0, timeline: 0 },
    motivations: [],
    history: [],
  };
}

function gridKey(f: Fiche): GridKey {
  if (f.sector === 'collective' || f.sector === 'formal') return f.sector;
  if (f.residence === 'diaspora') return 'diaspora';
  if (f.sector === 'informal') return 'informal';
  return 'common';
}

export function criteria(f: Fiche) {
  const k = gridKey(f);
  return (['budget', 'authority', 'need', 'timeline'] as const).map((key) => ({
    key,
    name: CRIT_NAMES[key],
    max: CONFIG.POIDS[key],
    desc: CRIT_DESC_BY_GRID[k][key] ?? CRIT_DESC[key],
    options: GRIDS[k][key].map((label, i) => ({ value: 5 - i, label })),
  }));
}

function tauxDevise(f: Fiche) {
  const devise = v(f, 'devise') || 'XOF';
  if (devise === 'XOF') return 1;
  if (devise === 'EUR') return CONFIG.EUR;
  return n(f, 'taux-change') || NaN;
}
const personnesACharge = (f: Fiche) =>
  ({ '0': 0, '1-2': 2, '3-5': 4, '6+': 6 })[v(f, 'charges')] ?? 0;
const resteMin = (f: Fiche) => CONFIG.RESTE_BASE + CONFIG.RESTE_PAR_PERSONNE * personnesACharge(f);
const hasPret = (f: Fiche) => is(f, 'financement', 'accord', 'en-cours', 'envisage');
const RANK: Record<Verdict, number> = { ok: 0, limite: 1, ko: 2 };

function palier(taux: number, ok: number, limite: number): Verdict {
  if (taux <= ok) return 'ok';
  return taux <= limite ? 'limite' : 'ko';
}

function palierReste(reste: number, min: number): Verdict {
  if (reste >= min * 1.3) return 'ok';
  return reste >= min ? 'limite' : 'ko';
}

function pretBancaire(f: Fiche) {
  if (!hasPret(f) || n(f, 'pret-montant') <= 0 || n(f, 'pret-duree') <= 0)
    return { pret: 0, mensuBanque: 0 };
  const pret = n(f, 'pret-montant'),
    months = n(f, 'pret-duree') * 12,
    r = n(f, 'pret-taux') / 100 / 12;
  return { pret, mensuBanque: r > 0 ? (pret * r) / (1 - Math.pow(1 + r, -months)) : pret / months };
}

function echeancier(f: Fiche, prix: number, apport: number, pret: number) {
  if (!prix) return { acompte: 0, mensuCPI: 0, ecartApport: null as number | null };
  const acompte = prix * CONFIG.ACOMPTE,
    entree = apport + pret;
  const ecartApport = v(f, 'apport') !== '' || pret ? entree - acompte : null;
  return {
    acompte,
    ecartApport,
    mensuCPI: Math.max(0, prix - Math.max(entree, acompte)) / CONFIG.DUREE_CPI_MOIS,
  };
}

function endettement(credits: number, mensuTotal: number, revenu: number) {
  const tauxAvant = credits / revenu;
  if (mensuTotal > 0) {
    const tauxApres = (credits + mensuTotal) / revenu;
    const verdict = palier(tauxApres, CONFIG.ENDETTEMENT_OK, CONFIG.ENDETTEMENT_LIMITE);
    return {
      tauxAvant,
      tauxApres,
      verdict,
      raison: verdict === 'ok' ? '' : `endettement de ${Math.round(tauxApres * 100)} %`,
    };
  }
  const verdict = palier(tauxAvant, 0.2, CONFIG.ENDETTEMENT_OK);
  return {
    tauxAvant,
    tauxApres: null,
    verdict,
    raison: verdict === 'ok' ? '' : `endettement actuel de ${Math.round(tauxAvant * 100)} %`,
  };
}

function resteAVivre(f: Fiche, reste: number) {
  if (f.residence === 'diaspora') return { resteMin: null, verdict: 'ok' as Verdict, raison: '' };
  const min = resteMin(f);
  const verdict = palierReste(reste, min);
  return {
    resteMin: min,
    verdict,
    raison:
      verdict === 'ok' ? '' : `reste à vivre de ${fcfa(reste)} (minimum conseillé ${fcfa(min)})`,
  };
}

export type Capacite = ReturnType<typeof capacite>;
export function capacite(f: Fiche) {
  const empty = {
    applicable: f.sector !== 'formal',
    tauxManquant: false,
    revenu: 0,
    credits: 0,
    loyer: 0,
    transferts: 0,
    prix: n(f, 'prix-lot'),
    apport: n(f, 'apport'),
    pret: 0,
    mensuBanque: 0,
    acompte: 0,
    mensuCPI: 0,
    mensuTotal: 0,
    tauxAvant: null as number | null,
    tauxApres: null as number | null,
    reste: null as number | null,
    resteMin: null as number | null,
    verdict: null as Verdict | null,
    raisons: [] as string[],
    ecartApport: null as number | null,
  };
  if (!empty.applicable) return empty;
  const rate = tauxDevise(f);
  if (Number.isNaN(rate)) return { ...empty, tauxManquant: true };
  const pret = pretBancaire(f);
  const plan = echeancier(f, empty.prix, empty.apport, pret.pret);
  const res = {
    ...empty,
    ...pret,
    ...plan,
    revenu: n(f, 'revenu') * rate,
    credits: is(f, 'credit-en-cours', 'oui') ? n(f, 'mensualites') * rate : 0,
    loyer: is(f, 'logement', 'locataire') ? n(f, 'loyer') * rate : 0,
    transferts: n(f, 'transferts') * rate,
    mensuTotal: plan.mensuCPI + pret.mensuBanque,
  };
  if (res.revenu <= 0) return res;
  const dette = endettement(res.credits, res.mensuTotal, res.revenu);
  const reste = res.revenu - res.credits - res.loyer - res.transferts - res.mensuTotal;
  const vie = resteAVivre(f, reste);
  const verdict = RANK[vie.verdict] > RANK[dette.verdict] ? vie.verdict : dette.verdict;
  return {
    ...res,
    tauxAvant: dette.tauxAvant,
    tauxApres: dette.tauxApres,
    reste,
    resteMin: vie.resteMin,
    verdict,
    raisons: [dette.raison, vie.raison].filter(isText),
  };
}

export function budgetConseille(
  f: Fiche,
  c = capacite(f),
): { max: number; limite: 'revenu' | 'apport' } | null {
  if (!c.applicable) return null;
  let mensuMax = Infinity;
  if (c.revenu > 0) {
    mensuMax = CONFIG.ENDETTEMENT_OK * c.revenu - c.credits - c.mensuBanque;
    if (f.residence !== 'diaspora')
      mensuMax = Math.min(
        mensuMax,
        c.revenu - c.credits - c.loyer - c.transferts - c.mensuBanque - resteMin(f) * 1.3,
      );
    mensuMax = Math.max(0, mensuMax);
  }
  const capRev = Number.isFinite(mensuMax)
    ? (mensuMax * CONFIG.DUREE_CPI_MOIS) / (1 - CONFIG.ACOMPTE)
    : Infinity;
  const capApp = v(f, 'apport') !== '' || c.pret ? (c.apport + c.pret) / CONFIG.ACOMPTE : Infinity;
  const max = Math.min(capRev, capApp);
  if (!Number.isFinite(max)) return null;
  return { max: Math.floor(max / 250000) * 250000, limite: capRev <= capApp ? 'revenu' : 'apport' };
}

const ENGAGEMENT_ETAPE: Record<string, number> = {
  contacte: 2,
  rdv: 5,
  visite: 8,
  proposition: 10,
  negociation: 13,
  reservation: 15,
};
const ENGAGEMENT_SITE: Record<string, number> = { 'oui-plusieurs': 8, 'oui-un': 6 };
const ENGAGEMENT_AGENCE: Record<string, number> = { 'oui-plusieurs': 5, 'oui-une-fois': 3 };
const ENGAGEMENT_TERRAIN: Record<string, number> = { personne: 8, video: 6, proche: 3 };

function engagementPts(f: Fiche) {
  const terrain = f.residence === 'diaspora' ? (ENGAGEMENT_TERRAIN[v(f, 'vu-terrain')] ?? 0) : 0;
  const client = is(f, 'deja-client', 'oui') ? 8 : 0;
  const best = Math.max(
    ENGAGEMENT_ETAPE[v(f, 'etape')] ?? 0,
    ENGAGEMENT_SITE[v(f, 'visite-site')] ?? 0,
    ENGAGEMENT_AGENCE[v(f, 'visite-cpi')] ?? 0,
    terrain,
    client,
  );
  return Math.min(CONFIG.POIDS.engagement, best);
}

function capBudget(points: number, verdict: Verdict | null) {
  if (verdict === 'ko' && points > 12)
    return { points: 12, cap: 'Budget plafonné : capacité de paiement insuffisante' };
  if (verdict === 'limite' && points > 24)
    return { points: 24, cap: 'Budget plafonné : capacité de paiement limite' };
  return { points, cap: '' };
}

function classeOf(total: number): Classe {
  const S = CONFIG.SEUILS_CLASSES;
  if (total >= S.A) return 'A';
  if (total >= S.B) return 'B';
  return total >= S.C ? 'C' : 'D';
}

function reglesEliminatoires(f: Fiche, verdict: Verdict | null) {
  const caps: string[] = [];
  let plafond: Classe = 'A';
  if (f.scores.budget === 1 || verdict === 'ko') {
    plafond = 'C';
    caps.push(
      `Règle éliminatoire : ${f.scores.budget === 1 ? 'budget noté 1' : 'capacité insuffisante'}, classe C au mieux`,
    );
  }
  if (f.scores.authority === 1) {
    plafond = 'C';
    caps.push('Règle éliminatoire : autorité notée 1, classe C au mieux');
  }
  if (is(f, 'etape', 'perdu')) {
    plafond = 'D';
    caps.push(`Prospect perdu${v(f, 'motif-perte') ? ` : ${selText(f, 'motif-perte')}` : ''}`);
  }
  return { plafond, caps };
}

export type Score = ReturnType<typeof computeScore>;
export function computeScore(f: Fiche) {
  const P = CONFIG.POIDS,
    cap = capacite(f),
    s = f.scores;
  const budget = capBudget((s.budget * P.budget) / 5, cap.verdict);
  const pts = {
    budget: budget.points,
    authority: (s.authority * P.authority) / 5,
    need: (s.need * P.need) / 5,
    timeline: (s.timeline * P.timeline) / 5,
    engagement: engagementPts(f),
  };
  const total = Math.round(Object.values(pts).reduce((a, b) => a + b, 0));
  const regles = reglesEliminatoires(f, cap.verdict);
  const classe = [classeOf(total), regles.plafond].toSorted().at(-1) as Classe;
  const manquants = (['budget', 'authority', 'need', 'timeline'] as const).filter(
    (k) => !s[k],
  ).length;
  return {
    pts,
    total,
    classe,
    caps: [budget.cap, ...regles.caps].filter(isText),
    manquants,
    incoherent: cap.verdict === 'ko' && s.budget >= 4,
    cap,
  };
}

const BUDGET_CONSEIL: Record<Verdict, string> = { ok: '4 ou 5', limite: '3', ko: '1 ou 2' };
const CAPACITE_TEXTE: Record<Verdict, string> = {
  ok: 'capacité confirmée',
  limite: 'capacité limite',
  ko: 'capacité insuffisante',
};
export function budgetHint(f: Fiche, c: Capacite) {
  if (!c.verdict)
    return f.sector === 'formal'
      ? null
      : {
          warn: false,
          text: 'Renseigner revenus et prix du lot (Découverte) pour guider la note.',
        };
  const warn =
    (c.verdict === 'ko' && f.scores.budget >= 3) ||
    (c.verdict === 'limite' && f.scores.budget >= 5);
  return {
    warn,
    text: `Simulation : ${CAPACITE_TEXTE[c.verdict]}, note conseillée ${BUDGET_CONSEIL[c.verdict]}${warn ? '. La note choisie est incohérente avec la simulation.' : ''}`,
  };
}

export type Niveau = 'forte' | 'moyenne' | 'faible' | 'na';
export type Check = { state: 'ok' | 'partial' | 'ko' | 'info'; text: string };
type Critere = { ok: boolean; partial: boolean; text: string } | null;

function critereLocalite(f: Fiche): Critere {
  const souhait = v(f, 'localite-souhaitee'),
    lot = v(f, 'lot-localite');
  if (!souhait || !lot) return null;
  return {
    ok: souhait === 'Indifférent' || souhait === lot,
    partial: false,
    text: `Localité : souhaitée ${souhait}, lot à ${lot}`,
  };
}
function critereSuperficie(f: Fiche): Critere {
  const souhait = v(f, 'superficie'),
    lot = v(f, 'lot-superficie');
  if (!souhait || !lot) return null;
  const i = CONFIG.SUPERFICIES.indexOf(souhait as never),
    j = CONFIG.SUPERFICIES.indexOf(lot as never);
  return {
    ok: i === j,
    partial: Math.abs(i - j) === 1,
    text: `Superficie : souhaitée ${souhait}, lot de ${lot}`,
  };
}
function criterePapiers(f: Fiche): Critere {
  const exigence = v(f, 'exigence-papiers'),
    nature = v(f, 'nature-foncier');
  if (!exigence || !nature) return null;
  const ok =
    exigence === 'indifferent' ||
    (exigence === 'tf' && nature === 'titre-foncier') ||
    (exigence === 'bail' && nature !== 'notification-bail');
  return {
    ok,
    partial: exigence === 'bail' && nature === 'notification-bail',
    text: `Papiers : ${selText(f, 'exigence-papiers').toLowerCase()}, lot en ${selText(f, 'nature-foncier').toLowerCase()}`,
  };
}
function critereBudget(f: Fiche, c: Capacite): Critere {
  const bud = budgetConseille(f, c),
    prix = n(f, 'prix-lot');
  if (!bud || !prix) return null;
  return {
    ok: prix <= bud.max,
    partial: prix <= bud.max * 1.1,
    text: `Budget : lot à ${fcfa(prix)}, budget conseillé ${fcfa(bud.max)}`,
  };
}
const checkState = (x: NonNullable<Critere>): Check['state'] => {
  if (x.ok) return 'ok';
  return x.partial ? 'partial' : 'ko';
};
function niveauOf(ratio: number): Niveau {
  if (ratio >= 0.8) return 'forte';
  return ratio >= 0.5 ? 'moyenne' : 'faible';
}

export function adequation(
  f: Fiche,
  c = capacite(f),
): { niveau: Niveau; label: string; items: Check[] } {
  const criteres = [
    critereLocalite(f),
    critereSuperficie(f),
    criterePapiers(f),
    critereBudget(f, c),
  ].filter((x) => x !== null);
  const items: Check[] = criteres.map((x) => ({ state: checkState(x), text: x.text }));
  if (v(f, 'etat-site'))
    items.push({ state: 'info', text: `État du site : ${selText(f, 'etat-site')}` });
  if (!criteres.length)
    return {
      niveau: 'na',
      label: 'À évaluer',
      items: items.length
        ? items
        : [
            {
              state: 'info',
              text: 'Renseigner le projet recherché (Premier contact) et le lot proposé (Closing).',
            },
          ],
    };
  const score = criteres.reduce((sum, x) => sum + (x.ok ? 1 : Number(x.partial) / 2), 0);
  const niveau = niveauOf(score / criteres.length);
  return { niveau, label: `Adéquation ${niveau}`, items };
}

export function simulationRows(f: Fiche, c: Capacite): [string, string][] {
  const bud = budgetConseille(f, c);
  const rows: [unknown, string, string][] = [
    [c.revenu, 'Revenu mensuel', fcfa(c.revenu)],
    [c.credits, 'Crédits en cours / mois', fcfa(c.credits)],
    [c.loyer, 'Loyer / mois', fcfa(c.loyer)],
    [c.transferts, 'Aide familiale / mois', fcfa(c.transferts)],
    [c.prix, `Acompte ${CONFIG.ACOMPTE * 100} %`, fcfa(c.acompte)],
    [c.prix, `Mensualité CPI (${CONFIG.DUREE_CPI_MOIS} mois)`, fcfa(c.mensuCPI)],
    [c.mensuBanque, 'Mensualité banque', fcfa(c.mensuBanque)],
    [
      c.ecartApport !== null,
      (c.ecartApport ?? 0) >= 0 ? 'Apport : excédent' : 'Apport : manque',
      fcfa(Math.abs(c.ecartApport ?? 0)),
    ],
    [c.tauxApres !== null, "Endettement avec l'achat", `${Math.round((c.tauxApres ?? 0) * 100)} %`],
    [
      c.tauxApres === null && c.tauxAvant !== null,
      'Endettement actuel',
      `${Math.round((c.tauxAvant ?? 0) * 100)} %`,
    ],
    [c.reste !== null, 'Reste à vivre / mois', fcfa(c.reste ?? 0)],
    [bud, 'Budget lot conseillé', fcfa(bud?.max ?? 0)],
  ];
  return rows.filter(([shown]) => shown).map(([, label, value]) => [label, value]);
}

export function verdictText(c: Capacite) {
  if (!c.verdict) return null;
  if (c.verdict === 'ok') return 'Capacité confirmée.';
  const raisons = c.raisons.join(', ');
  return c.verdict === 'limite'
    ? `Capacité limite : ${raisons}. À vérifier avec lui.`
    : `Capacité insuffisante : ${raisons}. Risque d'impayés.`;
}

export function calendarAlerts(f: Fiche): { type: 'warn' | 'good'; text: string }[] {
  const d = v(f, 'date-relance');
  if (!d) return [];
  const out: { type: 'warn' | 'good'; text: string }[] = [];
  if (d < today()) out.push({ type: 'warn', text: 'Cette date de relance est déjà passée.' });
  const derniere = CONFIG.PERIODES.reduce((m, p) => (p.fin > m ? p.fin : m), '');
  if (d > derniere)
    out.push({
      type: 'warn',
      text: `Calendrier des fêtes à mettre à jour (dates connues jusqu'au ${frDate(derniere)}).`,
    });
  for (const p of CONFIG.PERIODES.filter((x) => d >= x.debut && d <= x.fin)) {
    if (p.type === 'warn')
      out.push({
        type: 'warn',
        text: `Période ${p.nom} : trésorerie des ménages tendue. Éviter de relancer pour un acompte ; privilégier un simple suivi.`,
      });
    else if (f.residence === 'diaspora')
      out.push({
        type: 'good',
        text: `${p.nom} : bon moment pour un RDV en personne et une visite de site.`,
      });
  }
  return out;
}

export function missingFields(f: Fiche) {
  const req: [string, string][] = [
    ['prospect-name', 'nom'],
    ['telephone', 'téléphone'],
    ['etape', 'étape'],
  ];
  if (f.sector !== 'collective') req.push(['secteur-activite', 'secteur']);
  if (is(f, 'etape', 'perdu')) req.push(['motif-perte', 'motif de perte']);
  else if (!is(f, 'etape', 'reservation'))
    req.push(['prochaine-action', 'prochaine action'], ['date-relance', 'date de relance']);
  const out = req.filter(([id]) => !v(f, id)).map(([id, label]) => ({ id, label }));
  if (f.sector !== 'formal' && !f.motivations.length)
    out.push({ id: 'motivations', label: 'motivation' });
  return out;
}

type Rule<T> = readonly [when: (x: T) => boolean, text: string | ((x: T) => string)];
const applyRules = <T>(rules: readonly Rule<T>[], x: T) =>
  rules.filter(([when]) => when(x)).map(([, text]) => (typeof text === 'string' ? text : text(x)));

type Ctx = {
  f: Fiche;
  s: Score;
  a: ReturnType<typeof adequation>;
  c: Capacite;
  dias: boolean;
  is: (id: string, ...values: string[]) => boolean;
  low: (k: Crit) => boolean;
};

const BANT_RULES: Record<GridKey, readonly Rule<Ctx>[]> = {
  collective: [
    [(x) => x.low('budget'), 'Explorer tontine, cotisations exceptionnelles, subventions'],
    [(x) => x.low('authority'), "Obtenir une présentation devant le bureau puis l'AG"],
    [
      (x) => x.low('need'),
      "Montrer l'impact collectif (logement des membres, patrimoine du groupement)",
    ],
    [(x) => x.low('timeline'), 'Caler la proposition sur le cycle de cotisation'],
  ],
  formal: [
    [
      (x) => x.low('budget'),
      'Proposer une formule sans coût pour la structure : convention + prélèvement sur salaire',
    ],
    [
      (x) => x.low('authority') || x.is('fonction-interlocuteur', 'delegue', 'autre'),
      "Obtenir un RDV avec le DG ou le DRH, avec l'appui de l'interlocuteur actuel",
    ],
    [
      (x) => x.low('need'),
      'Proposer un court sondage logement auprès des salariés pour mesurer la demande',
    ],
    [
      (x) => x.low('timeline') || x.is('cycle', 'conseil'),
      'Préparer le dossier pour le prochain comité ou le budget annuel',
    ],
    [
      (x) => x.is('modalite', 'convention', 'prelevement'),
      'Envoyer un projet de convention avec prix de groupe et modalités de prélèvement',
    ],
    [
      (x) => n(x.f, 'salaries-concernes') >= 20 || x.is('effectif', '200-1000', 'plus-1000'),
      'Organiser une présentation collective sur le lieu de travail',
    ],
  ],
  diaspora: [
    [(x) => x.low('budget'), 'Proposer un échéancier par virements mensuels sur 24 mois'],
    [
      (x) => x.low('authority'),
      'Associer la famille au Sénégal : RDV agence avec le proche qui valide',
    ],
    [(x) => x.low('need'), 'Faire préciser le projet : retour, retraite, locatif ?'],
    [(x) => x.low('timeline'), 'Fixer une échéance liée à son prochain séjour'],
  ],
  common: [],
  informal: [],
};
BANT_RULES.common = [
  [
    (x) => x.low('budget'),
    (x) =>
      x.f.sector === 'informal'
        ? "Caler l'acompte sur la tontine ou la bonne saison ; échéancier Wave/OM"
        : 'Étudier un échéancier adapté (Wave/OM) ou un lot plus petit',
  ],
  [(x) => x.low('authority'), 'Inviter le conjoint ou la famille qui décide au prochain RDV'],
  [(x) => x.low('need'), 'Faire émerger un bénéfice concret (loyer économisé, patrimoine)'],
  [
    (x) => x.low('timeline'),
    'Trouver un événement déclencheur daté (fin de bail, tontine, rentrée)',
  ],
];
BANT_RULES.informal = BANT_RULES.common;

const stableJob = (x: Ctx) => x.is('statut-pro', 'fonctionnaire', 'cdi');
const creditOui = (x: Ctx) => x.is('credit-en-cours', 'oui');
const FINANCE_RULES: readonly Rule<Ctx>[] = [
  [
    (x) => x.is('banque', 'aucun', 'mobile'),
    "Non bancarisé : échéancier Wave/OM avec reçu CPI, conseiller l'ouverture d'un compte",
  ],
  [
    (x) => stableJob(x) && x.is('financement', 'envisage', ''),
    'Salarié stable : proposer un montage de crédit immobilier avec sa banque',
  ],
  [
    (x) => x.is('financement', 'en-cours', 'accord'),
    'Préparer attestation de réservation / promesse de vente pour la banque',
  ],
  [
    (x) => x.is('financement', 'refuse'),
    'Crédit refusé : proposer paiement échelonné ou lot plus petit',
  ],
  [
    (x) => hasPret(x.f) && !x.c.mensuBanque,
    'Renseigner montant, durée et taux du prêt pour une simulation juste',
  ],
  [
    (x) => creditOui(x) && x.is('fin-credit', 'moins-6', '6-12'),
    'Crédit bientôt soldé : planifier la relance à cette date, sa capacité va se libérer',
  ],
  [
    (x) => creditOui(x) && x.is('type-credit', 'immobilier'),
    'Crédit immobilier en cours : vérifier si sa banque accepte un 2e crédit ou un rachat',
  ],
  [
    (x) => creditOui(x) && !n(x.f, 'mensualites'),
    'Demander le montant total des mensualités en cours',
  ],
  [
    (x) => x.c.verdict === 'ko',
    "Capacité insuffisante : proposer un lot plus petit, un apport plus fort, ou attendre la fin d'un crédit",
  ],
  [
    (x) => x.c.verdict === 'limite',
    'Capacité limite : vérifier le budget réel (dépenses familiales, cérémonies) avant de signer',
  ],
  [
    (x) => x.is('regularite', 'variable'),
    'Revenus variables : raisonner sur la moyenne de 6 mois et demander relevés bancaires ou Wave/OM',
  ],
  [
    (x) => x.is('informel-credit', 'tontine'),
    "Tontine : caler l'acompte sur la date où il « prend » la tontine",
  ],
  [
    (x) => (x.c.ecartApport ?? 0) < 0,
    (x) =>
      `Il manque ${fcfa(-(x.c.ecartApport ?? 0))} pour l'acompte : échelonner l'acompte ou viser un lot moins cher`,
  ],
  [
    (x) => !!x.c.loyer && !!x.c.mensuCPI,
    (x) =>
      `Loyer ${fcfa(x.c.loyer)} et mensualité CPI ${fcfa(x.c.mensuCPI)} se cumulent pendant ${CONFIG.DUREE_CPI_MOIS} mois : le vérifier avec lui`,
  ],
  [
    (x) => x.is('age', 'plus-60') && x.is('financement', 'envisage', 'en-cours'),
    "Plus de 60 ans : durée de crédit courte, privilégier l'apport ou l'échéancier CPI",
  ],
  [
    (x) => x.is('age', '50-60') && stableJob(x),
    "Proche de la retraite : utiliser sa capacité d'emprunt avant la fin d'activité",
  ],
  [
    (x) => x.is('deja-proprio', 'bien'),
    "Déjà propriétaire : positionner l'offre comme investissement (locatif, patrimoine)",
  ],
  [
    (x) => x.is('matrimonial', 'marie') && x.f.scores.authority > 0 && x.f.scores.authority <= 3,
    'Inviter le conjoint au prochain RDV ou à la visite',
  ],
  [(x) => x.is('credit-en-cours', ''), "Demander s'il a un crédit en cours"],
  [(x) => x.is('banque', ''), 'Demander la banque du prospect'],
];

const FREINS: Record<string, string> = {
  prix: 'Frein prix : comparer au m² avec la zone et rappeler ce qui est inclus (viabilisation, papiers)',
  acompte: 'Frein acompte : étudier un acompte en 2 ou 3 versements',
  confiance: 'Frein confiance : montrer un programme livré, les papiers et des témoignages clients',
  zone: "Frein zone : présenter les projets d'accès et de services à venir, organiser la visite",
  papiers:
    'Frein papiers : expliquer TF / bail / notification et proposer la vérification par son notaire',
  famille: 'Frein famille : organiser une visite de site en famille',
};
const closing = (x: Ctx) => x.is('etape', 'negociation', 'reservation');
const client = (x: Ctx) => x.is('deja-client', 'oui');
const GENERAL_RULES: readonly Rule<Ctx>[] = [
  [
    (x) => x.a.niveau === 'faible',
    'Adéquation faible : proposer un autre lot du catalogue, plus proche de ses attentes',
  ],
  [
    (x) =>
      ['revenu', 'mensualites', 'apport', 'transferts'].some((id) => v(x.f, id) !== '') &&
      x.is('consent-date', ''),
    'Recueillir le consentement du prospect avant de conserver ses données financières',
  ],
  [
    (x) => !x.is('acquereur', '', 'lui'),
    "Bien au nom d'un tiers : pièces d'identité du titulaire et accord écrit de sa part",
  ],
  [
    (x) => x.is('acquereur', 'famille'),
    'Co-acquisition familiale : fixer par écrit, chez le notaire, la part de chacun',
  ],
  [
    (x) => x.is('acquereur', 'proche') && x.dias,
    "Diaspora, bien au nom d'un proche : risque de litige. Conseiller l'achat à son propre nom avec une procuration",
  ],
  [
    (x) => x.is('acquereur', 'enfant'),
    "Au nom d'enfants : si mineurs, vérifier avec le notaire (représentation légale)",
  ],
  [
    (x) => closing(x) && x.is('piece', '', 'non'),
    "Vérifier et copier la pièce d'identité avant tout encaissement",
  ],
  [
    (x) => closing(x) && !x.is('origine-justifiee', 'oui'),
    (x) =>
      `Obtenir un justificatif de l'origine des fonds${x.dias ? " (bulletins de salaire, avis d'imposition)" : ''}`,
  ],
  [
    (x) => x.is('mode-paiement', 'especes'),
    "Paiement en espèces : l'orienter vers un versement bancaire sur le compte CPI ; sinon justificatif d'origine des fonds obligatoire",
  ],
  [
    (x) => x.is('ppe', 'oui'),
    'Personne politiquement exposée : vigilance renforcée, validation par la direction avant signature',
  ],
  [
    (x) => x.is('ppe', 'verifier'),
    'Vérifier si le prospect est une personne politiquement exposée',
  ],
  [
    (x) => client(x) && x.is('satisfaction', 'insatisfait', 'mitige'),
    'Client insatisfait : remonter à la direction et régler le problème avant toute nouvelle vente',
  ],
  [
    (x) => client(x) && x.is('satisfaction', 'tres', 'satisfait') && !x.is('recommande', 'non'),
    "Client satisfait : lui demander 2 ou 3 contacts et l'inscrire comme parrain",
  ],
  [
    (x) => client(x) && x.is('satisfaction', ''),
    "Demander au client s'il est satisfait de son premier achat",
  ],
  [(x) => v(x.f, 'frein') in FREINS, (x) => FREINS[v(x.f, 'frein')] ?? ''],
  [
    (x) => x.is('concurrence', 'plusieurs'),
    'Il compare : fiche comparative CPI vs concurrents (papiers, viabilisation, délais) et relance rapide',
  ],
  [(x) => x.is('langue', ''), "Noter la langue dans laquelle il est le plus à l'aise"],
];
const INCOHERENCE: Rule<Ctx> = [
  (x) => x.s.incoherent,
  'Incohérence : budget noté 4 ou 5 alors que la simulation montre une capacité insuffisante. Revoir la note.',
];

export function recommendations(f: Fiche, s: Score, a: ReturnType<typeof adequation>) {
  const k = gridKey(f);
  const ctx: Ctx = {
    f,
    s,
    a,
    c: s.cap,
    dias: f.residence === 'diaspora',
    is: (id, ...values) => is(f, id, ...values),
    low: (key) => f.scores[key] > 0 && f.scores[key] <= 2,
  };
  const rules = [
    INCOHERENCE,
    ...BANT_RULES[k],
    ...(k === 'formal' ? [] : FINANCE_RULES),
    ...GENERAL_RULES,
  ];
  return applyRules(rules, ctx);
}

export function argumentaire(f: Fiche) {
  if (f.sector === 'formal') return [];
  return f.motivations.map((id, i) => ({
    main: i === 0,
    text: MOTIVATIONS.find((m) => m.id === id)?.arg ?? '',
  }));
}

const DIASPORA_RULES: readonly Rule<Fiche>[] = [
  [
    () => true,
    'Rappeler dès le 1er échange : tout paiement se fait uniquement sur le compte bancaire de CPI, jamais à un intermédiaire, avec un reçu à chaque versement.',
  ],
  [
    () => true,
    (f) =>
      `Appeler aux heures qui l'arrangent${v(f, 'pays') ? ` (décalage horaire ${v(f, 'pays')})` : ''} ; messages vocaux WhatsApp en priorité.`,
  ],
  [
    (f) => is(f, 'mandataire', 'aucun', ''),
    'Proposer une procuration notariée (notaire ou consulat) pour signer et suivre le dossier en son absence.',
  ],
  [
    (f) => is(f, 'mandataire', 'proche'),
    "Le proche n'a pas de procuration : l'inviter à en établir une avant la signature.",
  ],
  [
    (f) => is(f, 'vu-terrain', 'non', 'proche', ''),
    'Organiser une visite du site en vidéo WhatsApp en direct (bornes, voisinage, accès).',
  ],
  [
    (f) => is(f, 'sejour', 'sur-place', 'moins-1-mois'),
    'Il est (bientôt) au Sénégal : bloquer RDV agence + visite + signature pendant le séjour.',
  ],
  [
    (f) => is(f, 'sejour', '1-3-mois', '3-6-mois'),
    'Préparer tout le dossier à distance pour signer lors de son prochain séjour.',
  ],
  [
    (f) => is(f, 'paiement-diaspora', 'transfert', 'famille'),
    'Orienter vers un virement bancaire direct au compte CPI : traçable et sécurisant pour lui.',
  ],
  [
    (f) => is(f, 'inquietude', 'arnaque', 'papiers'),
    'Envoyer copie du titre / état des droits réels et proposer une vérification par son notaire.',
  ],
  [
    (f) => is(f, 'inquietude', 'argent'),
    'Envoyer relevé des versements et reçus CPI à chaque paiement.',
  ],
  [
    (f) => is(f, 'inquietude', 'chantier'),
    "S'engager sur un reporting photo/vidéo mensuel du chantier.",
  ],
  [(f) => is(f, 'inquietude', 'prix'), 'Donner une comparaison chiffrée avec les prix de la zone.'],
  [
    () => true,
    "Préparer les justificatifs d'origine des fonds (bulletins de salaire, avis d'imposition) pour le closing.",
  ],
  [() => true, 'Proposer des références de clients diaspora déjà livrés.'],
];
export const diasporaProtocol = (f: Fiche) =>
  f.residence === 'diaspora' ? applyRules(DIASPORA_RULES, f) : [];

type LineCtx = { f: Fiche; s: Score; a: ReturnType<typeof adequation> };
const sel = (id: string) => (x: LineCtx) => selText(x.f, id);
const suffix = (x: LineCtx, id: string, format: (value: string) => string) =>
  v(x.f, id) ? format(v(x.f, id)) : '';
const onlyFor = (when: (f: Fiche) => boolean, id: string) => (x: LineCtx) =>
  when(x.f) ? selText(x.f, id) : '';
const formal = (f: Fiche) => f.sector === 'formal';
const diaspora = (f: Fiche) => f.residence === 'diaspora';
const COMPANY_TITLE: Partial<Record<Sector, string>> = {
  formal: 'Structure',
  collective: 'Groupement',
};

const FICHE_LINES: readonly [
  label: string | ((x: LineCtx) => string),
  value: (x: LineCtx) => string,
][] = [
  [
    'Contact',
    (x) => (v(x.f, 'prospect-name') || 'Non renseigné') + suffix(x, 'telephone', (t) => ` - ${t}`),
  ],
  [(x) => COMPANY_TITLE[x.f.sector] ?? 'Entreprise', (x) => v(x.f, 'company')],
  [
    'Type',
    (x) =>
      SECTOR_LABELS[x.f.sector] +
      (diaspora(x.f) ? ` - Diaspora${suffix(x, 'pays', (p) => ` (${p})`)}` : ''),
  ],
  ['Classe', (x) => `${x.s.classe} - ${CLASSES[x.s.classe].label} (score ${x.s.total}/100)`],
  ['Adéquation offre', (x) => x.a.label],
  ['Rôle', sel('role-groupement')],
  ['Secteur', sel('secteur-activite')],
  ['Statut pro', sel('statut-pro')],
  [
    'Étape',
    (x) =>
      v(x.f, 'etape')
        ? selText(x.f, 'etape') +
          suffix(x, 'motif-perte', () => ` - ${selText(x.f, 'motif-perte')}`)
        : '',
  ],
  ['Canal', sel('canal')],
  [
    'Langue',
    (x) =>
      v(x.f, 'langue')
        ? v(x.f, 'langue') +
          suffix(x, 'moment', () => `, joignable ${selText(x.f, 'moment').toLowerCase()}`)
        : '',
  ],
  ['Type de structure', onlyFor(formal, 'type-structure')],
  ['Effectif', onlyFor(formal, 'effectif')],
  ['Salariés intéressés', onlyFor(formal, 'salaries-concernes')],
  ['Interlocuteur', onlyFor(formal, 'fonction-interlocuteur')],
  ['Modalité', onlyFor(formal, 'modalite')],
  ['Validation', onlyFor(formal, 'cycle')],
  ['Motivation', (x) => x.f.motivations.map(motivationLabel).join(' / ')],
  ['Localité souhaitée', sel('localite-souhaitee')],
  ['Superficie souhaitée', sel('superficie')],
  ['Revenu', (x) => (x.s.cap.revenu ? fcfa(x.s.cap.revenu) : '')],
  ['Crédit en cours', creditLine],
  [
    'Lot envisagé',
    (x) => (x.s.cap.prix ? fcfa(x.s.cap.prix) + suffix(x, 'lot-localite', (l) => ` - ${l}`) : ''),
  ],
  [
    'Apport',
    (x) =>
      v(x.f, 'apport')
        ? fcfa(n(x.f, 'apport')) +
          suffix(x, 'origine-apport', () => ` (${selText(x.f, 'origine-apport')})`)
        : '',
  ],
  ['Capacité', (x) => (x.s.cap.verdict ? VERDICT_LABELS[x.s.cap.verdict] : '')],
  ['Banque', sel('banque')],
  ['Financement', sel('financement')],
  ['Représentant', onlyFor(diaspora, 'mandataire')],
  ['Prochain séjour', onlyFor(diaspora, 'sejour')],
  ['Inquiétude', onlyFor(diaspora, 'inquietude')],
  [
    'Acquéreur au titre',
    (x) =>
      v(x.f, 'acquereur')
        ? selText(x.f, 'acquereur') + suffix(x, 'titulaire', (t) => ` - ${t}`)
        : '',
  ],
  ['Frein', sel('frein')],
  ['Concurrence', sel('concurrence')],
  ['Parrain', sel('parrain')],
  ['Conseiller', sel('commercial')],
  [
    'Prochaine action',
    (x) =>
      v(x.f, 'prochaine-action')
        ? selText(x.f, 'prochaine-action') + suffix(x, 'date-relance', (d) => ` le ${frDate(d)}`)
        : '',
  ],
  [
    'Consentement',
    (x) => (v(x.f, 'consent-date') ? `Oui (${frDate(v(x.f, 'consent-date'))})` : 'Non'),
  ],
];

function creditLine(x: LineCtx) {
  if (!v(x.f, 'credit-en-cours')) return '';
  if (!is(x.f, 'credit-en-cours', 'oui')) return 'Non';
  const mensuel = x.s.cap.credits ? `, ${fcfa(x.s.cap.credits)}/mois` : '';
  return `Oui${suffix(x, 'type-credit', () => ` - ${selText(x.f, 'type-credit')}`)}${mensuel}`;
}

export function ficheLines(
  f: Fiche,
  s = computeScore(f),
  a = adequation(f, s.cap),
): [string, string][] {
  const x = { f, s, a };
  return FICHE_LINES.map(([label, value]): [string, string] => [
    typeof label === 'string' ? label : label(x),
    value(x),
  ]).filter(([, value]) => value !== '');
}

export const ficheText = (f: Fiche) =>
  `*Fiche BANT CPI (interne)*\n${ficheLines(f)
    .map(([k, x]) => `${k} : ${x}`)
    .join('\n')}`;

const PAPIERS_BILAN: Record<string, string> = {
  'titre-foncier': 'titre foncier',
  bail: 'bail',
  'notification-bail': 'notification de bail',
};
const ACTIONS_BILAN: Record<string, string> = {
  appel: 'Je vous rappelle',
  rdv: 'Rendez-vous à notre agence',
  visite: 'Visite du terrain',
  video: 'Visite du terrain en vidéo',
  proposition: 'Envoi de votre proposition détaillée',
  banque: 'Point avec votre banque',
  signature: "Signature et versement de l'acompte",
};
const block = (title: string, lines: string[]) => (lines.length ? [title, ...lines, ''] : []);
type Budget = ReturnType<typeof budgetConseille>;

function bilanStructure(f: Fiche) {
  const projet = [
    v(f, 'company') && `• Structure : ${v(f, 'company')}`,
    v(f, 'salaries-concernes') &&
      `• Salariés potentiellement intéressés : ${v(f, 'salaries-concernes')}`,
    v(f, 'modalite') && `• Formule envisagée : ${selText(f, 'modalite')}`,
    v(f, 'localite-souhaitee') && `• Localité souhaitée : ${v(f, 'localite-souhaitee')}`,
  ].filter(isText);
  return [
    ...block('*Le projet*', projet),
    '*Ce que CPI propose*',
    '• Un prix de groupe et des conditions de paiement adaptées aux salariés',
    '• Une présentation sur site pour les salariés intéressés',
    "• Un accompagnement de chaque acquéreur jusqu'à la remise des papiers",
    '',
  ];
}

function bilanProjet(f: Fiche) {
  return [
    f.motivations[0] && `• Objectif : ${motivationLabel(f.motivations[0])}`,
    v(f, 'type-projet') && `• Formule : ${selText(f, 'type-projet')}`,
    v(f, 'localite-souhaitee') && `• Localité souhaitée : ${v(f, 'localite-souhaitee')}`,
    v(f, 'superficie') && `• Superficie : ${v(f, 'superficie')}`,
  ].filter(isText);
}

function equivalent(f: Fiche) {
  const devise = v(f, 'devise') || 'XOF',
    rate = tauxDevise(f);
  if (f.residence !== 'diaspora' || devise === 'XOF' || Number.isNaN(rate)) return () => '';
  return (x: number) => ` (≈ ${grouped(x / rate)} ${devise === 'EUR' ? '€' : devise})`;
}

function bilanSimulation(f: Fiche, c: Capacite) {
  if (!c.prix) return [];
  const eqv = equivalent(f);
  const lieu = [
    v(f, 'lot-localite') && ` - ${v(f, 'lot-localite')}`,
    v(f, 'nature-foncier') && `, ${selText(f, 'nature-foncier').toLowerCase()}`,
  ].join('');
  return block(
    '*Votre simulation*',
    [
      `• Prix du lot : ${fcfa(c.prix)}${eqv(c.prix)}${lieu}`,
      `• Acompte (${CONFIG.ACOMPTE * 100} %) : ${fcfa(c.acompte)}${eqv(c.acompte)}`,
      c.mensuCPI
        ? `• Puis ${CONFIG.DUREE_CPI_MOIS} mensualités de : ${fcfa(c.mensuCPI)}${eqv(c.mensuCPI)}`
        : '',
      c.mensuBanque ? `• Mensualité estimée de votre prêt bancaire : ${fcfa(c.mensuBanque)}` : '',
      (c.ecartApport ?? 0) < 0
        ? `• Complément à prévoir pour l'acompte : ${fcfa(-(c.ecartApport ?? 0))}. Nous pouvons étudier ensemble un étalement.`
        : '',
    ].filter(isText),
  );
}

function conseilBudget(f: Fiche, c: Capacite, bud: Budget) {
  if (!bud) return '';
  if (bud.max >= CONFIG.PRIX_MIN)
    return !c.prix || c.prix > bud.max
      ? `Pour rester à l'aise, nous vous conseillons un lot jusqu'à ${fcfa(Math.min(bud.max, CONFIG.PRIX_MAX))}.`
      : '';
  if (bud.limite === 'apport')
    return "Nous vous proposons de préparer ensemble votre acompte avant de vous engager, par exemple avec un plan d'épargne ou une tontine. Nous restons à vos côtés pour trouver le bon moment.";
  if (c.credits > 0)
    return `Vos engagements en cours limitent aujourd'hui la mensualité confortable. Nous vous proposons de refaire le point à la fin de votre crédit actuel${v(f, 'fin-credit') ? ` (${selText(f, 'fin-credit').toLowerCase()})` : ''}, ou d'étudier une formule avec un apport plus important.`;
  return 'Nous pouvons étudier ensemble une formule avec un apport plus important pour alléger les mensualités.';
}

function conseil(f: Fiche, c: Capacite, bud: Budget) {
  const principal =
    c.prix && c.verdict === 'ok'
      ? 'Ce projet est cohérent avec votre budget. Vous pouvez avancer sereinement.'
      : '';
  const limite =
    c.prix && c.verdict === 'limite'
      ? 'Ce projet est réalisable, mais demande un budget bien tenu. Nous pouvons aussi regarder un lot un peu plus petit pour plus de confort.'
      : '';
  const premier = principal || limite || conseilBudget(f, c, bud);
  const prochain =
    !c.revenu && !c.prix
      ? 'Lors de notre prochain échange, nous préparerons ensemble une simulation adaptée à votre budget.'
      : '';
  return [premier, prochain].filter(isText);
}

function lotsSuggeres(f: Fiche, c: Capacite, bud: Budget, catalogue: Lot[]) {
  const plafond = bud ? bud.max : c.prix || CONFIG.PRIX_MAX;
  const souhait = v(f, 'localite-souhaitee');
  const abordables = catalogue.filter((l) => l.prix <= plafond);
  const proches = abordables.filter(
    (l) => !souhait || souhait === 'Indifférent' || l.localite === souhait,
  );
  return (proches.length ? proches : abordables)
    .toSorted((x, y) => y.prix - x.prix)
    .slice(0, 3)
    .map(
      (l) =>
        `• ${l.programme} - ${l.localite}, ${l.superficie} : ${fcfa(l.prix)} (${PAPIERS_BILAN[l.papiers] ?? l.papiers})`,
    );
}

function bilanParticulier(f: Fiche, catalogue: Lot[]) {
  const c = capacite(f),
    bud = budgetConseille(f, c);
  return [
    ...block('*Votre projet*', bilanProjet(f)),
    ...bilanSimulation(f, c),
    ...block('*Notre conseil*', conseil(f, c, bud)),
    ...block('*Des terrains qui correspondent à votre budget*', lotsSuggeres(f, c, bud, catalogue)),
  ];
}

function bilanEtape(f: Fiche) {
  const action = v(f, 'prochaine-action'),
    date = v(f, 'date-relance');
  if (!action && !date) return [];
  const jour = date
    ? ` le ${new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`
    : '';
  return ['*Prochaine étape*', `${ACTIONS_BILAN[action] ?? 'Prochain échange'}${jour}.`, ''];
}

export function buildBilan(f: Fiche, catalogue: Lot[]) {
  const nom = v(f, 'prospect-name') || v(f, 'company');
  const securite =
    diaspora(f) || is(f, 'etape', 'negociation', 'reservation')
      ? [
          'Pour votre sécurité, tous les paiements se font uniquement sur le compte bancaire de CPI, avec un reçu à chaque versement.',
        ]
      : [];
  return [
    `Bonjour${nom ? ` ${nom}` : ''},`,
    '',
    'Merci pour notre échange. Comme promis, voici le récapitulatif de votre projet.',
    '',
    ...(formal(f) ? bilanStructure(f) : bilanParticulier(f, catalogue)),
    ...bilanEtape(f),
    'Ces informations restent strictement confidentielles entre vous et CPI.',
    ...securite,
    '',
    'Je reste à votre disposition pour toute question.',
    '',
    v(f, 'commercial') || '[Votre nom]',
    'Conseiller, Groupe CPI (Compagnie Prestige Immobilier)',
  ].join('\n');
}

export function normTel(t: string) {
  const x = t.replace(/[^\d+]/g, '');
  if (x.startsWith('+')) return x.slice(1);
  if (x.startsWith('00')) return x.slice(2);
  return /^[37]\d{8}$/.test(x) ? `221${x}` : x;
}
export const telKey = (t: string) => normTel(t).slice(-9);

const csvCell = (x: string | number) => {
  const s = String(x);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function csvRow(f: Fiche, ids: string[]): (string | number)[] {
  const s = computeScore(f),
    a = adequation(f, s.cap);
  const notes = (['budget', 'authority', 'need', 'timeline'] as const).map(
    (k) => f.scores[k] || '',
  );
  const capaciteLabel = s.cap.verdict ? VERDICT_LABELS[s.cap.verdict] : '';
  return [
    frDate(f.cree),
    frDate(f.maj),
    SECTOR_LABELS[f.sector],
    diaspora(f) ? 'Diaspora' : 'Sénégal',
    ...notes,
    s.total,
    s.classe,
    a.label,
    capaciteLabel,
    f.motivations.map(motivationLabel).join(' / '),
    f.history.length,
    f.history.at(-1)?.note ?? '',
    ...ids.map((id) => selText(f, id)),
  ];
}

export function exportCsv(list: Fiche[]) {
  const ids = [...new Set(list.flatMap((f) => Object.keys(f.values)))];
  const head = [
    'Créée le',
    'Mise à jour',
    'Type',
    'Résidence',
    'Budget (1-5)',
    'Autorité (1-5)',
    'Besoin (1-5)',
    'Calendrier (1-5)',
    'Score /100',
    'Classe',
    'Adéquation offre',
    'Capacité',
    'Motivations',
    'Nb échanges',
    'Dernier compte-rendu',
    ...ids.map(columnTitle),
  ];
  const csv = [head, ...list.map((f) => csvRow(f, ids))]
    .map((r) => r.map(csvCell).join(';'))
    .join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  link.download = `CPI_Radar_prospects_${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
