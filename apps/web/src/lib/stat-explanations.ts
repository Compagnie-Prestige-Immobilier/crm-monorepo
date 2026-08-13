/**
 * Ce que dit la bulle « i » de chaque statistique.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Une bulle explique un CHIFFRE, pas un logiciel.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Elle répond à une seule question : que compte ce nombre, et sur quelle
 * population. Elle ne décrit ni les appels d'API, ni le cache, ni la
 * synchronisation, ni la façon dont l'écran est construit — rien de tout cela
 * n'aide un directeur à décider.
 *
 * Une ou deux phrases. Au-delà, personne ne lit, et une bulle qu'on ne lit pas
 * vaut moins qu'une absence de bulle : elle occupe la place où l'on aurait pu
 * nommer la statistique correctement.
 *
 * Elles sont regroupées ici plutôt que semées dans le JSX pour une raison
 * pratique : un test vérifie que CHAQUE statistique affichée en possède une, et
 * qu'aucune ne dérive vers le paragraphe.
 */

export const STAT_KEYS = [
  // ── Volet téléconseil ────────────────────────────────────────────────────
  'prospects',
  'representants',
  'teleconseillersActifs',
  'departementsCouverts',
  'conversionRate',
  'methodRate',
  'dailyAverage',
  'weeklyPace',
  'prospectsOverTime',
  'topTeleconseillers',
  'parStatutPhase2',
  'parMethode',
  'parSegment',

  // ── Volet banques ────────────────────────────────────────────────────────
  'bankVolume',
  'bankCashed',
  'bankRejectionRate',
  'bankMeanDelay',
  'bankByEstablishment',
  'bankDelayByEstablishment',
  'bankOverTime',
  'bankCashingsOverTime',
  'bankByStage',
  'bankByRejectionReason',

  // ── Entonnoir et argent, en tête du tableau de bord ──────────────────────
  'moneyCashed',
  'moneyCashed30Days',
  'moneyAverageCashing',
  'moneyRejectionRate',
  'funnelStages',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_EXPLANATIONS: Record<StatKey, string> = {
  prospects: 'Nombre de fiches prospects correspondant aux filtres en haut de page.',
  representants: 'Nombre de représentants ayant au moins une fiche dans la sélection courante.',
  teleconseillersActifs:
    'Comptes téléconseillers actifs ayant saisi au moins une fiche sur la période.',
  departementsCouverts: 'Départements où au moins un prospect a été enregistré.',
  conversionRate: 'Part des prospects passés au statut Converti, rapportée au total filtré.',
  methodRate:
    'Part des prospects ayant livré une méthode d’enrôlement. Les autres restent en attente, en refus ou en mauvais numéro.',
  dailyAverage:
    'Moyenne de fiches enregistrées par jour sur les 30 derniers jours, filtres compris.',
  weeklyPace:
    'Écart entre les 7 derniers jours et le rythme des trois semaines précédentes. Un chiffre positif signale une accélération.',
  prospectsOverTime:
    'Total cumulé des fiches depuis le début de la période filtrée. La pente indique le rythme de saisie.',
  topTeleconseillers:
    'Fiches apportées par chaque téléconseiller. Au-delà de cinq, les suivants sont regroupés sous Autres.',
  parStatutPhase2:
    'Répartition des prospects entre les quatre issues de la phase 2. Les statuts sans prospect apparaissent à zéro.',
  parMethode:
    'Répartition des méthodes obtenues. Le total porte sur les seuls prospects ayant livré une méthode, pas sur toute la sélection.',
  parSegment:
    'Croisement syndicat et banque, de BDD1 à BDD4. La part de méthodes obtenues distingue les segments les plus réceptifs.',

  bankVolume: 'Dossiers bancaires ouverts sur la sélection, toutes étapes confondues.',
  bankCashed: 'Dossiers arrivés à l’encaissement, et somme correspondante en francs CFA.',
  bankRejectionRate:
    'Rejets rapportés aux dossiers ayant abouti, encaissés ou rejetés. Les dossiers encore en cours sont exclus du calcul.',
  bankMeanDelay:
    'Durée moyenne entre l’ouverture d’un dossier et son issue. Seuls les dossiers clos entrent dans la moyenne.',
  bankByEstablishment:
    'Répartition des dossiers entre les banques de traitement, avec le montant encaissé par chacune.',
  bankDelayByEstablishment:
    'Durée moyenne de traitement, banque par banque. Elle isole l’établissement qui ralentit la chaîne.',
  bankOverTime:
    'Dossiers ouverts par jour sur la période filtrée. Les creux correspondent aux jours sans dépôt.',
  bankCashingsOverTime:
    'Encaissements par jour, en nombre et en montant. Les deux échelles sont indépendantes.',
  bankByStage: 'Dossiers actuellement positionnés sur chaque étape du flux de traitement.',
  bankByRejectionReason:
    'Répartition des motifs de rejet. Elle nomme la cause la plus fréquente de perte d’un dossier.',

  moneyCashed:
    'Somme des montants des dossiers encaissés, sur la sélection courante. C’est la seule étape de la chaîne qui rapporte.',
  moneyCashed30Days: 'Montants encaissés au cours des trente derniers jours.',
  moneyAverageCashing: 'Montant moyen d’un dossier encaissé, sur la sélection courante.',
  moneyRejectionRate:
    'Part des dossiers clos qui ont été rejetés. Les dossiers encore ouverts n’entrent pas dans le calcul.',
  funnelStages:
    'Effectif restant à chaque étape, du prospect saisi au dossier encaissé. Le taux indiqué est celui de l’étape précédente.',
};

/** Texte de la bulle. Une clé inconnue est impossible : le type l'interdit. */
export function explain(key: StatKey): string {
  return STAT_EXPLANATIONS[key];
}
