import { Prisma } from '@crm/database';

import { tryNormalizePhone } from '../../common/phone.js';
import { normalizeReferenceKey } from './reference-key.js';
import { BankCaseSortField } from './dto.js';
import type { BankCaseFilterDto } from './dto.js';
import { SortOrder } from '../../common/dto/prospect-filter.dto.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';

/**
 * SOURCE UNIQUE du filtrage Banque & Finance.
 *
 * La liste, les agrégats et l'export Excel passent tous par ces mêmes
 * conditions SQL, la liste va jusqu'à sélectionner ses identifiants par cette
 * requête avant de les hydrater par Prisma. C'est ce qui rend vraie, et non
 * seulement souhaitable, l'égalité entre les compteurs du tableau de bord et le
 * contenu du tableau : il n'existe pas de seconde définition du filtre qui
 * pourrait dériver.
 *
 * Chaque valeur passe par `Prisma.sql`, donc par une requête paramétrée ;
 * aucun fragment n'est concaténé à la main.
 */

/**
 * Jointure commune. L'étape courante est toujours jointe : elle porte le type
 * (OPEN / CASHED / REJECTED) dont dépendent presque tous les compteurs.
 */
export const BANK_CASE_FROM = Prisma.sql`
  FROM "bank_cases" c
  INNER JOIN "bank_case_stages" s ON s."id" = c."currentStageId"
`;

/**
 * Date d'ENTRÉE en étape terminale, lue dans l'historique.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI PAS `updatedAt`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `bank_cases."updatedAt"` bouge à CHAQUE écriture, y compris une correction de
 * montant ou de référence faite des mois plus tard. Un dossier encaissé en
 * janvier dont un administrateur rectifie l'orthographe du client en août
 * ressortait donc dans « encaissé sur 30 jours », et son délai de traitement
 * passait de trois jours à sept mois. La transition, elle, ne bouge jamais.
 *
 * `MAX` et non `MIN` : après une réouverture puis un nouvel encaissement, c'est
 * la dernière issue qui fait foi.
 *
 * Exporté et paramétré par l'alias du dossier plutôt que recopié : le tableau
 * de bord bancaire et l'entonnoir analytique doivent donner la MÊME date
 * d'encaissement, faute de quoi deux écrans annoncent deux montants pour le
 * même mois. Ce n'est pas un emprunt de commodité entre modules, c'est une
 * définition métier unique.
 *
 * Aucune condition de démonstration ici : une transition appartient toujours au
 * dossier qu'elle décrit, et l'appelant a déjà cloisonné ce dossier.
 */
export const closedAtLateral = (caseAlias: Prisma.Sql): Prisma.Sql => Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT MAX(bt."createdAt") AS "closedAt"
    FROM "bank_case_transitions" bt
    INNER JOIN "bank_case_stages" bs ON bs."id" = bt."toStageId"
    WHERE bt."caseId" = ${caseAlias}."id" AND bs."type" <> 'OPEN'
  ) cl ON TRUE
