import { Champ, type EvenementHistorique } from '@/components/historique/historique';
import type { ProspectJournalEntry } from '@/lib/data/prospects';
import { formatDateTime } from '@/lib/format';
import { PROSPECT_STATUT_LABELS, type ProspectStatut } from '@/lib/types';

type Variant = NonNullable<EvenementHistorique['variant']>;

/** Le titre d'une ligne du journal : ce qui s'est passé, en un mot. */
const ACTIONS: Record<string, { titre: string; categorie: 'fiche' | 'statut'; variant?: Variant }> =
  {
    'prospect.update': { titre: 'Fiche modifiée', categorie: 'fiche' },
    'prospect.import': {
      titre: 'Mise à jour depuis le classeur',
      categorie: 'fiche',
      variant: 'info',
    },
    'prospect.statut': { titre: 'Statut changé', categorie: 'statut', variant: 'info' },
    'prospect.date_corrigee': {
      titre: 'Date de création corrigée',
      categorie: 'fiche',
      variant: 'warning',
    },
    'prospect.reassign': { titre: 'Réaffectée', categorie: 'fiche' },
    'prospect.segment': { titre: 'Segment changé', categorie: 'statut' },
    'prospect.consentement': { titre: 'Consentement', categorie: 'statut' },
    'prospect.merge': { titre: 'Fusionnée', categorie: 'fiche' },
    'prospect.delete': { titre: 'Supprimée', categorie: 'fiche', variant: 'destructive' },
    'lot_export.hors_projet': {
      titre: 'Retirée de la campagne : hors projet',
      categorie: 'statut',
      variant: 'warning',
    },
    'prospect.requalification': {
      titre: 'Fiche requalifiée',
      categorie: 'statut',
      variant: 'info',
    },
    'prospect.requalification_encadrement': {
      titre: 'Requalifiée par l’encadrement',
      categorie: 'statut',
      variant: 'info',
    },
    'prospect.affectation': { titre: 'Suivi confié', categorie: 'fiche', variant: 'info' },
    'prospect.vendre': { titre: 'Vendue', categorie: 'statut', variant: 'success' },
    'prospect.suivi_rendez_vous': { titre: 'Suivi du rendez-vous', categorie: 'statut' },
  };

const LIBELLES: Record<string, string> = {
  statut: 'Statut',
  phase2Status: 'Classement',
  enrollmentMethod: 'Méthode d’enrôlement',
  projet: 'Projet',
  canalProvenanceId: 'Canal',
  remarqueImport: 'Note du classeur',
  plateformeDepuis: 'Plateforme depuis',
  clientCreatedAt: 'Créée le',
  importFeuille: 'Onglet du classeur',
  onglet: 'Onglet du classeur',
  regle: 'Règle appliquée',
  motif: 'Motif',
  assignedToId: 'Rappel porté par',
  teleconseillerId: 'Téléconseiller',
  position: 'Position dans la campagne',
  nom: 'Nom',
  prenom: 'Prénom',
  email: 'E-mail',
  phoneE164: 'Téléphone',
  profession: 'Profession',
  banqueId: 'Banque',
  syndicatId: 'Syndicat',
  representantId: 'Représentant',
  commercialId: 'Téléconseiller',
  issue: 'Rendez-vous',
  suiteRencontre: 'Suite après rencontre',
  reporteAt: 'Reporté au',
};

const PROJETS: Record<string, string> = { CHUES: 'CHUES', GRAND_PUBLIC: 'Grand Public' };

const REGLES: Record<string, string> = {
  inversion: 'jour et mois inversés dans le classeur',
  onglet: 'date prise sur l’onglet du classeur',
  sans_onglet: 'date à venir remplacée par la date d’import',
};

const estDateISO = (valeur: string): boolean => /^\d{4}-\d{2}-\d{2}T/u.test(valeur);

function lisible(cle: string, valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === '') return 'vide';
  if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non';
  if (typeof valeur !== 'string') return JSON.stringify(valeur);
  return lisibleTexte(cle, valeur);
}

function lisibleTexte(cle: string, valeur: string): string {
  if (cle === 'statut' && valeur in PROSPECT_STATUT_LABELS) {
    return PROSPECT_STATUT_LABELS[valeur as ProspectStatut];
  }
  if (cle === 'projet') return PROJETS[valeur] ?? valeur;
  if (cle === 'regle') return REGLES[valeur] ?? valeur;
  return estDateISO(valeur) ? formatDateTime(valeur) : valeur;
}

const libelle = (cle: string): string => LIBELLES[cle] ?? cle;

interface Changement {
  cle: string;
  avant: unknown;
  apres: unknown;
}

/** Seules les clés qui bougent, ou que l'après apporte : le reste ne dit rien. */
function changements(entree: ProspectJournalEntry): Changement[] {
  const cles = new Set([...Object.keys(entree.avant), ...Object.keys(entree.apres)]);
  return [...cles]
    .filter((cle) => cle !== 'prospectId')
    .map((cle) => ({ cle, avant: entree.avant[cle], apres: entree.apres[cle] }))
    .filter((c) => !(c.cle in entree.avant) || JSON.stringify(c.avant) !== JSON.stringify(c.apres));
}

const phrase = (c: Changement): string =>
  c.cle in LIBELLES || c.avant !== undefined
    ? `${libelle(c.cle)} : ${lisible(c.cle, c.avant)} → ${lisible(c.cle, c.apres)}`
    : `${libelle(c.cle)} : ${lisible(c.cle, c.apres)}`;

/** Une ligne du journal devient un événement de l'histoire, lisible sans connaître la base. */
export function evenementJournal(entree: ProspectJournalEntry): EvenementHistorique {
  const action = ACTIONS[entree.action] ?? { titre: entree.action, categorie: 'fiche' as const };
  const lignes = changements(entree);
  return {
    id: `journal-${entree.id}`,
    categorie: action.categorie,
    at: entree.at,
    titre: action.titre,
    ...(action.variant === undefined ? {} : { variant: action.variant }),
    resume: lignes.slice(0, 3).map(phrase).join(' · '),
    acteur: entree.auteur,
    detail: (
      <dl className="grid gap-3 sm:grid-cols-2">
        <Champ label="Le">{formatDateTime(entree.at)}</Champ>
        <Champ label="Par">{entree.auteur}</Champ>
        {lignes.map((c) => (
          <Champ key={c.cle} label={libelle(c.cle)}>
            {c.avant === undefined ? '' : `${lisible(c.cle, c.avant)} → `}
            {lisible(c.cle, c.apres)}
          </Champ>
        ))}
      </dl>
    ),
  };
}
