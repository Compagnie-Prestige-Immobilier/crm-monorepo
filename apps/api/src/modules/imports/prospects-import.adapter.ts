import { ImportKind, ImportMode, Phase2Status } from '@crm/database';
import type { EnrollmentMethod } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { tryNormalizePhone } from '../../common/phone.js';
import type {
  ChunkOutcome,
  ImportAdapter,
  ImportColumn,
  ImportRowError,
  ImportRunContext,
  ParsedRow,
} from './import-adapter.js';
import {
  ENROLLMENT_METHOD_TOKENS,
  PROSPECTS_IMPORT_COLUMNS,
  PROSPECT_IMPORT_HEADERS,
} from './prospects-import-template.js';
import {
  ProspectImportError,
  notPrepared,
  referentialAmbiguous,
  rowError,
} from './prospects-import.errors.js';

/**
 * Import de masse des prospects.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE CHEMIN EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Jusqu'ici un prospect n'entrait que d'une fiche à la fois : saisie web, ou
 * synchronisation depuis le mobile. Une reprise de données, un fichier remis
 * par un syndicat ou par une banque partenaire, n'avait aucune porte. Elle se
 * faisait donc en SQL manuel, hors de toute règle applicative : sans
 * normalisation du téléphone, donc sans déduplication réelle, et sans le
 * contrôle des trois clés étrangères obligatoires.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * L'ÉTAT DE FICHIER EST INDEXÉ PAR TRAVAIL, PAS PORTÉ PAR L'INSTANCE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'adaptateur est injecté en LISTE (`IMPORT_ADAPTERS`), donc en singleton : la
 * même instance peut servir deux imports. Une mémoire des téléphones déjà vus
 * posée directement sur l'instance ferait que deux fichiers se voleraient des
 * lignes en se déclarant doublons internes l'un de l'autre, sur des données
 * qu'ils n'ont jamais partagées.
 *
 * `parseRow` ne recevant pas le contexte, elle est tenue PURE : la
 * déduplication interne au fichier appartient donc à `writeChunk`, seule à
 * connaître `ctx.jobId`. C'est la discipline que le contrat prescrit et que
 * l'adaptateur représentants applique déjà.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * QUATRE FAMILLES DE DOUBLONS, TOUTES SUR LE TÉLÉPHONE NORMALISÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. le fichier contre LUI-MÊME : deux lignes du même classeur. Comparées sur
 *    la forme E.164 et non sur la chaîne saisie, sinon « 77 123 45 67 » et
 *    « +221771234567 » comptent pour deux personnes ;
 * 2. le fichier contre la BASE, même représentant : la fiche existe déjà,
 *    saisie en tournée. Refusée en erreur nommée ;
 * 3. la course contre l'index unique partiel
 *    `prospects_phone_e164_active_key` : entre notre lecture et notre
 *    écriture, un commercial a pu saisir la même fiche sur le terrain.
 *    `skipDuplicates` l'écarte, et l'écart est COMPTÉ EN `skipped`, pas en
 *    erreur : personne n'a rien fait de mal, la ligne existe simplement déjà ;
 * 4. la fiche existe déjà sous un AUTRE représentant. Refusée, nommée, et
 *    surtout jamais rerattachée en silence : le rattachement décide de qui
 *    touche la commission et de quel commercial suit l'appel. Le déplacer sur
 *    la foi d'un classeur, sans que personne ne l'ait décidé, se découvre des
 *    semaines plus tard, quand deux représentants revendiquent la même fiche.
 */
export class ProspectsImportAdapter implements ImportAdapter<ProspectImportRow> {
  readonly kind = ImportKind.PROSPECTS;

  /**
   * Plafond de lignes.
   *
   * Trente fois celui des représentants, parce que les deux populations n'ont
   * pas le même ordre de grandeur : un département compte quelques centaines
   * de représentants, chacun apportant des dizaines de prospects. Un fichier
   * de reprise couvrant une région entière tient dans ce plafond ; au-delà,
   * c'est une migration de base, qui relève d'un autre outil et d'une
   * fenêtre de maintenance.
   */
  readonly maxRows = 150_000;

  readonly templateColumns: readonly ImportColumn[] = PROSPECTS_IMPORT_COLUMNS;

  private referentials: ProspectImportReferentials | null = null;

