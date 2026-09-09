import { apiClient, unwrap } from '@/api/client';
import type { components, operations } from '@/api/schema';

export type Rappel = components['schemas']['QualificationRappelDTO'];
export type RappelScope = NonNullable<
  NonNullable<operations['listScheduledCallbacks']['parameters']['query']>['scope']
>;

export interface RappelListe {
  readonly items: Rappel[];
  readonly serverTime: string;
}

/** L'heure promise croissante : le retard étant une heure dépassée, il vient en tête. */
function trier(items: readonly Rappel[]): Rappel[] {
  return [...items].sort((gauche, droite) => {
    if (gauche.scheduledAt !== droite.scheduledAt) {
      return gauche.scheduledAt < droite.scheduledAt ? -1 : 1;
    }
    return gauche.id < droite.id ? -1 : 1;
  });
}

export async function fetchRappels(
  scope: RappelScope,
  projet: 'CHUES' | 'GRAND_PUBLIC',
  assignedToId: string | null,
): Promise<RappelListe> {
  const liste = unwrap(
    await apiClient.GET('/api/v1/phase2/callbacks', {
      params: {
        query: { scope, projet, ...(assignedToId === null ? {} : { assignedToId }) },
      },
    }),
  );
  return { items: trier(liste.items ?? []), serverTime: liste.serverTime };
}

export async function annulerRappel(id: string): Promise<Rappel> {
  return unwrap(
    await apiClient.POST('/api/v1/phase2/callbacks/{id}/cancel', { params: { path: { id } } }),
  );
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const DAKAR_UTC_OFFSET = '+00:00';

/** Dakar est à UTC+0 toute l'année : les accesseurs UTC SONT l'horloge métier. */
function dakarAt(now: number, plusDays: number, hour: number): number {
  const jour = new Date(now);
  jour.setUTCDate(jour.getUTCDate() + plusDays);
  jour.setUTCHours(hour, 0, 0, 0);
  return jour.getTime();
}

function joursAvantLundi(now: number): number {
  const jour = new Date(now).getUTCDay();
  return jour === 1 ? 7 : (8 - jour) % 7;
}

const pad = (valeur: number): string => String(valeur).padStart(2, '0');

/** Une saisie `datetime-local` se lit à l'heure de Dakar, pas à celle du poste. */
export function dakarLocalToIso(local: string): string | null {
  const saisie = local.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/u.test(saisie)) return null;
  const complet = saisie.length === 16 ? `${saisie}:00` : saisie;
  const lu = new Date(`${complet}${DAKAR_UTC_OFFSET}`);
  return Number.isNaN(lu.getTime()) ? null : lu.toISOString();
}

export function formatCallbackAt(iso: string, now: number): string {
  const at = new Date(iso);
  const heure = `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
  const jours = Math.floor((at.getTime() - dakarAt(now, 0, 0)) / DAY_MS);

  if (jours === 0) return `aujourd’hui à ${heure}`;
  if (jours === 1) return `demain à ${heure}`;
  return `le ${pad(at.getUTCDate())}/${pad(at.getUTCMonth() + 1)} à ${heure}`;
}

export function formatDelay(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${String(minutes)} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `${String(heures)} h`;
  return `${String(Math.floor(heures / 24))} j`;
}

export interface CreneauRappel {
  readonly key: string;
  readonly label: string;
  readonly at: string;
}

/**
 * Zéro saisie : l'échéance se prend au chiffre. Une proposition déjà passée, ou
 * qui tombe à la même heure qu'une précédente, ne s'affiche pas.
 */
export function callbackSlots(now: number): CreneauRappel[] {
  const propositions: readonly (readonly [string, number])[] = [
    ['Dans 1 h', now + HOUR_MS],
    ['Cet après-midi (15 h)', dakarAt(now, 0, 15)],
    ['Demain 9 h', dakarAt(now, 1, 9)],
    ['Demain 15 h', dakarAt(now, 1, 15)],
    ['Lundi 9 h', dakarAt(now, joursAvantLundi(now), 9)],
    ['Dans 3 jours', dakarAt(now, 3, 9)],
  ];

  const creneaux: CreneauRappel[] = [];
  for (const [label, at] of propositions) {
    if (at <= now) continue;
    if (creneaux.some((creneau) => Date.parse(creneau.at) === at)) continue;
    creneaux.push({ key: String(creneaux.length + 1), label, at: new Date(at).toISOString() });
  }
  return creneaux;
}

/**
 * Les demi-heures ouvrées d'un jour, de 08 h 00 à 19 h 00, celles déjà passées
 * retirées : un rappel se prend à la demi-heure, jamais à la minute.
 */
export function callbackHalfHours(now: number, jour: string): CreneauRappel[] {
  const creneaux: CreneauRappel[] = [];
  for (let demi = 16; demi <= 38; demi++) {
    const at = Date.parse(
      `${jour}T${pad(Math.floor(demi / 2))}:${demi % 2 === 0 ? '00' : '30'}:00Z`,
    );
    if (Number.isNaN(at) || at <= now) continue;
    const instant = new Date(at);
    creneaux.push({
      key: String(creneaux.length + 1),
      label: `${pad(instant.getUTCHours())} h ${pad(instant.getUTCMinutes())}`,
      at: instant.toISOString(),
    });
  }
  return creneaux;
}