`;

export function bankCaseConditions(filter: BankCaseFilterDto, demoEnabled: boolean): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`c."deletedAt" IS NULL`];

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * LE DOSSIER *ET* SON CLIENT. Deux ecrans donnaient deux chiffres.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Seul `c."isDemo"` etait teste ici. Le tableau de bord, lui, part des
   * prospects (`PROSPECT_FROM` + `prospectConditions`) puis rejoint les
   * dossiers : il exige donc que le PROSPECT *et* le dossier soient reels.
   *
   * Un dossier marque reel accroche a un prospect marque fictif passait donc le
   * filtre ici et tombait la-bas. Observe en production : « Banques » annoncait
   * 1 encaisse pour 12 M FCFA pendant que le tableau de bord affichait 0 FCFA,
   * sur la meme base, au meme instant.
   *
   * ET C'EST L'EXTINCTION DE LA DEMONSTRATION QUI LE REVELE. Mode allume,
   * `demoScope()` rend `{}` : aucun des deux ecrans ne filtre, les deux regles
   * coincident, et le desaccord dort. Il n'apparait qu'une fois le mode eteint,
   * c'est-a-dire au moment ou les chiffres redeviennent ceux qu'on presente a
   * la direction.
   *
   * La regle retenue est la plus stricte des deux, parce que c'est la seule qui
   * se defend : un dossier accroche a un client fictif est fictif, quoi que
   * dise sa propre colonne. Le laisser dans un total d'encaissements reels
   * revient a annoncer de l'argent qui n'existe pas.
   *
   * `NOT EXISTS` plutot qu'une jointure : cette fonction sert des requetes qui
   * ne joignent pas toutes `prospects` (comptages, agregats par banque, par
   * motif de rejet). Une condition portant sur un alias absent ferait echouer
   * le SQL au lieu de le cloisonner.
   */
  if (!demoEnabled) {
    conditions.push(Prisma.sql`c."isDemo" = FALSE`);
    conditions.push(
      Prisma.sql`NOT EXISTS (
        SELECT 1 FROM "prospects" dp
        WHERE dp."id" = c."prospectId" AND dp."isDemo" = TRUE
      )`,
    );
  }

  if (filter.stageId) conditions.push(Prisma.sql`c."currentStageId" = ${filter.stageId}`);
  if (filter.stageType) {
    conditions.push(Prisma.sql`s."type" = ${filter.stageType}::"BankStageType"`);
  }
  if (filter.banqueId) conditions.push(Prisma.sql`c."processingBankId" = ${filter.banqueId}`);
  if (filter.rejectionReasonId) {
    conditions.push(Prisma.sql`c."rejectionReasonId" = ${filter.rejectionReasonId}`);
  }
  if (filter.agentId) {
    // Créateur OU dernier intervenant : l'agent qui a fait avancer un dossier
    // ouvert par un collègue doit le retrouver dans « mes dossiers ».
    conditions.push(
      Prisma.sql`(c."createdById" = ${filter.agentId} OR c."updatedById" = ${filter.agentId})`,
    );
  }
  if (filter.dateFrom)
    conditions.push(Prisma.sql`c."createdAt" >= ${inclusiveDateFrom(filter.dateFrom)}`);
  if (filter.dateTo)
    conditions.push(Prisma.sql`c."createdAt" <= ${inclusiveDateTo(filter.dateTo)}`);

  // Un filtre de montant ne peut pas retenir un dossier ouvert : son montant est
  // NULL par construction, et NULL n'est ni supérieur ni inférieur à une borne.
  if (filter.amountMin !== undefined) {
    conditions.push(Prisma.sql`c."amountXof" >= ${filter.amountMin}::numeric`);
  }
  if (filter.amountMax !== undefined) {
    conditions.push(Prisma.sql`c."amountXof" <= ${filter.amountMax}::numeric`);
  }

  const search = filter.search?.trim();
  if (search) {
    const like = `%${search}%`;
    const referenceLike = `%${normalizeReferenceKey(search)}%`;
    // Le téléphone est cherché sous sa forme normalisée quand la saisie en
    // constitue une, sinon sur les seuls chiffres, « 77 12 » doit répondre.
    //
    // QUATRE CHIFFRES AU MOINS, et le seuil n'est pas cosmétique : une référence
    // comme « BNK-2026-3 » laisse le résidu « 20263 », mais « DOS-3 » ne laisse
    // que « 3 ». Sous un seuil plus bas, chercher une référence alphanumérique
    // ferait joindre TOUS les numéros contenant ce chiffre, et la recherche par
    // référence deviendrait un filtre au hasard. C'est le même seuil que
    // l'autocomplétion des prospects, pour que les deux écrans répondent pareil.
    const digits = search.replace(/\D/gu, '');
    const normalized = tryNormalizePhone(search);
    const phoneLike = `%${normalized ?? digits}%`;
    const phoneCondition =
      normalized !== undefined || digits.length >= 4
        ? Prisma.sql`OR c."customerPhoneE164" LIKE ${phoneLike}`
        : Prisma.sql``;

    conditions.push(Prisma.sql`(
      c."referenceKey" LIKE ${referenceLike}
      OR unaccent(lower(c."customerName")) LIKE unaccent(lower(${like}))
      ${phoneCondition}
    )`);
  }

  return Prisma.join(conditions, ' AND ');
}

/** Colonne de tri. Fermée sur une énumération : jamais la chaîne reçue. */
export function bankCaseOrderBy(
  sortBy: BankCaseSortField | undefined,
  sortOrder: SortOrder | undefined,
): Prisma.Sql {
  const column =
    sortBy === BankCaseSortField.UPDATED_AT
      ? Prisma.sql`c."updatedAt"`
      : sortBy === BankCaseSortField.REFERENCE
        ? Prisma.sql`c."referenceKey"`
        : sortBy === BankCaseSortField.CUSTOMER_NAME
          ? Prisma.sql`c."customerName"`
          : sortBy === BankCaseSortField.AMOUNT
            ? Prisma.sql`c."amountXof"`
            : Prisma.sql`c."createdAt"`;

  const direction = sortOrder === SortOrder.ASC ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  // `c."id"` en second critère : sans lui, deux dossiers créés dans la même
  // milliseconde peuvent changer de page entre deux requêtes et l'un des deux
  // n'apparaît jamais.
  return Prisma.sql`ORDER BY ${column} ${direction} NULLS LAST, c."id" ${direction}`;
}