  /**
   * Un état par travail en cours.
   *
   * `seen` associe un téléphone normalisé à la PREMIÈRE ligne où il est
   * apparu : c'est celle du haut du fichier que l'utilisateur reconnaît, donc
   * c'est elle qu'on garde et les suivantes qu'on refuse.
   */
  private readonly runs = new Map<string, ProspectImportRunState>();

  /**
   * Charge les trois référentiels UNE FOIS.
   *
   * Une résolution par ligne ferait cent cinquante mille allers-retours, et
   * saturerait le pool de connexions bien avant la fin du fichier. Les trois
   * tables tiennent en mémoire : quelques dizaines de banques, autant de
   * syndicats, quelques milliers de représentants.
   */
  async prepare(ctx: ImportRunContext): Promise<void> {
    // L'état repart à VIDE, y compris sur une reprise après incident : les
    // lignes déjà comptées sont sautées sans être relues par le moteur, donc
    // aucun de leurs téléphones ne doit rester en mémoire. Les garder ferait
    // refuser en « doublon interne » des lignes que la reprise n'a jamais vues.
    this.runs.set(ctx.jobId, { seen: new Map() });

    const [banques, syndicats, representants] = await Promise.all([
      ctx.tx.banque.findMany({
        where: { isActive: true },
        select: { id: true, shortName: true },
        orderBy: [{ sortOrder: 'asc' }, { shortName: 'asc' }],
      }),
      ctx.tx.syndicat.findMany({
        where: { isActive: true },
        select: { id: true, sigle: true },
        orderBy: [{ sortOrder: 'asc' }, { sigle: 'asc' }],
      }),
      // `isDemo: false` est un FILTRE, pas un oubli. Un prospect réel accroché
      // à un représentant de démonstration afficherait, dans la liste, un
      // représentant que l'annuaire ne connaît plus dès l'extinction du mode
      // démonstration. La ligne est alors signalée « représentant inconnu »,
      // ce qui est exactement ce qu'elle est du point de vue des vraies
      // données.
      ctx.tx.representant.findMany({
        where: { deletedAt: null, isDemo: false },
        select: { id: true, phoneE164: true },
      }),
    ]);

    this.referentials = {
      banques: indexByKey(
        banques.map((row) => [row.shortName, row.id]),
        PROSPECT_IMPORT_HEADERS.banque,
      ),
      banqueLabels: banques.map((row) => row.shortName),
      syndicats: indexByKey(
        syndicats.map((row) => [row.sigle, row.id]),
        PROSPECT_IMPORT_HEADERS.syndicat,
      ),
      syndicatLabels: syndicats.map((row) => row.sigle),
      // Les représentants sont indexés sur l'E.164, pas sur un libellé : la
      // normalisation de `phone.ts` est déjà appliquée des deux côtés, la clé
      // est donc exacte et ne demande aucun assouplissement. C'est aussi la
      // clé que le mobile emploie, ce qui garde les deux chemins d'accord.
      representants: new Map(representants.map((row) => [row.phoneE164, row.id])),
    };
  }

