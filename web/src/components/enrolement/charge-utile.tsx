'use client';

import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/format';

export const ABSENT = 'Non renseigné';

export function scalaire(valeur: unknown): string | null {
  if (valeur === null) return ABSENT;
  if (typeof valeur === 'string') return valeur === '' ? ABSENT : valeur;
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
        <Case key={cle} cle={cle}>
          {scalaire(sous) === null ? <ImbriquE valeur={sous} /> : <Valeur valeur={sous} />}
        </Case>
      ))}
    </Grille>
  );
}

/** Un objet à l'intérieur d'un objet reste rare : il se lit à plat plutôt qu'en cascade. */
function ImbriquE({ valeur }: { valeur: unknown }) {
  const elements = Array.isArray(valeur) ? valeur : [valeur];
  return (
    <ul className="flex flex-col gap-1">
      {elements.map((element, rang) => (
        <li key={rang} className="text-[0.8125rem] text-muted-foreground">
          {JSON.stringify(element)}
        </li>
      ))}
    </ul>
  );
}

function titreElement(element: unknown, rang: number): string {
  const libelle =
    typeof element === 'object' && element !== null
      ? (element as Record<string, unknown>)['label']
      : null;
  return typeof libelle === 'string' && libelle !== '' ? libelle : `Élément ${String(rang + 1)}`;
}

function etatElement(element: unknown): string | null {
  const etat =
    typeof element === 'object' && element !== null
      ? (element as Record<string, unknown>)['status']
      : null;
  return typeof etat === 'string' && etat !== '' ? etat : null;
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

export function libelleOnglet(cle: string, compte: number | null): string {
  return compte === null ? cle : `${cle} (${formatNumber(compte)})`;
}
