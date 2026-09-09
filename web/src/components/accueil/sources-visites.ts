import {
  classement,
  composition,
  croisement,
  cyclique,
  enValeurs,
  HEURES,
  JOURS,
  joursDePeriode,
  libelles,
  matrice,
  moisLabel,
  scalaire,
  serie,
  type SourceVisite,
} from '@/components/accueil/sources-visites-formes';

export type { SourceVisite };

const SOURCES_VISITES: Readonly<Record<string, SourceVisite>> = {
  'total-visites': scalaire(
    {
      label: 'Total des visites',
      question: 'Combien de visites ont été enregistrées ?',
      description: 'Le volume total sur la période choisie.',
    },
    (stats) => ({ libelle: 'Total des visites', valeur: stats.total }),
  ),
  'moyenne-journaliere': scalaire(
    {
      label: 'Moyenne journalière',
      question: 'À quel rythme les visites arrivent-elles ?',
      description: 'Le nombre moyen de visites par jour.',
    },
    (stats) => ({
      libelle: 'Moyenne journalière',
      valeur: Math.round((stats.total / joursDePeriode(stats.from, stats.to)) * 10) / 10,
    }),
  ),
  'jour-le-plus-charge': scalaire(
    {
      label: 'Jour le plus chargé',
      question: 'Quel jour reçoit le plus de visiteurs ?',
      description: 'Le jour où l’accueil a été le plus sollicité.',
    },
    (stats) => {
      const plusCharge = (stats.parJour ?? []).reduce<{ date: string; count: number } | null>(
        (max, point) => (max === null || point.count > max.count ? point : max),
        null,
      );
      return {
        libelle: plusCharge === null ? 'Aucune visite' : plusCharge.date,
        valeur: plusCharge?.count ?? 0,
      };
    },
  ),
  'par-entreprise': classement(
    {
      label: 'Par entreprise',
      question: 'Quelles entreprises viennent le plus ?',
      description: 'Comparer les volumes entre organismes.',
    },
    (stats) => enValeurs(stats.parEntreprise ?? []),
  ),
  'par-objet': classement(
    {
      label: 'Par objet',
      question: 'Pourquoi les visiteurs viennent-ils ?',
      description: 'Voir les demandes les plus fréquentes.',
    },
    (stats) => enValeurs(stats.parObjet ?? []),
  ),
  'par-direction': classement(
    {
      label: 'Par direction',
      question: 'Quelles directions sont le plus demandées ?',
      description: 'Comparer les volumes par direction.',
    },
    (stats) => enValeurs(stats.parDirection ?? []),
  ),
  'par-destinataire': classement(
    {
      label: 'Par destinataire',
      question: 'Qui reçoit le plus de visiteurs ?',
      description: 'Comparer les personnes ou services sollicités.',
    },
    (stats) => enValeurs(stats.parDestinataire ?? []),
  ),
  'par-agent': classement(
    {
      label: 'Par agent',
      question: 'Qui a enregistré le plus de visites ?',
      description: 'Comparer le nombre de saisies par agent d’accueil.',
    },
    (stats) => enValeurs(stats.parAgent ?? []),
  ),
  'visiteurs-recurrents': classement(
    {
      label: 'Visiteurs récurrents',
      question: 'Qui revient le plus souvent ?',
      description: 'Repérer les visiteurs qui reviennent régulièrement.',
    },
    (stats) =>
      (stats.recurrents ?? []).map((entree, index) => ({
        id: `${entree.nom}-${String(index)}`,
        label: entree.nom,
        value: entree.visites,
      })),
  ),
  'par-jour': serie(
    {
      label: 'Par jour',
      question: 'Les visites montent-elles ou baissent-elles ?',
      description: 'Suivre l’évolution jour après jour.',
    },
    (stats) =>
      [...(stats.parJour ?? [])]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((point) => ({ id: point.date, label: point.date, value: point.count })),
  ),
  'par-mois': serie(
    {
      label: 'Par mois',
      question: 'Quel est le rythme d’un mois à l’autre ?',
      description: 'Comparer les mois de la période.',
    },
    (stats) =>
      [...(stats.parMois ?? [])]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((point) => ({ id: point.month, label: moisLabel(point.month), value: point.count })),
  ),
  'par-heure': cyclique(
    {
      label: 'Par heure',
      question: 'À quelles heures l’accueil est-il le plus chargé ?',
      description: 'Repérer les heures qui demandent le plus de présence.',
    },
    (stats) => {
      const parHeure = new Map((stats.parHeure ?? []).map((point) => [point.hour, point.count]));
      return HEURES.map((label, heure) => ({
        id: String(heure),
        label,
        value: parHeure.get(heure) ?? 0,
      }));
    },
  ),
  'par-jour-semaine': cyclique(
    {
      label: 'Par jour de la semaine',
      question: 'Quels jours de la semaine sont les plus chargés ?',
      description: 'Comparer lundi, mardi et les autres jours.',
    },
    (stats) => {
      const parJour = new Map(
        (stats.parJourSemaine ?? []).map((point) => [point.weekday, point.count]),
      );
      return JOURS.map((label, index) => ({
        id: String(index + 1),
        label,
        value: parJour.get(index + 1) ?? 0,
      }));
    },
  ),
  'par-heure-jour-semaine': matrice(
    {
      label: 'Heure × jour de la semaine',
      question: 'Quel créneau est le plus chargé ?',
      description: 'Lire le jour et l’heure ensemble.',
    },
    (stats) => {
      const cellules = new Map(
        (stats.parHeureJourSemaine ?? []).map((point) => [
          `${String(point.weekday)}-${String(point.hour)}`,
          point.count,
        ]),
      );
      return {
        lignes: JOURS,
        colonnes: HEURES,
        cellules: JOURS.flatMap((jour, rang) =>
          HEURES.map((heure, index) => ({
            ligne: jour,
            colonne: heure,
            value: cellules.get(`${String(rang + 1)}-${String(index)}`) ?? 0,
          })),
        ),
      };
    },
  ),
  'par-entreprise-objet': matrice(
    {
      label: 'Entreprise × objet',
      question: 'Que demandent les visiteurs de chaque entreprise ?',
      description: 'Croiser l’entreprise et le motif de visite.',
    },
    (stats) =>
      croisement(
        stats.parEntrepriseObjet ?? [],
        libelles(stats.parEntreprise ?? []),
        libelles(stats.parObjet ?? []),
      ),
  ),
  'par-destinataire-direction': matrice(
    {
      label: 'Destinataire × direction',
      question: 'Quelle direction reçoit chaque demande ?',
      description: 'Croiser le destinataire et sa direction.',
    },
    (stats) =>
      croisement(
        stats.parDestinataireDirection ?? [],
        libelles(stats.parDestinataire ?? []),
        libelles(stats.parDirection ?? []),
      ),
  ),
  'par-objet-mois': matrice(
    {
      label: 'Objet × mois',
      question: 'Quels motifs augmentent selon les mois ?',
      description: 'Croiser le motif de visite et le mois.',
    },
    (stats) =>
      croisement(
        stats.parObjetMois ?? [],
        libelles(stats.parObjet ?? []),
        new Map((stats.parMois ?? []).map((point) => [point.month, moisLabel(point.month)])),
      ),
  ),
  'avec-telephone': composition(
    {
      label: 'Avec téléphone',
      question: 'Combien de fiches ont un numéro utilisable ?',
      description: 'Comparer les fiches avec et sans téléphone.',
    },
    (stats) => [
      { id: 'avec', label: 'Avec téléphone', value: stats.avecTelephone },
      {
        id: 'sans',
        label: 'Sans téléphone',
        value: Math.max(0, stats.total - stats.avecTelephone),
      },
    ],
    'Avec téléphone',
  ),
  'qualite-de-saisie': composition(
    {
      label: 'Qualité de saisie',
      question: 'Les visites sont-elles saisies à temps ?',
      description: 'Voir si la saisie est faite le jour même ou plus tard.',
    },
    (stats) => [
      { id: 'meme-jour', label: 'Le jour même', value: stats.saisieDifferee.memeJour },
      { id: 'lendemain', label: 'Le lendemain', value: stats.saisieDifferee.lendemain },
      { id: 'plus-tard', label: 'Plus tard', value: stats.saisieDifferee.plusTard },
    ],
    'Délai de saisie',
  ),
};

export function catalogueVisites(): Readonly<Record<string, SourceVisite>> {
  return SOURCES_VISITES;
}
