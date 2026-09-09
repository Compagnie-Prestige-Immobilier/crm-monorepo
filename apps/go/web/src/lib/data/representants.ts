import { apiClient, unwrap } from '@/api/client';
import type { components, operations } from '@/api/schema';
import type { FiltresRepresentants } from '@/components/representants/filtres';
import { sansNuls } from '@/lib/filtres-url';

export type Representant = components['schemas']['RepresentantDto'];
export type CreerRepresentant = components['schemas']['RepresentantCreateInputBody'];
export type ModifierRepresentant = components['schemas']['RepresentantUpdateInputBody'];
export type RelationRepresentant = Representant['relationStatus'];
export type IssueAppelRepresentant = NonNullable<Representant['lastCallOutcome']>;
export type AppelRepresentant = components['schemas']['RepresentantCallAttemptDto'];
export type CommentaireRepresentant = components['schemas']['RepresentantCommentDto'];
export type BasculeRelation = components['schemas']['RepresentantRelationChangeDto'];
export type VersionFiche = components['schemas']['RepresentantFicheChangeDto'];
export type StatutWhatsapp = Representant['whatsappStatus'];

export const LIBELLES_ISSUE_APPEL: Record<IssueAppelRepresentant, string> = {
  REACHED: 'Joint',
  PROSPECTS_PROMISED: 'Prospects promis',
  UNREACHABLE: 'Injoignable',
  CALLBACK: 'Rappel demandé',
  REFUSED: 'Refus',
  WRONG_NUMBER: 'Mauvais numéro',
  OTHER: 'Autre',
};

export const LIBELLES_WHATSAPP: Record<StatutWhatsapp, string> = {
  NON_DEMANDE: 'Non demandé',
  MEME_NUMERO: 'Le même que son téléphone',
  AUTRE_NUMERO: 'Un autre numéro',
  AUCUN: 'Pas de WhatsApp',
};

export const STATUTS_WHATSAPP: readonly StatutWhatsapp[] = [
  'NON_DEMANDE',
  'MEME_NUMERO',
  'AUTRE_NUMERO',
  'AUCUN',
];

export const PROFESSIONS = [
  'Instituteur',
  'Professeur',
  'Directeur d’école',
  'Principal',
  'Proviseur',
  'Inspecteur',
  'Personnel administratif',
] as const;

export function libelleWhatsapp(representant: Representant): string {
  if (representant.whatsappStatus === 'AUTRE_NUMERO' && representant.whatsappNumber !== null) {
    return representant.whatsappNumber;
  }
  return LIBELLES_WHATSAPP[representant.whatsappStatus];
}

const debutDeJour = (date: string): string => `${date}T00:00:00.000Z`;
const finDeJour = (date: string): string => `${date}T23:59:59.999Z`;

type Requete = NonNullable<operations['listRepresentants']['parameters']['query']>;

const ouiNon = (valeur: boolean | null): 'true' | 'false' | null => {
  if (valeur === null) return null;
  return valeur ? 'true' : 'false';
};

function versRequete(filtres: FiltresRepresentants): Requete {
  const search = filtres.search.trim();
  return {
    page: filtres.page,
    pageSize: filtres.pageSize,
    sortBy: filtres.sortBy,
    sortOrder: filtres.sortDir,
    ...sansNuls({
      search: search === '' ? null : search,
      departementId: filtres.departementId,
      iefId: filtres.iefId,
      commercialId: filtres.commercialId,
      dateFrom: filtres.dateFrom === null ? null : debutDeJour(filtres.dateFrom),
      dateTo: filtres.dateTo === null ? null : finDeJour(filtres.dateTo),
      hasProspects: ouiNon(filtres.hasProspects),
      statutQualificationId: filtres.statutQualificationId,
      relationStatus: filtres.relationStatus === null ? null : [filtres.relationStatus],
    }),
  };
}

export interface PageRepresentants {
  items: Representant[];
  total: number;
  page: number;
  pageCount: number;
}

export async function fetchRepresentants(
  filtres: FiltresRepresentants,
): Promise<PageRepresentants> {
  const page = unwrap(
    await apiClient.GET('/api/v1/representants', { params: { query: versRequete(filtres) } }),
  );
  return { items: page.items ?? [], ...page.meta };
}

export async function fetchRepresentant(id: string): Promise<Representant> {
  return unwrap(await apiClient.GET('/api/v1/representants/{id}', { params: { path: { id } } }));
}

export async function creerRepresentant(body: CreerRepresentant): Promise<Representant> {
  return unwrap(await apiClient.POST('/api/v1/representants', { body }));
}

/** `rev` est obligatoire : sans lui le serveur répond 409 `REV_CONFLICT`. */
export async function modifierRepresentant(
  id: string,
  body: ModifierRepresentant,
): Promise<Representant> {
  return unwrap(
    await apiClient.PATCH('/api/v1/representants/{id}', { params: { path: { id } }, body }),
  );
}

