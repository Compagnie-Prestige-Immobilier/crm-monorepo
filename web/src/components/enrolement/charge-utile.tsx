'use client';

import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';

export const ABSENT = 'Non renseigné';

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Les codes d'état des deux plateformes : CHUES les écrit en anglais, Grand Public en français. */
const ETATS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  draft: 'Brouillon',
  submitted: 'Déposé',
  in_review: 'En vérification',
  needs_correction: 'À corriger',
  dfc_review: 'Revue DFC',
  validated: 'Validé',
  missing: 'Manquant',
  rejected: 'Refusé',
  transmitted: 'Transmis',
  under_review: 'En examen',
  accepted: 'Accepté',
  refused: 'Refusé',
  completed: 'Terminé',
  resolved: 'Traitée',
  to_public: 'Orientée Grand Public',
  released: 'Inscription ouverte',
  not_called: 'Pas encore appelé',
  reached: 'Joint',
  to_call_back: 'À rappeler',
  unreachable: 'Injoignable',
  declined: 'Ne donne pas suite',
  no_answer_1: 'Sans réponse (1)',
  no_answer_2: 'Sans réponse (2)',
  disponible: 'Disponible',
  reserve: 'Réservé',
  vendu: 'Vendu',
  valide: 'Validé',
  rejete: 'Rejeté',
  accepte: 'Acceptée',
  'en-attente': 'En attente',
  depose: 'Déposée',
  verification: 'En vérification',
  'a-remplacer': 'À remplacer',
  refuse: 'Refusée',
  in_person: 'En personne',
  whatsapp: 'WhatsApp',
  other: 'Autre',
};

function texteScalaire(valeur: string): string {
  if (valeur === '') return ABSENT;
  if (JOUR.test(valeur)) return formatDate(valeur);
  if (INSTANT.test(valeur)) return formatDateTime(valeur);
  return ETATS[valeur] ?? valeur;
}

export function scalaire(valeur: unknown): string | null {
  if (valeur === null) return ABSENT;
  if (typeof valeur === 'string') return texteScalaire(valeur);
  if (typeof valeur === 'number') return String(valeur);
  if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non';
  return null;
}

/** Une adresse signée fait sept cents caractères : la ligne reste lisible, la valeur reste entière. */
function Adresse({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={url}
      className="block truncate underline underline-offset-4"
    >
      {url}
    </a>
  );
}

/**
 * Étiquette au-dessus de la valeur, deux colonnes : l'oeil apparie les deux
 * sans traverser la largeur, et un objet de treize champs tient sur un écran.
 */
