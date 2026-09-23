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

type Grid = Record<Crit, string[]>;
const GRIDS: Record<'common' | 'informal' | 'diaspora' | 'formal' | 'collective', Grid> = {
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
export const fcfa = (x: number) =>
  `${Math.round(x).toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`;
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

function gridKey(f: Fiche): keyof typeof GRIDS {
  if (f.sector === 'collective' || f.sector === 'formal') return f.sector;
  if (f.residence === 'diaspora') return 'diaspora';
  return f.sector === 'informal' ? 'informal' : 'common';
}

export function criteria(f: Fiche) {
  const k = gridKey(f);
  const desc: Record<Crit, string> = {
    budget:
      k === 'formal'
        ? 'Engagement financier de la structure'
        : k === 'diaspora'
          ? "Capacité financière depuis l'étranger"
          : 'Capacité financière',
    authority:
      k === 'collective'
        ? 'Consensus du groupe'
        : k === 'formal'
          ? "Pouvoir de décision de l'interlocuteur"
          : k === 'diaspora'
            ? 'Qui décide, qui agit sur place'
            : 'Qui décide',
    need: 'Urgence du besoin',
    timeline: k === 'diaspora' ? 'Lié à son prochain séjour' : 'Quand décider',
  };
  const names: Record<Crit, string> = {
    budget: 'Budget',
    authority: 'Autorité',
    need: 'Besoin',
    timeline: 'Calendrier',
  };
  return (['budget', 'authority', 'need', 'timeline'] as const).map((key) => ({
    key,
    name: names[key],
    max: CONFIG.POIDS[key],
    desc: desc[key],
    options: GRIDS[k][key].map((label, i) => ({ value: 5 - i, label })),
  }));
}

const tauxDevise = (f: Fiche) => {
  const d = v(f, 'devise') || 'XOF';
  if (d === 'XOF') return 1;
  if (d === 'EUR') return CONFIG.EUR;
  return n(f, 'taux-change') || NaN;
};
const personnesACharge = (f: Fiche) =>
  ({ '0': 0, '1-2': 2, '3-5': 4, '6+': 6 })[v(f, 'charges')] ?? 0;
const resteMin = (f: Fiche) => CONFIG.RESTE_BASE + CONFIG.RESTE_PAR_PERSONNE * personnesACharge(f);
const hasPret = (f: Fiche) => ['accord', 'en-cours', 'envisage'].includes(v(f, 'financement'));

export type Capacite = ReturnType<typeof capacite>;
export function capacite(f: Fiche) {
  const res = {
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
  if (!res.applicable) return res;
  const rate = tauxDevise(f);
  if (Number.isNaN(rate)) return { ...res, tauxManquant: true };
  res.revenu = n(f, 'revenu') * rate;
  res.credits = v(f, 'credit-en-cours') === 'oui' ? n(f, 'mensualites') * rate : 0;
  res.loyer = v(f, 'logement') === 'locataire' ? n(f, 'loyer') * rate : 0;
  res.transferts = n(f, 'transferts') * rate;
  if (hasPret(f) && n(f, 'pret-montant') > 0 && n(f, 'pret-duree') > 0) {
    res.pret = n(f, 'pret-montant');
    const months = n(f, 'pret-duree') * 12,
      r = n(f, 'pret-taux') / 100 / 12;
    res.mensuBanque = r > 0 ? (res.pret * r) / (1 - Math.pow(1 + r, -months)) : res.pret / months;
  }
  if (res.prix) {
    res.acompte = res.prix * CONFIG.ACOMPTE;
    const entree = res.apport + res.pret;
    if (v(f, 'apport') !== '' || res.pret) res.ecartApport = entree - res.acompte;
    res.mensuCPI = Math.max(0, res.prix - Math.max(entree, res.acompte)) / CONFIG.DUREE_CPI_MOIS;
  }
  res.mensuTotal = res.mensuCPI + res.mensuBanque;
  if (res.revenu > 0) {
    const rank = { ok: 0, limite: 1, ko: 2 };
    res.tauxAvant = res.credits / res.revenu;
    let verdict: Verdict;
    if (res.mensuTotal > 0) {
      res.tauxApres = (res.credits + res.mensuTotal) / res.revenu;
      verdict =
        res.tauxApres <= CONFIG.ENDETTEMENT_OK
          ? 'ok'
          : res.tauxApres <= CONFIG.ENDETTEMENT_LIMITE
            ? 'limite'
            : 'ko';
      if (verdict !== 'ok') res.raisons.push(`endettement de ${Math.round(res.tauxApres * 100)} %`);
    } else {
      verdict =
        res.tauxAvant <= 0.2 ? 'ok' : res.tauxAvant <= CONFIG.ENDETTEMENT_OK ? 'limite' : 'ko';
      if (verdict !== 'ok')
        res.raisons.push(`endettement actuel de ${Math.round(res.tauxAvant * 100)} %`);
    }
    res.reste = res.revenu - res.credits - res.loyer - res.transferts - res.mensuTotal;
    if (f.residence !== 'diaspora') {
      res.resteMin = resteMin(f);
      const rv: Verdict =
        res.reste >= res.resteMin * 1.3 ? 'ok' : res.reste >= res.resteMin ? 'limite' : 'ko';
      if (rv !== 'ok')
        res.raisons.push(
          `reste à vivre de ${fcfa(res.reste)} (minimum conseillé ${fcfa(res.resteMin)})`,
        );
      if (rank[rv] > rank[verdict]) verdict = rv;
    }
    res.verdict = verdict;
  }
  return res;
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

function engagementPts(f: Fiche) {
  const etapes: Record<string, number> = {
    contacte: 2,
    rdv: 5,
    visite: 8,
    proposition: 10,
    negociation: 13,
    reservation: 15,
  };
  const site: Record<string, number> = { 'oui-plusieurs': 8, 'oui-un': 6 };
  const agence: Record<string, number> = { 'oui-plusieurs': 5, 'oui-une-fois': 3 };
  const terrain: Record<string, number> = { personne: 8, video: 6, proche: 3 };
  return Math.min(
    CONFIG.POIDS.engagement,
    Math.max(
      etapes[v(f, 'etape')] ?? 0,
      site[v(f, 'visite-site')] ?? 0,
      agence[v(f, 'visite-cpi')] ?? 0,
      f.residence === 'diaspora' ? (terrain[v(f, 'vu-terrain')] ?? 0) : 0,
      v(f, 'deja-client') === 'oui' ? 8 : 0,
    ),
  );
}

export type Score = ReturnType<typeof computeScore>;
export function computeScore(f: Fiche) {
  const P = CONFIG.POIDS,
    cap = capacite(f),
    s = f.scores;
  const pts = {
    budget: (s.budget * P.budget) / 5,
    authority: (s.authority * P.authority) / 5,
    need: (s.need * P.need) / 5,
    timeline: (s.timeline * P.timeline) / 5,
    engagement: engagementPts(f),
  };
  const caps: string[] = [];
  if (cap.verdict === 'ko' && pts.budget > 12) {
    pts.budget = 12;
    caps.push('Budget plafonné : capacité de paiement insuffisante');
  } else if (cap.verdict === 'limite' && pts.budget > 24) {
    pts.budget = 24;
    caps.push('Budget plafonné : capacité de paiement limite');
  }
  const total = Math.round(Object.values(pts).reduce((a, b) => a + b, 0));
  const S = CONFIG.SEUILS_CLASSES;
  let classe: Classe = total >= S.A ? 'A' : total >= S.B ? 'B' : total >= S.C ? 'C' : 'D';
  const atBest = (c: Classe) => {
    if (classe < c) classe = c;
  };
  if (s.budget === 1 || cap.verdict === 'ko') {
    atBest('C');
    caps.push(
      `Règle éliminatoire : ${s.budget === 1 ? 'budget noté 1' : 'capacité insuffisante'}, classe C au mieux`,
    );
  }
  if (s.authority === 1) {
    atBest('C');
    caps.push('Règle éliminatoire : autorité notée 1, classe C au mieux');
  }
  if (v(f, 'etape') === 'perdu') {
    classe = 'D';
    caps.push(`Prospect perdu${v(f, 'motif-perte') ? ` : ${selText(f, 'motif-perte')}` : ''}`);
  }
  const manquants = (['budget', 'authority', 'need', 'timeline'] as const).filter(
    (k) => !s[k],
  ).length;
  return {
    pts,
    total,
    classe,
    caps,
    manquants,
    incoherent: cap.verdict === 'ko' && s.budget >= 4,
    cap,
  };
}

export function budgetHint(f: Fiche, c: Capacite) {
  if (!c.verdict)
    return f.sector === 'formal'
      ? null
      : {
          warn: false,
          text: 'Renseigner revenus et prix du lot (Découverte) pour guider la note.',
        };
  const conseil = { ok: '4 ou 5', limite: '3', ko: '1 ou 2' }[c.verdict];
  const txt = { ok: 'capacité confirmée', limite: 'capacité limite', ko: 'capacité insuffisante' }[
    c.verdict
  ];
  const warn =
    (c.verdict === 'ko' && f.scores.budget >= 3) ||
    (c.verdict === 'limite' && f.scores.budget >= 5);
  return {
    warn,
    text: `Simulation : ${txt}, note conseillée ${conseil}${warn ? '. La note choisie est incohérente avec la simulation.' : ''}`,
  };
}

export type Niveau = 'forte' | 'moyenne' | 'faible' | 'na';
export type Check = { state: 'ok' | 'partial' | 'ko' | 'info'; text: string };
export function adequation(
  f: Fiche,
  c = capacite(f),
): { niveau: Niveau; label: string; items: Check[] } {
  const items: Check[] = [];
  let score = 0,
    count = 0;
  const add = (ok: boolean, partial: boolean, text: string) => {
    count++;
    score += ok ? 1 : partial ? 0.5 : 0;
    items.push({ state: ok ? 'ok' : partial ? 'partial' : 'ko', text });
  };
  const ls = v(f, 'localite-souhaitee'),
    ll = v(f, 'lot-localite');
  if (ls && ll)
    add(ls === 'Indifférent' || ls === ll, false, `Localité : souhaitée ${ls}, lot à ${ll}`);
  const ss = v(f, 'superficie'),
    sl = v(f, 'lot-superficie');
  if (ss && sl) {
    const i = CONFIG.SUPERFICIES.indexOf(ss as never),
      j = CONFIG.SUPERFICIES.indexOf(sl as never);
    add(i === j, Math.abs(i - j) === 1, `Superficie : souhaitée ${ss}, lot de ${sl}`);
  }
  const ex = v(f, 'exigence-papiers'),
    nat = v(f, 'nature-foncier');
  if (ex && nat) {
    const ok =
      ex === 'indifferent' ||
      (ex === 'tf' && nat === 'titre-foncier') ||
      (ex === 'bail' && nat !== 'notification-bail');
    add(
      ok,
      ex === 'bail' && nat === 'notification-bail',
      `Papiers : ${selText(f, 'exigence-papiers').toLowerCase()}, lot en ${selText(f, 'nature-foncier').toLowerCase()}`,
    );
  }
  const bud = budgetConseille(f, c),
    prix = n(f, 'prix-lot');
  if (bud && prix)
    add(
      prix <= bud.max,
      prix <= bud.max * 1.1,
      `Budget : lot à ${fcfa(prix)}, budget conseillé ${fcfa(bud.max)}`,
    );
  if (v(f, 'etat-site'))
    items.push({ state: 'info', text: `État du site : ${selText(f, 'etat-site')}` });
  if (!count)
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
  const r = score / count;
  const niveau = r >= 0.8 ? 'forte' : r >= 0.5 ? 'moyenne' : 'faible';
  return { niveau, label: `Adéquation ${niveau}`, items };
}

export function simulationRows(f: Fiche, c: Capacite): [string, string][] {
  const rows: [string, string][] = [];
  if (c.revenu) rows.push(['Revenu mensuel', fcfa(c.revenu)]);
  if (c.credits) rows.push(['Crédits en cours / mois', fcfa(c.credits)]);
  if (c.loyer) rows.push(['Loyer / mois', fcfa(c.loyer)]);
  if (c.transferts) rows.push(['Aide familiale / mois', fcfa(c.transferts)]);
  if (c.prix)
    rows.push(
      [`Acompte ${CONFIG.ACOMPTE * 100} %`, fcfa(c.acompte)],
      [`Mensualité CPI (${CONFIG.DUREE_CPI_MOIS} mois)`, fcfa(c.mensuCPI)],
    );
  if (c.mensuBanque) rows.push(['Mensualité banque', fcfa(c.mensuBanque)]);
  if (c.ecartApport !== null)
    rows.push([
      c.ecartApport >= 0 ? 'Apport : excédent' : 'Apport : manque',
      fcfa(Math.abs(c.ecartApport)),
    ]);
  if (c.tauxApres !== null)
    rows.push(["Endettement avec l'achat", `${Math.round(c.tauxApres * 100)} %`]);
  else if (c.tauxAvant !== null)
    rows.push(['Endettement actuel', `${Math.round(c.tauxAvant * 100)} %`]);
  if (c.reste !== null) rows.push(['Reste à vivre / mois', fcfa(c.reste)]);
  const bud = budgetConseille(f, c);
  if (bud) rows.push(['Budget lot conseillé', fcfa(bud.max)]);
  return rows;
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
  for (const p of CONFIG.PERIODES.filter((p) => d >= p.debut && d <= p.fin)) {
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
  if (v(f, 'etape') === 'perdu') req.push(['motif-perte', 'motif de perte']);
  else if (v(f, 'etape') !== 'reservation')
    req.push(['prochaine-action', 'prochaine action'], ['date-relance', 'date de relance']);
  const out = req.filter(([id]) => !v(f, id)).map(([id, label]) => ({ id, label }));
  if (f.sector !== 'formal' && !f.motivations.length)
    out.push({ id: 'motivations', label: 'motivation' });
  return out;
}

export function recommendations(f: Fiche, s: Score, a: ReturnType<typeof adequation>) {
  const r: string[] = [];
  const c = s.cap,
    dias = f.residence === 'diaspora',
    k = gridKey(f);
  const low = (key: Crit) => f.scores[key] > 0 && f.scores[key] <= 2;
  if (s.incoherent)
    r.push(
      'Incohérence : budget noté 4 ou 5 alors que la simulation montre une capacité insuffisante. Revoir la note.',
    );
  if (k === 'collective') {
    if (low('budget')) r.push('Explorer tontine, cotisations exceptionnelles, subventions');
    if (low('authority')) r.push("Obtenir une présentation devant le bureau puis l'AG");
    if (low('need'))
      r.push("Montrer l'impact collectif (logement des membres, patrimoine du groupement)");
    if (low('timeline')) r.push('Caler la proposition sur le cycle de cotisation');
  } else if (k === 'formal') {
    if (low('budget'))
      r.push(
        'Proposer une formule sans coût pour la structure : convention + prélèvement sur salaire',
      );
    if (low('authority') || ['delegue', 'autre'].includes(v(f, 'fonction-interlocuteur')))
      r.push("Obtenir un RDV avec le DG ou le DRH, avec l'appui de l'interlocuteur actuel");
    if (low('need'))
      r.push('Proposer un court sondage logement auprès des salariés pour mesurer la demande');
    if (low('timeline') || v(f, 'cycle') === 'conseil')
      r.push('Préparer le dossier pour le prochain comité ou le budget annuel');
    if (['convention', 'prelevement'].includes(v(f, 'modalite')))
      r.push('Envoyer un projet de convention avec prix de groupe et modalités de prélèvement');
    if (n(f, 'salaries-concernes') >= 20 || ['200-1000', 'plus-1000'].includes(v(f, 'effectif')))
      r.push('Organiser une présentation collective sur le lieu de travail');
  } else if (dias) {
    if (low('budget')) r.push('Proposer un échéancier par virements mensuels sur 24 mois');
    if (low('authority'))
      r.push('Associer la famille au Sénégal : RDV agence avec le proche qui valide');
    if (low('need')) r.push('Faire préciser le projet : retour, retraite, locatif ?');
    if (low('timeline')) r.push('Fixer une échéance liée à son prochain séjour');
  } else {
    if (low('budget'))
      r.push(
        f.sector === 'informal'
          ? "Caler l'acompte sur la tontine ou la bonne saison ; échéancier Wave/OM"
          : 'Étudier un échéancier adapté (Wave/OM) ou un lot plus petit',
      );
    if (low('authority')) r.push('Inviter le conjoint ou la famille qui décide au prochain RDV');
    if (low('need')) r.push('Faire émerger un bénéfice concret (loyer économisé, patrimoine)');
    if (low('timeline'))
      r.push('Trouver un événement déclencheur daté (fin de bail, tontine, rentrée)');
  }
  if (k !== 'formal') {
    const b = v(f, 'banque'),
      fin = v(f, 'financement'),
      sp = v(f, 'statut-pro');
    if (b === 'aucun' || b === 'mobile')
      r.push(
        "Non bancarisé : échéancier Wave/OM avec reçu CPI, conseiller l'ouverture d'un compte",
      );
    if ((sp === 'fonctionnaire' || sp === 'cdi') && (fin === 'envisage' || fin === ''))
      r.push('Salarié stable : proposer un montage de crédit immobilier avec sa banque');
    if (fin === 'en-cours' || fin === 'accord')
      r.push('Préparer attestation de réservation / promesse de vente pour la banque');
    if (fin === 'refuse') r.push('Crédit refusé : proposer paiement échelonné ou lot plus petit');
    if (hasPret(f) && !c.mensuBanque)
      r.push('Renseigner montant, durée et taux du prêt pour une simulation juste');
    if (v(f, 'credit-en-cours') === 'oui') {
      if (['moins-6', '6-12'].includes(v(f, 'fin-credit')))
        r.push(
          'Crédit bientôt soldé : planifier la relance à cette date, sa capacité va se libérer',
        );
      if (v(f, 'type-credit') === 'immobilier')
        r.push(
          'Crédit immobilier en cours : vérifier si sa banque accepte un 2e crédit ou un rachat',
        );
      if (!n(f, 'mensualites')) r.push('Demander le montant total des mensualités en cours');
    }
    if (c.verdict === 'ko')
      r.push(
        "Capacité insuffisante : proposer un lot plus petit, un apport plus fort, ou attendre la fin d'un crédit",
      );
    if (c.verdict === 'limite')
      r.push(
        'Capacité limite : vérifier le budget réel (dépenses familiales, cérémonies) avant de signer',
      );
    if (v(f, 'regularite') === 'variable')
      r.push(
        'Revenus variables : raisonner sur la moyenne de 6 mois et demander relevés bancaires ou Wave/OM',
      );
    if (v(f, 'informel-credit') === 'tontine')
      r.push("Tontine : caler l'acompte sur la date où il « prend » la tontine");
    if (c.ecartApport !== null && c.ecartApport < 0)
      r.push(
        `Il manque ${fcfa(-c.ecartApport)} pour l'acompte : échelonner l'acompte ou viser un lot moins cher`,
      );
    if (c.loyer && c.mensuCPI)
      r.push(
        `Loyer ${fcfa(c.loyer)} et mensualité CPI ${fcfa(c.mensuCPI)} se cumulent pendant ${CONFIG.DUREE_CPI_MOIS} mois : le vérifier avec lui`,
      );
    if (v(f, 'age') === 'plus-60' && ['envisage', 'en-cours'].includes(fin))
      r.push("Plus de 60 ans : durée de crédit courte, privilégier l'apport ou l'échéancier CPI");
    if (v(f, 'age') === '50-60' && (sp === 'fonctionnaire' || sp === 'cdi'))
      r.push("Proche de la retraite : utiliser sa capacité d'emprunt avant la fin d'activité");
    if (v(f, 'deja-proprio') === 'bien')
      r.push("Déjà propriétaire : positionner l'offre comme investissement (locatif, patrimoine)");
    if (v(f, 'matrimonial') === 'marie' && f.scores.authority && f.scores.authority <= 3)
      r.push('Inviter le conjoint au prochain RDV ou à la visite');
    if (!v(f, 'credit-en-cours')) r.push("Demander s'il a un crédit en cours");
    if (!b) r.push('Demander la banque du prospect');
  }
  if (a.niveau === 'faible')
    r.push('Adéquation faible : proposer un autre lot du catalogue, plus proche de ses attentes');
  if (
    ['revenu', 'mensualites', 'apport', 'transferts'].some((id) => v(f, id) !== '') &&
    !v(f, 'consent-date')
  )
    r.push('Recueillir le consentement du prospect avant de conserver ses données financières');
  const acq = v(f, 'acquereur');
  if (acq && acq !== 'lui')
    r.push("Bien au nom d'un tiers : pièces d'identité du titulaire et accord écrit de sa part");
  if (acq === 'famille')
    r.push('Co-acquisition familiale : fixer par écrit, chez le notaire, la part de chacun');
  if (acq === 'proche' && dias)
    r.push(
      "Diaspora, bien au nom d'un proche : risque de litige. Conseiller l'achat à son propre nom avec une procuration",
    );
  if (acq === 'enfant')
    r.push("Au nom d'enfants : si mineurs, vérifier avec le notaire (représentation légale)");
  if (['negociation', 'reservation'].includes(v(f, 'etape'))) {
    if (!v(f, 'piece') || v(f, 'piece') === 'non')
      r.push("Vérifier et copier la pièce d'identité avant tout encaissement");
    if (v(f, 'origine-justifiee') !== 'oui')
      r.push(
        `Obtenir un justificatif de l'origine des fonds${dias ? " (bulletins de salaire, avis d'imposition)" : ''}`,
      );
  }
  if (v(f, 'mode-paiement') === 'especes')
    r.push(
      "Paiement en espèces : l'orienter vers un versement bancaire sur le compte CPI ; sinon justificatif d'origine des fonds obligatoire",
    );
  if (v(f, 'ppe') === 'oui')
    r.push(
      'Personne politiquement exposée : vigilance renforcée, validation par la direction avant signature',
    );
  if (v(f, 'ppe') === 'verifier')
    r.push('Vérifier si le prospect est une personne politiquement exposée');
  if (v(f, 'deja-client') === 'oui') {
    const sat = v(f, 'satisfaction'),
      rec = v(f, 'recommande');
    if (sat === 'insatisfait' || sat === 'mitige')
      r.push(
        'Client insatisfait : remonter à la direction et régler le problème avant toute nouvelle vente',
      );
    if ((sat === 'tres' || sat === 'satisfait') && rec !== 'non')
      r.push("Client satisfait : lui demander 2 ou 3 contacts et l'inscrire comme parrain");
    if (!sat) r.push("Demander au client s'il est satisfait de son premier achat");
  }
  const freins: Record<string, string> = {
    prix: 'Frein prix : comparer au m² avec la zone et rappeler ce qui est inclus (viabilisation, papiers)',
    acompte: 'Frein acompte : étudier un acompte en 2 ou 3 versements',
    confiance:
      'Frein confiance : montrer un programme livré, les papiers et des témoignages clients',
    zone: "Frein zone : présenter les projets d'accès et de services à venir, organiser la visite",
    papiers:
      'Frein papiers : expliquer TF / bail / notification et proposer la vérification par son notaire',
    famille: 'Frein famille : organiser une visite de site en famille',
  };
  const frein = freins[v(f, 'frein')];
  if (frein) r.push(frein);
  if (v(f, 'concurrence') === 'plusieurs')
    r.push(
      'Il compare : fiche comparative CPI vs concurrents (papiers, viabilisation, délais) et relance rapide',
    );
  if (!v(f, 'langue')) r.push("Noter la langue dans laquelle il est le plus à l'aise");
  return r;
}

export function argumentaire(f: Fiche) {
  if (f.sector === 'formal') return [];
  return f.motivations.map((id, i) => ({
    main: i === 0,
    text: MOTIVATIONS.find((m) => m.id === id)?.arg ?? '',
  }));
}

export function diasporaProtocol(f: Fiche) {
  if (f.residence !== 'diaspora') return [];
  const p = [
    'Rappeler dès le 1er échange : tout paiement se fait uniquement sur le compte bancaire de CPI, jamais à un intermédiaire, avec un reçu à chaque versement.',
  ];
  p.push(
    `Appeler aux heures qui l'arrangent${v(f, 'pays') ? ` (décalage horaire ${v(f, 'pays')})` : ''} ; messages vocaux WhatsApp en priorité.`,
  );
  const m = v(f, 'mandataire');
  if (m === 'aucun' || m === '')
    p.push(
      'Proposer une procuration notariée (notaire ou consulat) pour signer et suivre le dossier en son absence.',
    );
  if (m === 'proche')
    p.push("Le proche n'a pas de procuration : l'inviter à en établir une avant la signature.");
  if (['non', 'proche', ''].includes(v(f, 'vu-terrain')))
    p.push('Organiser une visite du site en vidéo WhatsApp en direct (bornes, voisinage, accès).');
  const s = v(f, 'sejour');
  if (s === 'sur-place' || s === 'moins-1-mois')
    p.push(
      'Il est (bientôt) au Sénégal : bloquer RDV agence + visite + signature pendant le séjour.',
    );
  else if (s === '1-3-mois' || s === '3-6-mois')
    p.push('Préparer tout le dossier à distance pour signer lors de son prochain séjour.');
  if (['transfert', 'famille'].includes(v(f, 'paiement-diaspora')))
    p.push(
      'Orienter vers un virement bancaire direct au compte CPI : traçable et sécurisant pour lui.',
    );
  const q = v(f, 'inquietude');
  if (q === 'arnaque' || q === 'papiers')
    p.push(
      'Envoyer copie du titre / état des droits réels et proposer une vérification par son notaire.',
    );
  if (q === 'argent') p.push('Envoyer relevé des versements et reçus CPI à chaque paiement.');
  if (q === 'chantier') p.push("S'engager sur un reporting photo/vidéo mensuel du chantier.");
  if (q === 'prix') p.push('Donner une comparaison chiffrée avec les prix de la zone.');
  p.push(
    "Préparer les justificatifs d'origine des fonds (bulletins de salaire, avis d'imposition) pour le closing.",
  );
  p.push('Proposer des références de clients diaspora déjà livrés.');
  return p;
}

export function ficheLines(
  f: Fiche,
  s = computeScore(f),
  a = adequation(f, s.cap),
): [string, string][] {
  const L: [string, string][] = [];
  const add = (k: string, id: string) => {
    if (v(f, id)) L.push([k, selText(f, id)]);
  };
  L.push([
    'Contact',
    (v(f, 'prospect-name') || 'Non renseigné') +
      (v(f, 'telephone') ? ` - ${v(f, 'telephone')}` : ''),
  ]);
  if (v(f, 'company'))
    L.push([
      f.sector === 'formal' ? 'Structure' : f.sector === 'collective' ? 'Groupement' : 'Entreprise',
      v(f, 'company'),
    ]);
  L.push([
    'Type',
    SECTOR_LABELS[f.sector] +
      (f.residence === 'diaspora' ? ` - Diaspora${v(f, 'pays') ? ` (${v(f, 'pays')})` : ''}` : ''),
  ]);
  L.push(['Classe', `${s.classe} - ${CLASSES[s.classe].label} (score ${s.total}/100)`]);
  L.push(['Adéquation offre', a.label]);
  add('Rôle', 'role-groupement');
  add('Secteur', 'secteur-activite');
  add('Statut pro', 'statut-pro');
  if (v(f, 'etape'))
    L.push([
      'Étape',
      selText(f, 'etape') + (v(f, 'motif-perte') ? ` - ${selText(f, 'motif-perte')}` : ''),
    ]);
  add('Canal', 'canal');
  if (v(f, 'langue'))
    L.push([
      'Langue',
      v(f, 'langue') + (v(f, 'moment') ? `, joignable ${selText(f, 'moment').toLowerCase()}` : ''),
    ]);
  if (f.sector === 'formal') {
    add('Type de structure', 'type-structure');
    add('Effectif', 'effectif');
    add('Salariés intéressés', 'salaries-concernes');
    add('Interlocuteur', 'fonction-interlocuteur');
    add('Modalité', 'modalite');
    add('Validation', 'cycle');
  }
  if (f.motivations.length) L.push(['Motivation', f.motivations.map(motivationLabel).join(' / ')]);
  add('Localité souhaitée', 'localite-souhaitee');
  add('Superficie souhaitée', 'superficie');
  const c = s.cap;
  if (c.revenu) L.push(['Revenu', fcfa(c.revenu)]);
  if (v(f, 'credit-en-cours'))
    L.push([
      'Crédit en cours',
      v(f, 'credit-en-cours') === 'oui'
        ? `Oui${v(f, 'type-credit') ? ` - ${selText(f, 'type-credit')}` : ''}${c.credits ? `, ${fcfa(c.credits)}/mois` : ''}`
        : 'Non',
    ]);
  if (c.prix)
    L.push([
      'Lot envisagé',
      fcfa(c.prix) + (v(f, 'lot-localite') ? ` - ${v(f, 'lot-localite')}` : ''),
    ]);
  if (v(f, 'apport') !== '')
    L.push([
      'Apport',
      fcfa(n(f, 'apport')) + (v(f, 'origine-apport') ? ` (${selText(f, 'origine-apport')})` : ''),
    ]);
  if (c.verdict) L.push(['Capacité', VERDICT_LABELS[c.verdict]]);
  add('Banque', 'banque');
  add('Financement', 'financement');
  if (f.residence === 'diaspora') {
    add('Représentant', 'mandataire');
    add('Prochain séjour', 'sejour');
    add('Inquiétude', 'inquietude');
  }
  if (v(f, 'acquereur'))
    L.push([
      'Acquéreur au titre',
      selText(f, 'acquereur') + (v(f, 'titulaire') ? ` - ${v(f, 'titulaire')}` : ''),
    ]);
  add('Frein', 'frein');
  add('Concurrence', 'concurrence');
  add('Parrain', 'parrain');
  add('Conseiller', 'commercial');
  if (v(f, 'prochaine-action'))
    L.push([
      'Prochaine action',
      selText(f, 'prochaine-action') +
        (v(f, 'date-relance') ? ` le ${frDate(v(f, 'date-relance'))}` : ''),
    ]);
  L.push(['Consentement', v(f, 'consent-date') ? `Oui (${frDate(v(f, 'consent-date'))})` : 'Non']);
  return L;
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

export function buildBilan(f: Fiche, catalogue: Lot[]) {
  const c = capacite(f);
  const nom = v(f, 'prospect-name') || v(f, 'company');
  const d = v(f, 'devise') || 'XOF',
    rate = tauxDevise(f);
  const eqv = (x: number) =>
    f.residence === 'diaspora' && d !== 'XOF' && !Number.isNaN(rate)
      ? ` (≈ ${Math.round(x / rate)
          .toLocaleString('fr-FR')
          .replace(/ | /g, ' ')} ${d === 'EUR' ? '€' : d})`
      : '';
  const L = [
    `Bonjour${nom ? ` ${nom}` : ''},`,
    '',
    'Merci pour notre échange. Comme promis, voici le récapitulatif de votre projet.',
    '',
  ];
  if (f.sector === 'formal') {
    const p: string[] = [];
    if (v(f, 'company')) p.push(`• Structure : ${v(f, 'company')}`);
    if (v(f, 'salaries-concernes'))
      p.push(`• Salariés potentiellement intéressés : ${v(f, 'salaries-concernes')}`);
    if (v(f, 'modalite')) p.push(`• Formule envisagée : ${selText(f, 'modalite')}`);
    if (v(f, 'localite-souhaitee')) p.push(`• Localité souhaitée : ${v(f, 'localite-souhaitee')}`);
    if (p.length) L.push('*Le projet*', ...p, '');
    L.push(
      '*Ce que CPI propose*',
      '• Un prix de groupe et des conditions de paiement adaptées aux salariés',
      '• Une présentation sur site pour les salariés intéressés',
      "• Un accompagnement de chaque acquéreur jusqu'à la remise des papiers",
      '',
    );
  } else {
    const projet: string[] = [];
    if (f.motivations[0]) projet.push(`• Objectif : ${motivationLabel(f.motivations[0])}`);
    if (v(f, 'type-projet')) projet.push(`• Formule : ${selText(f, 'type-projet')}`);
    if (v(f, 'localite-souhaitee'))
      projet.push(`• Localité souhaitée : ${v(f, 'localite-souhaitee')}`);
    if (v(f, 'superficie')) projet.push(`• Superficie : ${v(f, 'superficie')}`);
    if (projet.length) L.push('*Votre projet*', ...projet, '');
    if (c.prix) {
      L.push('*Votre simulation*');
      L.push(
        `• Prix du lot : ${fcfa(c.prix)}${eqv(c.prix)}${v(f, 'lot-localite') ? ` - ${v(f, 'lot-localite')}` : ''}${v(f, 'nature-foncier') ? `, ${selText(f, 'nature-foncier').toLowerCase()}` : ''}`,
      );
      L.push(`• Acompte (${CONFIG.ACOMPTE * 100} %) : ${fcfa(c.acompte)}${eqv(c.acompte)}`);
      if (c.mensuCPI)
        L.push(
          `• Puis ${CONFIG.DUREE_CPI_MOIS} mensualités de : ${fcfa(c.mensuCPI)}${eqv(c.mensuCPI)}`,
        );
      if (c.mensuBanque)
        L.push(`• Mensualité estimée de votre prêt bancaire : ${fcfa(c.mensuBanque)}`);
      if (c.ecartApport !== null && c.ecartApport < 0)
        L.push(
          `• Complément à prévoir pour l'acompte : ${fcfa(-c.ecartApport)}. Nous pouvons étudier ensemble un étalement.`,
        );
      L.push('');
    }
    const bud = budgetConseille(f, c),
      reco: string[] = [];
    if (c.prix && c.verdict === 'ok')
      reco.push('Ce projet est cohérent avec votre budget. Vous pouvez avancer sereinement.');
    else if (c.prix && c.verdict === 'limite')
      reco.push(
        'Ce projet est réalisable, mais demande un budget bien tenu. Nous pouvons aussi regarder un lot un peu plus petit pour plus de confort.',
      );
    else if (bud && bud.max >= CONFIG.PRIX_MIN && (!c.prix || c.prix > bud.max))
      reco.push(
        `Pour rester à l'aise, nous vous conseillons un lot jusqu'à ${fcfa(Math.min(bud.max, CONFIG.PRIX_MAX))}.`,
      );
    else if (bud && bud.max < CONFIG.PRIX_MIN) {
      if (bud.limite === 'apport')
        reco.push(
          "Nous vous proposons de préparer ensemble votre acompte avant de vous engager, par exemple avec un plan d'épargne ou une tontine. Nous restons à vos côtés pour trouver le bon moment.",
        );
      else if (c.credits > 0)
        reco.push(
          `Vos engagements en cours limitent aujourd'hui la mensualité confortable. Nous vous proposons de refaire le point à la fin de votre crédit actuel${v(f, 'fin-credit') ? ` (${selText(f, 'fin-credit').toLowerCase()})` : ''}, ou d'étudier une formule avec un apport plus important.`,
        );
      else
        reco.push(
          'Nous pouvons étudier ensemble une formule avec un apport plus important pour alléger les mensualités.',
        );
    }
    if (!c.revenu && !c.prix)
      reco.push(
        'Lors de notre prochain échange, nous préparerons ensemble une simulation adaptée à votre budget.',
      );
    if (reco.length) L.push('*Notre conseil*', ...reco, '');
    const plafond = bud ? bud.max : c.prix || CONFIG.PRIX_MAX;
    const ls = v(f, 'localite-souhaitee');
    let lots = catalogue.filter((l) => l.prix <= plafond);
    const proches = lots.filter((l) => !ls || ls === 'Indifférent' || l.localite === ls);
    if (proches.length) lots = proches;
    lots = lots.sort((x, y) => y.prix - x.prix).slice(0, 3);
    if (lots.length)
      L.push(
        '*Des terrains qui correspondent à votre budget*',
        ...lots.map(
          (l) =>
            `• ${l.programme} - ${l.localite}, ${l.superficie} : ${fcfa(l.prix)} (${PAPIERS_BILAN[l.papiers] ?? l.papiers})`,
        ),
        '',
      );
  }
  const pa = v(f, 'prochaine-action'),
    dr = v(f, 'date-relance');
  if (pa || dr) {
    const jour = dr
      ? new Date(`${dr}T12:00:00`).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      : '';
    L.push(
      '*Prochaine étape*',
      `${pa ? ACTIONS_BILAN[pa] : 'Prochain échange'}${jour ? ` le ${jour}` : ''}.`,
      '',
    );
  }
  L.push('Ces informations restent strictement confidentielles entre vous et CPI.');
  if (f.residence === 'diaspora' || ['negociation', 'reservation'].includes(v(f, 'etape')))
    L.push(
      'Pour votre sécurité, tous les paiements se font uniquement sur le compte bancaire de CPI, avec un reçu à chaque versement.',
    );
  L.push(
    '',
    'Je reste à votre disposition pour toute question.',
    '',
    v(f, 'commercial') || '[Votre nom]',
    'Conseiller, Groupe CPI (Compagnie Prestige Immobilier)',
  );
  return L.join('\n');
}

export function normTel(t: string) {
  let x = t.replace(/[^\d+]/g, '');
  if (x.startsWith('+')) x = x.slice(1);
  else if (x.startsWith('00')) x = x.slice(2);
  else if (/^[37]\d{8}$/.test(x)) x = `221${x}`;
  return x;
}
export const telKey = (t: string) => normTel(t).slice(-9);

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
  const cell = (x: unknown) => {
    const s = String(x ?? '');
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = list.map((f) => {
    const s = computeScore(f),
      a = adequation(f, s.cap);
    return [
      frDate(f.cree),
      frDate(f.maj),
      SECTOR_LABELS[f.sector],
      f.residence === 'diaspora' ? 'Diaspora' : 'Sénégal',
      f.scores.budget || '',
      f.scores.authority || '',
      f.scores.need || '',
      f.scores.timeline || '',
      s.total,
      s.classe,
      a.label,
      s.cap.verdict ? VERDICT_LABELS[s.cap.verdict] : '',
      f.motivations.map(motivationLabel).join(' / '),
      f.history.length,
      f.history.at(-1)?.note ?? '',
      ...ids.map((id) => selText(f, id)),
    ];
  });
  const blob = new Blob([`﻿${[head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `CPI_Radar_prospects_${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