  parseRow(cells: Record<string, string>, rowNumber: number): ParsedRow<ProspectImportRow> {
    const refs = this.referentials;
    if (!refs) throw notPrepared();

    const nom = (cells[PROSPECT_IMPORT_HEADERS.nom] ?? '').trim();
    if (nom === '') {
      return {
        ok: false,
        error: rowError({
          rowNumber,
          column: PROSPECT_IMPORT_HEADERS.nom,
          code: ProspectImportError.NOM_REQUIRED,
          message: 'Le nom de famille est obligatoire, dans sa propre colonne.',
        }),
      };
    }

    // Pas de longueur minimale au-delà du non-vide, contrairement au modèle
    // représentants qui exige deux caractères : là-bas la colonne porte un nom
    // COMPLET, ici chaque moitié est contrôlée séparément et un prénom d'une
    // seule lettre est une orthographe légitime, pas une cellule bâclée.
    const prenom = (cells[PROSPECT_IMPORT_HEADERS.prenom] ?? '').trim();
    if (prenom === '') {
      return {
        ok: false,
        error: rowError({
          rowNumber,
          column: PROSPECT_IMPORT_HEADERS.prenom,
          code: ProspectImportError.PRENOM_REQUIRED,
          message: 'Le prénom est obligatoire, dans sa propre colonne.',
        }),
      };
    }

    const rawPhone = (cells[PROSPECT_IMPORT_HEADERS.phone] ?? '').trim();
    // `tryNormalizePhone` du module commun, JAMAIS une expression régulière
    // écrite ici : c'est la clé de déduplication partagée avec le mobile et
    // avec l'index unique partiel. Une seconde implémentation, même
    // équivalente aujourd'hui, ferait diverger les deux le jour où l'une des
    // deux gagne un indicatif.
    const phoneE164 = tryNormalizePhone(rawPhone);
    if (!phoneE164) {
      return {
        ok: false,
        error: rowError({
          rowNumber,
          column: PROSPECT_IMPORT_HEADERS.phone,
          code: ProspectImportError.PHONE_INVALID,
          message: `Numéro de téléphone inexploitable : « ${rawPhone} ».`,
        }),
      };
    }

    const rawRepPhone = (cells[PROSPECT_IMPORT_HEADERS.representantPhone] ?? '').trim();
    const representantPhoneE164 = tryNormalizePhone(rawRepPhone);
    if (!representantPhoneE164) {
      return {
        ok: false,
        error: rowError({
          rowNumber,
          column: PROSPECT_IMPORT_HEADERS.representantPhone,
          code: ProspectImportError.REPRESENTANT_PHONE_INVALID,
          message: `Numéro du représentant inexploitable : « ${rawRepPhone} ».`,
        }),
      };
    }

    const representantId = refs.representants.get(representantPhoneE164);
    if (representantId === undefined) {
      return {
        ok: false,
        error: rowError({
          rowNumber,
          column: PROSPECT_IMPORT_HEADERS.representantPhone,
          code: ProspectImportError.REPRESENTANT_UNKNOWN,
          message: `Aucun représentant actif ne porte le numéro ${representantPhoneE164}. Cet import ne crée pas de représentant : importez-le d’abord.`,
        }),
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BANQUE ET SYNDICAT : RAPPROCHEMENT EXACT, JAMAIS APPROCHANT
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Ces deux colonnes ne sont pas deux libellés parmi d'autres : leur
    // croisement EST le segment BDD1..BDD4 (`packages/database/src/segment.ts`),
    // et le segment commande les listes, le périmètre des campagnes d'appels,
    // les statistiques et les onglets des exports Excel.
    //
    // Un rapprochement flou qui lirait « CBAO Attijari » comme « CBAO » ferait
    // basculer les lignes concernées de BDD2 vers BDD1 sans que rien ne le
    // dise. Une population unique se retrouverait alors répartie sur deux ou
    // trois segments, chaque tableau de bord donnerait un chiffre différent, et
    // une campagne d'appels tirée sur BDD1 composerait des numéros censés
    // appartenir à BDD2. Le défaut ne se voit pas à l'import, il se voit des
    // mois plus tard, sur un rapport que plus personne ne sait reconstituer.
    //
    // On refuse donc la ligne en nommant la colonne ET les valeurs admises :
    // corriger une cellule coûte quelques secondes, démêler un segment faux
    // coûte une reprise complète.
    const rawBanque = (cells[PROSPECT_IMPORT_HEADERS.banque] ?? '').trim();
    const banqueId = refs.banques.get(referentialKey(rawBanque));
    if (banqueId === undefined) {
      return {
        ok: false,
        error: rowError({
          rowNumber,
          column: PROSPECT_IMPORT_HEADERS.banque,
          code: ProspectImportError.BANQUE_UNKNOWN,
          message: `Banque inconnue : « ${rawBanque} ». Valeurs admises : ${listValues(refs.banqueLabels)}.`,
        }),
      };
    }

    const rawSyndicat = (cells[PROSPECT_IMPORT_HEADERS.syndicat] ?? '').trim();
    const syndicatId = refs.syndicats.get(referentialKey(rawSyndicat));
    if (syndicatId === undefined) {
      return {
        ok: false,
        error: rowError({
          rowNumber,
          column: PROSPECT_IMPORT_HEADERS.syndicat,
          code: ProspectImportError.SYNDICAT_UNKNOWN,
          message: `Syndicat inconnu : « ${rawSyndicat} ». Valeurs admises : ${listValues(refs.syndicatLabels)}.`,
        }),
      };
    }

    const rawMethod = (cells[PROSPECT_IMPORT_HEADERS.enrollmentMethod] ?? '').trim();
    let enrollmentMethod: EnrollmentMethod | null = null;
    if (rawMethod !== '') {
      enrollmentMethod = parseEnrollmentMethod(rawMethod);
      if (enrollmentMethod === null) {
        return {
          ok: false,
          error: rowError({
            rowNumber,
            column: PROSPECT_IMPORT_HEADERS.enrollmentMethod,
            code: ProspectImportError.ENROLLMENT_METHOD_UNKNOWN,
            message: `Méthode d’enrôlement inconnue : « ${rawMethod} ». Valeurs admises : ${listValues(ENROLLMENT_METHOD_TOKENS)}, ou cellule vide.`,
          }),
        };
      }
    }

    // Le doublon interne au fichier n'est PAS cherché ici : il demande la
    // mémoire des lignes précédentes, donc l'identité du travail, que
    // `parseRow` n'a pas. Il est traité dans `writeChunk`. Une ligne par
    // ailleurs fautive s'en trouve mieux servie : elle se voit reprocher sa
    // vraie faute, au lieu d'un « doublon » qui enverrait l'utilisateur
    // supprimer une ligne qu'il devait corriger.
    return {
      ok: true,
      row: {
        rowNumber,
        nom,
        prenom,
        phoneE164,
        representantId,
        representantPhoneE164,
        banqueId,
        syndicatId,
        enrollmentMethod,
      },
    };
  }

  /**
   * Écrit une tranche.
   *
   * Le contrôle contre la base se fait en UNE requête par sous-tranche, jamais
   * une par ligne : sur cent cinquante mille lignes, une lecture par ligne
   * dépasserait le délai de la transaction avant le premier dixième du
   * fichier.
   */
  async writeChunk(
    rows: readonly ProspectImportRow[],
    ctx: ImportRunContext,
  ): Promise<ChunkOutcome> {
    if (rows.length === 0) return { created: 0, skipped: 0, errors: [] };

    const state = this.runs.get(ctx.jobId) ?? { seen: new Map<string, number>() };
    this.runs.set(ctx.jobId, state);

    const errors: ImportRowError[] = [];
    const unique: ProspectImportRow[] = [];

    // PREMIÈRE FAMILLE : le fichier contre lui-même. Écartée avant la lecture
    // en base, pour que la requête ne porte pas deux fois le même numéro.
    for (const row of rows) {
      const firstSeen = state.seen.get(row.phoneE164);
      if (firstSeen !== undefined) {
        errors.push(
          rowError({
            rowNumber: row.rowNumber,
            column: PROSPECT_IMPORT_HEADERS.phone,
            code: ProspectImportError.DUPLICATE_IN_FILE,
            message: `Ce numéro figure déjà à la ligne ${String(firstSeen)} du fichier.`,
          }),
        );
        continue;
      }
      state.seen.set(row.phoneE164, row.rowNumber);
      unique.push(row);
    }

    const existing = await this.existingProspects(
      unique.map((row) => row.phoneE164),
      ctx,
    );

    const retained: ProspectImportRow[] = [];

    for (const row of unique) {
      const holder = existing.get(row.phoneE164);
      if (holder === undefined) {
        retained.push(row);
        continue;
      }

      if (holder === row.representantId) {
        errors.push(
          rowError({
            rowNumber: row.rowNumber,
            column: PROSPECT_IMPORT_HEADERS.phone,
            code: ProspectImportError.DUPLICATE_IN_DATABASE,
            message: 'Ce prospect existe déjà en base, sous ce même représentant.',
          }),
        );
        continue;
      }

      // JAMAIS DE RERATTACHEMENT SILENCIEUX. Le représentant porteur d'une
      // fiche décide de la commission et du commercial qui la suit. Un
      // classeur ne peut pas déplacer cela : ce serait une décision
      // commerciale prise par un fichier, découverte quand deux représentants
      // revendiquent la même personne. On rapporte, un humain tranche.
      errors.push(
        rowError({
          rowNumber: row.rowNumber,
          column: PROSPECT_IMPORT_HEADERS.representantPhone,
          code: ProspectImportError.ATTACHED_TO_OTHER_REPRESENTANT,
          message:
            'Ce prospect existe déjà en base, rattaché à un AUTRE représentant. Le rattachement n’a pas été modifié : faites-le expliciter depuis la fiche.',
        }),
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LA SIMULATION N'ÉCRIT RIEN, ET NE LE DEVINE PAS
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Le mode est porté par le contexte, donc l'adaptateur le respecte
    // lui-même au lieu de compter sur une annulation de transaction faite
    // ailleurs. Si le moteur venait à valider la transaction d'une simulation,
    // ou à en changer la portée, une écriture conditionnée à un rollback
    // deviendrait une écriture réelle, sur cent cinquante mille lignes que
    // personne n'a demandé d'écrire.
    //
    // `created` rapporte donc les lignes QUI SERAIENT écrites, et `skipped`
    // reste à zéro : l'écart dû à l'index unique ne se connaît qu'en écrivant.
    if (ctx.mode === ImportMode.DRY_RUN) {
      return { created: retained.length, skipped: 0, errors };
    }

    const now = new Date();
    const result = await ctx.tx.prospect.createMany({
      data: retained.map((row) => ({
        // UUID v7 engendré ici : l'import n'a pas de client hors ligne, mais
        // l'identifiant doit rester du même format que ceux du mobile, sinon
        // l'ordre lexicographique cesse d'être l'ordre temporel et la
        // pagination par keyset se met à sauter des lignes.
        id: uuidv7(),
        nom: row.nom,
        prenom: row.prenom,
        phoneE164: row.phoneE164,
        banqueId: row.banqueId,
        syndicatId: row.syndicatId,
        representantId: row.representantId,
        createdById: ctx.requestedById,
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 2 : LA CONTRAINTE CHECK DÉCIDE, PAS UNE PRÉFÉRENCE
        // ═══════════════════════════════════════════════════════════════════
        //
        // `prospects_enrollment_method_matches_status` impose la méthode SI ET
        // SEULEMENT SI le statut vaut METHOD_OBTAINED. Les deux colonnes se
        // déduisent donc l'une de l'autre, et une seule cellule les gouverne.
        //
        // Cellule vide : PENDING sans méthode. C'est le cas ordinaire, et la
        // fiche reste éligible aux campagnes d'appels : c'est bien ce qu'on
        // veut d'une reprise de données, ces gens n'ont pas encore été
        // appelés.
        //
        // Cellule remplie : METHOD_OBTAINED avec la méthode. Laisser PENDING
        // tout en portant une méthode violerait la contrainte et ferait
        // échouer la tranche entière ; et laisser PENDING sans la méthode
        // remettrait dans le tirage des gens DÉJÀ enrôlés, qu'un
        // téléconseiller rappellerait pour rien.
        phase2Status:
          row.enrollmentMethod === null ? Phase2Status.PENDING : Phase2Status.METHOD_OBTAINED,
        enrollmentMethod: row.enrollmentMethod,
        // L'auteur de la capture est celui qui a demandé l'import, et l'instant
        // est celui de l'import : c'est faux au sens du terrain, mais c'est
        // VÉRIFIABLE, alors qu'une date inventée depuis le fichier ne le serait
        // pas. Le rapport d'import dit d'où viennent ces lignes.
        enrollmentCapturedAt: row.enrollmentMethod === null ? null : now,
        enrollmentCapturedById: row.enrollmentMethod === null ? null : ctx.requestedById,
        // La saisie terrain est inconnue pour un import : on retient l'instant
        // de l'import plutôt qu'une date fabriquée. Les statistiques
        // d'activité s'appuient dessus.
        clientCreatedAt: now,
        // EXPLICITE, alors que la colonne vaut déjà `false` par défaut. Un
        // import est une reprise de données réelles ; s'il empruntait la règle
        // de la saisie web (« le mode démonstration allumé teinte l'écriture »),
        // un administrateur qui importe pendant une démonstration verrait ses
        // cent cinquante mille fiches disparaître à l'extinction, sans rien
        // pour l'en avertir et sans qu'elles soient pour autant supprimées.
        isDemo: false,
      })),
      // La contrainte est doublée par l'index unique partiel : une ligne qui
      // s'y heurterait malgré nos contrôles est écartée plutôt que de faire
      // échouer les 4 999 autres de la tranche. L'écart est COMPTÉ, jamais
      // avalé : c'est la troisième famille de doublons.
      skipDuplicates: true,
    });

    return { created: result.count, skipped: retained.length - result.count, errors };
  }

  /**
   * Prospects vivants portant l'un de ces numéros, et leur représentant.
   *
   * LECTURE GLOBALE délibérée, sans filtre de démonstration : l'index unique
   * partiel `prospects_phone_e164_active_key` est global, il ne connaît pas le
   * mode démonstration. Filtré, ce contrôle déclarerait libres des numéros
   * tenus par des fiches de démonstration, `skipDuplicates` les écarterait
   * ensuite en silence, et le rapport annoncerait des créations qui n'ont pas
   * eu lieu.
   *
   * Découpé en sous-tranches : le moteur choisit la taille de ses tranches, et
   * un `IN` de plusieurs dizaines de milliers de littéraux dépasse ce que le
   * protocole accepte de paramètres.
   */
  private async existingProspects(
    phones: readonly string[],
    ctx: ImportRunContext,
  ): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    const CHUNK = 1_000;

    for (let start = 0; start < phones.length; start += CHUNK) {
      const slice = phones.slice(start, start + CHUNK);
      const rows = await ctx.tx.prospect.findMany({
        where: { phoneE164: { in: slice }, deletedAt: null },
        select: { phoneE164: true, representantId: true },
      });
      for (const row of rows) found.set(row.phoneE164, row.representantId);
    }

    return found;
  }
}

/** Une ligne analysée, prête à écrire. */
export interface ProspectImportRow {
  readonly rowNumber: number;
  readonly nom: string;
  readonly prenom: string;
  readonly phoneE164: string;
  readonly representantId: string;
  readonly representantPhoneE164: string;
  readonly banqueId: string;
  readonly syndicatId: string;
  readonly enrollmentMethod: EnrollmentMethod | null;
}

/** Ce qu'un import en cours mémorise de son propre fichier. */
interface ProspectImportRunState {
  readonly seen: Map<string, number>;
}

interface ProspectImportReferentials {
  readonly banques: ReadonlyMap<string, string>;
  readonly banqueLabels: readonly string[];
  readonly syndicats: ReadonlyMap<string, string>;
  readonly syndicatLabels: readonly string[];
  readonly representants: ReadonlyMap<string, string>;
}

/**
 * Clé de rapprochement d'un code de référentiel.
 *
 * ON EFFACE EXACTEMENT DEUX CHOSES, ET RIEN D'AUTRE :
 *   - la casse, parce qu'un tableur met spontanément « Cbao » en majuscules
 *     d'affichage et que personne ne voit la différence à l'écran ;
 *   - les espaces, ceux du bord comme les répétitions internes, parce qu'ils
 *     sont INVISIBLES : une cellule copiée depuis un PDF traîne presque
 *     toujours une espace finale, et refuser la ligne pour cela rendrait
 *     l'import inutilisable sans rien protéger.
 *
 * On ne touche NI aux accents, NI aux traits d'union, NI à la ponctuation,
 * contrairement à `normalizeKey` de l'import représentants. Là-bas les clés
 * sont des noms de lieux écrits en toutes lettres, ici ce sont des SIGLES et
 * des noms courts : « BNDE » et « B.N.D.E. » peuvent parfaitement désigner deux
 * entrées distinctes du référentiel, et les confondre choisirait un segment BDD
 * à la place de l'utilisateur.
 */
export function referentialKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Indexe un référentiel, en refusant les clés qui se confondent.
 *
 * `shortName` et `sigle` sont uniques en base, donc deux entrées ne peuvent
 * se rejoindre que par la casse ou par une espace. C'est rare, et c'est
 * exactement pour cela qu'il faut lever : une collision non détectée ferait
 * dépendre le rapprochement de l'ordre de lecture des lignes, donc du
 * `sortOrder` du référentiel, ce que personne n'irait soupçonner.
 */
function indexByKey(
  entries: readonly (readonly [string, string])[],
  column: string,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const [label, id] of entries) {
    const key = referentialKey(label);
    if (map.has(key)) throw referentialAmbiguous(column, key);
    map.set(key, id);
  }
  return map;
}

/**
 * Jeton de méthode d'enrôlement.
 *
 * La casse et les espaces sont tolérés, pour la même raison que sur les
 * référentiels. Rien d'autre : les trois valeurs sont des constantes
 * techniques, pas des libellés.
 */
function parseEnrollmentMethod(value: string): EnrollmentMethod | null {
  const key = referentialKey(value).replace(/[\s-]+/g, '_');
  return ENROLLMENT_METHOD_TOKENS.find((token) => token === key) ?? null;
}

/**
 * Valeurs admises, telles qu'elles apparaissent dans le message de refus.
 *
 * Bornées : une liste de cinquante banques rendrait le message illisible dans
 * la colonne d'un rapport, et c'est le message qui doit permettre de corriger
 * la cellule, pas de recenser le référentiel.
 */
function listValues(values: readonly string[]): string {
  const MAX = 20;
  const shown = values.slice(0, MAX).join(', ');
  return values.length > MAX ? `${shown}, … (${String(values.length)} au total)` : shown;
}
