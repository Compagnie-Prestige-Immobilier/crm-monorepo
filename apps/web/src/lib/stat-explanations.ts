export const STAT_KEYS = [
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

  'campaignContactRate',
  'campaignReachRate',
  'campaignAttemptsPerMethod',
  'campaignRemaining',
  'campaignClosedPerDay',
  'campaignClosedPerCommercial',
  'dataQuality',

  'delayLegs',
  'weeklyCohorts',
  'representantProductivity',
  'ambassadorConversion',
  'departementYield',
  'originBreakdown',
  'bankAging',

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
  conversionRate:
    'Part des prospects ayant livré une méthode d’enrôlement, rapportée au total filtré. Le classement isole les téléconseillers qui obtiennent le plus souvent une suite exploitable.',
  methodRate:
    'Nombre de prospects déjà passés au statut Converti, avec leur part dans la sélection courante.',
  dailyAverage:
    'Moyenne de fiches enregistrées par jour sur les 30 derniers jours, filtres compris.',
  weeklyPace:
    'Écart entre les 7 derniers jours et le rythme des trois semaines précédentes. Un chiffre positif signale une accélération.',
  prospectsOverTime:
    'Total cumulé des fiches depuis le début de la période filtrée. La pente indique le rythme de saisie.',
  topTeleconseillers:
    'Fiches apportées par chaque téléconseiller. Le graphique voisin les trie par taux de méthode obtenue.',
  parStatutPhase2:
    'Répartition des prospects entre les quatre issues de la phase 3 (Conversion). Les statuts sans prospect apparaissent à zéro.',
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

  campaignContactRate:
    'Part des fiches de la campagne ayant reçu au moins un appel. Elle mesure l’avancement du travail, pas son résultat.',
  campaignReachRate:
    'Part des appels de conversion qui ont abouti à quelqu’un. Les numéros injoignables et les faux numéros en sont exclus : ils disent la qualité de la liste, pas celle du téléconseil.',
  campaignAttemptsPerMethod:
    'Nombre moyen d’appels de conversion nécessaires pour qu’un prospect dise comment il adhère. Plus il monte, plus la liste résiste.',
  campaignRemaining:
    'Fiches encore à appeler, et date de fin projetée à la cadence des sept derniers jours. Sans cadence observée, aucune date n’est annoncée.',
  campaignClosedPerDay:
    'Fiches clôturées chaque jour, tous téléconseillers confondus. La pente donne la cadence réelle de la campagne.',
  campaignClosedPerCommercial:
    'Fiches clôturées par chaque téléconseiller. Le classement porte sur les fiches abouties, pas sur le nombre d’appels passés.',
  dataQuality:
    'Part de numéros injoignables ou erronés, par représentant ayant apporté les fiches. Elle désigne l’origine d’une base inexploitable.',

  delayLegs:
    'Durées médianes des trois tronçons de la chaîne, du prospect saisi au dossier encaissé. La médiane, et non la moyenne, pour qu’un dossier oublié six mois ne déplace pas le chiffre.',
  weeklyCohorts:
    'Suivi des prospects par semaine d’entrée, jusqu’à l’encaissement. La seule mesure qui distingue une amélioration réelle d’un simple effet de volume.',
  representantProductivity:
    'Prospects apportés par représentant et part convertie. Un représentant dormant n’a rien apporté depuis le seuil indiqué.',
  ambassadorConversion:
    'Part des représentants passés ambassadeurs, rapportée aux seuls représentants dont la relation a bougé sur la période. La date retenue est celle de la bascule, pas celle de son enregistrement.',
  departementYield:
    'Rendement par département : conversion et montant encaissé, pas seulement volume de fiches.',
  originBreakdown:
    'Répartition des fiches selon leur provenance. Une fiche née d’une demande bancaire n’a pas de représentant de terrain, et se compte à part.',
  bankAging:
    'Ancienneté des dossiers encore ouverts, par étape. Elle désigne l’étape qui bloque, là où l’entonnoir ne donne qu’un volume.',

  moneyCashed:
    'Somme des montants des dossiers encaissés, sur la sélection courante. C’est la seule étape de la chaîne qui rapporte.',
  moneyCashed30Days: 'Montants encaissés au cours des trente derniers jours.',
  moneyAverageCashing: 'Montant moyen d’un dossier encaissé, sur la sélection courante.',
  moneyRejectionRate:
    'Part des dossiers clos qui ont été rejetés. Les dossiers encore ouverts n’entrent pas dans le calcul.',
  funnelStages:
    'Effectif restant à chaque étape, du prospect saisi au dossier encaissé. Le taux indiqué est celui de l’étape précédente.',
};

export function explain(key: StatKey): string {
  return STAT_EXPLANATIONS[key];
}