export async function chercherRepresentantParNumero(
  phone: string,
): Promise<components['schemas']['RepresentantLookupOutputBody']> {
  return unwrap(
    await apiClient.GET('/api/v1/representants/lookup', { params: { query: { phone } } }),
  );
}

export async function fetchAppelsRepresentant(id: string): Promise<AppelRepresentant[]> {
  const sortie = unwrap(
    await apiClient.GET('/api/v1/representants/{id}/call-attempts', { params: { path: { id } } }),
  );
  return sortie.items ?? [];
}

export async function fetchBasculesRelation(id: string): Promise<BasculeRelation[]> {
  const sortie = unwrap(
    await apiClient.GET('/api/v1/representants/{id}/relation-history', {
      params: { path: { id } },
    }),
  );
  return sortie.items ?? [];
}

export async function fetchVersionsFiche(id: string): Promise<VersionFiche[]> {
  const sortie = unwrap(
    await apiClient.GET('/api/v1/representants/{id}/fiche-history', { params: { path: { id } } }),
  );
  return sortie.items ?? [];
}

export const cleCommentaires = (representantId: string) =>
  ['representants', 'detail', representantId, 'comments'] as const;

export async function fetchCommentaires(id: string): Promise<CommentaireRepresentant[]> {
  const sortie = unwrap(
    await apiClient.GET('/api/v1/representants/{id}/comments', {
      params: { path: { id }, query: { pageSize: 200 } },
    }),
  );
  return sortie.items ?? [];
}

export async function ajouterCommentaire(
  id: string,
  body: components['schemas']['RepresentantCommentInputBody'],
): Promise<CommentaireRepresentant> {
  return unwrap(
    await apiClient.POST('/api/v1/representants/{id}/comments', {
      params: { path: { id } },
      body,
    }),
  );
}

export async function supprimerCommentaire(id: string, commentId: string): Promise<void> {
  unwrap(
    await apiClient.DELETE('/api/v1/representants/{id}/comments/{commentId}', {
      params: { path: { id, commentId } },
    }),
  );
}

/**
 * UUID v7 posé par le CLIENT : il sert de clé d'idempotence, un envoi rejoué
 * après une coupure ne doit pas doubler le commentaire.
 */
export function nouvelIdCommentaire(): string {
  const at = Date.now().toString(16).padStart(12, '0');
  const alea = Array.from(crypto.getRandomValues(new Uint8Array(10)), (octet) =>
    octet.toString(16).padStart(2, '0'),
  ).join('');
  const variante = ((Number.parseInt(alea.slice(3, 4), 16) & 0x3) | 0x8).toString(16);
  return [
    at.slice(0, 8),
    at.slice(8, 12),
    `7${alea.slice(0, 3)}`,
    `${variante}${alea.slice(4, 7)}`,
    alea.slice(7, 19),
  ].join('-');
}

export type SuiviRepresentant = NonNullable<Requete['suivi']>;

export const SUIVI_TAILLE_PAGE = 100;

async function fetchPage(query: Requete): Promise<PageRepresentants> {
  const page = unwrap(await apiClient.GET('/api/v1/representants', { params: { query } }));
  return { items: page.items ?? [], ...page.meta };
}

/**
 * Ce que l'écran d'appel a le droit d'appeler : ses propres fiches et celles
 * qu'une campagne lui a confiées. Ce n'est pas un critère que l'utilisateur
 * pose, c'est la portée de l'écran, et elle vaut pour tous les rôles.
 */
export function fetchRepresentantsAQualifier(criteres: {
  search: string;
  relationStatus: RelationRepresentant | null;
  page: number;
}): Promise<PageRepresentants> {
  return fetchPage({
    mesFiches: true,
    ...(criteres.search === '' ? {} : { search: criteres.search }),
    ...(criteres.relationStatus === null ? {} : { relationStatus: [criteres.relationStatus] }),
    sortBy: 'fullName',
    sortOrder: 'asc',
    page: criteres.page,
    pageSize: 10,
  });
}

/** Le suivi n'a ni URL ni tri choisi : le serveur trie déjà par échéance. */
export function fetchRepresentantsSuivi(
  suivi: SuiviRepresentant,
  lastCallById: string | null,
): Promise<PageRepresentants> {
  return fetchPage({
    suivi,
    ...(lastCallById === null ? {} : { lastCallById }),
    page: 1,
    pageSize: SUIVI_TAILLE_PAGE,
  });
}

/** Ceux dont ce téléconseiller a passé le DERNIER appel, du plus récent au plus ancien. */
export function fetchRepresentantsAppeles(lastCallById: string): Promise<PageRepresentants> {
  return fetchPage({
    lastCallById,
    sortBy: 'lastCallAt',
    sortOrder: 'desc',
    page: 1,
    pageSize: SUIVI_TAILLE_PAGE,
  });
}
