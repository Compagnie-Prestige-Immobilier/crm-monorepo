import { segmentWhere } from '@crm/database';
import type { Prisma } from '@crm/database';

import type { AuthenticatedUser } from './decorators/current-user.decorator.js';
import { isAdmin, ownerScope } from './scope.js';
import { tryNormalizePhone } from './phone.js';
import type { ProspectFilterDto } from './dto/prospect-filter.dto.js';

/**
 * Traduit le filtre commun en clause `where` Prisma, cloisonnement compris.
 *
 * Fonction unique partagée par la liste, les agrégats analytiques et l'export :
 * c'est ce qui garantit qu'un total affiché sur le tableau de bord correspond
 * exactement au nombre de lignes du fichier exporté. Le cloisonnement est
 * appliqué ICI et non chez l'appelant, pour qu'aucun futur endpoint construit
 * sur ce filtre ne puisse l'omettre.
 */
export function buildProspectWhere(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  filter: ProspectFilterDto,
): Prisma.ProspectWhereInput {
  const where: Prisma.ProspectWhereInput = {
    // Le cloisonnement d'abord : il n'est jamais surchargeable par un filtre.
    ...ownerScope(user),
  };

  // `commercialId` ne peut qu'AFFINER la portée. Un COMMERCIAL qui le
  // renseigne avec l'identifiant d'un collègue obtient un ensemble vide, pas
  // les lignes du collègue — l'intersection avec `ownerScope` s'en charge.
  if (filter.commercialId) {
    where.createdById = isAdmin(user)
      ? filter.commercialId
      : filter.commercialId === user.id
        ? user.id
        : '__aucun__';
  }

  // Seul un ADMIN peut demander à voir les lignes supprimées logiquement.
  if (!(filter.includeDeleted && isAdmin(user))) {
    where.deletedAt = null;
  }

  if (filter.representantId) where.representantId = filter.representantId;
  if (filter.banqueId) where.banqueId = filter.banqueId;
  if (filter.syndicatId) where.syndicatId = filter.syndicatId;
  if (filter.statut) where.statut = filter.statut;
  if (filter.phase2Status) where.phase2Status = filter.phase2Status;
  if (filter.enrollmentMethod) where.enrollmentMethod = filter.enrollmentMethod;
  if (filter.enrollmentCapturedById) {
    where.enrollmentCapturedById = filter.enrollmentCapturedById;
  }
  if (filter.departementId) {
    where.representant = { departementId: filter.departementId };
  }

  // Les clauses relationnelles passent par `AND` plutôt que par des clés de
  // premier niveau : elles portent `syndicat`/`banque`, que le filtre par
  // segment porte aussi, et une affectation directe en écraserait une.
  const and: Prisma.ProspectWhereInput[] = [];

  // Le segment vient de `segmentWhere` (@crm/database), UNIQUE définition du
  // croisement CHUES × CBAO. Aucune clause syndicat/banque n'est réécrite ici :
  // sinon un onglet « BDD1 » et un graphique « BDD1 » finiraient par ne plus
  // décrire la même population, sans que rien ne le signale.
  if (filter.segment) and.push(segmentWhere(filter.segment));

  // Appartenance à une campagne : elle se lit par la relation `callTasks`, une
  // tâche par prospect et par campagne (contrainte unique en base).
  if (filter.campaignId) {
    and.push({ callTasks: { some: { campaignId: filter.campaignId } } });
  }

  if (and.length) where.AND = and;

  if (filter.dateFrom ?? filter.dateTo) {
    where.clientCreatedAt = {
      ...(filter.dateFrom ? { gte: new Date(filter.dateFrom) } : {}),
      ...(filter.dateTo ? { lte: new Date(filter.dateTo) } : {}),
    };
  }

  const search = filter.search?.trim();
  if (search) {
    // Un terme de recherche qui ressemble à un numéro est comparé à la forme
    // E.164 stockée : chercher « 77 123 45 67 » doit trouver « +221771234567 »,
    // sinon la recherche par téléphone ne fonctionne jamais depuis le panel.
    const asPhone = tryNormalizePhone(search);
    const digits = search.replace(/[^\d+]/g, '');

    where.OR = [
      { nom: { contains: search, mode: 'insensitive' } },
      { prenom: { contains: search, mode: 'insensitive' } },
      // La clause téléphone n'est posée QUE si le terme contient réellement des
      // chiffres. Sans ce garde-fou, un terme purement alphabétique réduit à la
      // chaîne vide devient `contains: ''`, soit `LIKE '%%'` en SQL — qui
      // matche TOUTES les lignes. La recherche « Diallo » renverrait alors la
      // base entière, et le filtre paraîtrait fonctionner tant que personne ne
      // cherche un nom absent.
      //
      // Seuil à 3 chiffres : en dessous, le fragment est trop court pour
      // désigner un numéro et ne fait que ramener du bruit.
      ...(digits.replace(/\D/g, '').length >= 3
        ? [{ phoneE164: { contains: asPhone ?? digits } }]
        : []),
    ];
  }

  return where;
}