export function Grille({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-8 sm:grid-cols-2">{children}</dl>;
}

export function Case({ cle, children }: { cle: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 py-2">
      <dt className="text-[0.75rem] text-muted-foreground">{cle}</dt>
      <dd className="mt-0.5 min-w-0 break-words text-[0.875rem]">{children}</dd>
    </div>
  );
}

function Valeur({ valeur }: { valeur: unknown }) {
  const texte = scalaire(valeur) ?? '';
  if (typeof valeur === 'string' && valeur.startsWith('http')) return <Adresse url={valeur} />;
  return <span className={texte === ABSENT ? 'text-muted-foreground' : ''}>{texte}</span>;
}

export function Champs({ valeur }: { valeur: unknown }) {
  if (typeof valeur !== 'object' || valeur === null) return null;
  return (
    <Grille>
      {Object.entries(valeur as Record<string, unknown>).map(([cle, sous]) => (
        <Case key={cle} cle={libelleCle(cle)}>
          {scalaire(sous) === null ? <ImbriquE valeur={sous} /> : <Valeur valeur={sous} />}
        </Case>
      ))}
    </Grille>
  );
}

/** Une personne (`{id, nom}`) se lit par son nom ; un autre objet par ses champs renseignés. */
function resume(valeur: unknown): string {
  const direct = scalaire(valeur);
  if (direct !== null) return direct;
  if (Array.isArray(valeur)) return valeur.map(resume).join(' ; ') || ABSENT;
  const champs = valeur as Record<string, unknown>;
  if (typeof champs['nom'] === 'string') return champs['nom'];
  const renseignes = Object.entries(champs)
    .filter(([, sous]) => sous !== null && sous !== '')
    .map(([cle, sous]) => `${libelleCle(cle)} : ${resume(sous)}`);
  return renseignes.length === 0 ? ABSENT : renseignes.join(' · ');
}

/** Un objet dans un objet se lit en lignes « Libellé : valeur », jamais en JSON. */
function ImbriquE({ valeur }: { valeur: unknown }) {
  const elements = Array.isArray(valeur) ? valeur : [valeur];
  if (elements.length === 0) return <span className="text-muted-foreground">{ABSENT}</span>;
  return (
    <ul className="flex flex-col gap-1">
      {elements.map((element, rang) => {
        const texte = resume(element);
        return (
          <li key={rang} className={texte === ABSENT ? 'text-muted-foreground' : ''}>
            {texte}
          </li>
        );
      })}
    </ul>
  );
}

/** Le premier des champs nommés qui porte un texte : les anciennes fiches disent `label`, le flux `libelle`. */
function texteDe(element: unknown, cles: readonly string[]): string | null {
  if (typeof element !== 'object' || element === null) return null;
  for (const cle of cles) {
    const valeur = (element as Record<string, unknown>)[cle];
    if (typeof valeur === 'string' && valeur !== '') return valeur;
  }
  return null;
}

function titreElement(element: unknown, rang: number): string {
  return texteDe(element, ['libelle', 'label']) ?? `Élément ${String(rang + 1)}`;
}

function etatElement(element: unknown): string | null {
  const etat = texteDe(element, ['statut', 'status']);
  return etat === null ? null : texteScalaire(etat);
}

/**
 * Une carte par élément, coiffée du libellé et de l'état que la plateforme
 * envoie. Les deux sont repris tels quels, et restent listés dans la grille :
 * l'en-tête sert à repérer la carte, il ne remplace aucun champ.
 */
export function Liste({ elements }: { elements: readonly unknown[] }) {
  return (
    <div className="flex flex-col gap-4">
      {elements.map((element, rang) => {
        const etat = etatElement(element);
        return (
          <section key={rang} className="rounded-md border border-border/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-[600]">{titreElement(element, rang)}</p>
              {etat === null ? null : <Badge variant="outline">{etat}</Badge>}
            </div>
            <div className="mt-2">
              <Champs valeur={element} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function ongletsChargeUtile(charge: unknown): { cle: string; compte: number | null }[] {
  if (typeof charge !== 'object' || charge === null) return [];
  return Object.entries(charge as Record<string, unknown>)
    .filter(([, valeur]) => scalaire(valeur) === null)
    .map(([cle, valeur]) => ({ cle, compte: Array.isArray(valeur) ? valeur.length : null }));
}

export function champsPlats(charge: unknown): Record<string, unknown> {
  if (typeof charge !== 'object' || charge === null) return {};
  return Object.fromEntries(
    Object.entries(charge as Record<string, unknown>).filter(
      ([, valeur]) => scalaire(valeur) !== null,
    ),
  );
}

const LIBELLES: Record<string, string> = {
  decaissement: 'Financement',
  pieces: 'Pièces',
  prise_de_contact: 'Prise de contact',
  documents_cpi: 'Documents CPI',
  cgu: 'CGU',
  ref: 'Référence',
};

/** Le flux nomme ses champs en `snake_case` : « inscrit_le » se lit « Inscrit le ». */
function libelleCle(cle: string): string {
  const connu = LIBELLES[cle];
  if (connu !== undefined) return connu;
  const mots = cle.replace(/_/g, ' ');
  return mots.charAt(0).toUpperCase() + mots.slice(1);
}

export function libelleOnglet(cle: string, compte: number | null): string {
  const libelle = libelleCle(cle);
  return compte === null ? libelle : `${libelle} (${formatNumber(compte)})`;
}
