import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart';

import '../../data/local/database.dart';
import 'api_port.dart';
import 'clock.dart';
import 'outbox_status.dart';

/// Réplication de l'annuaire de phase 2 : **Dart pur**.
///
/// Volontairement séparée de `SyncEngine` et de son cycle de 60 secondes. Trois
/// raisons :
///
/// 1. **Le volume n'a rien à voir.** Le pull métier ramène quelques dizaines de
///    lignes ; l'annuaire en compte 50 000 à 500 000 au premier téléchargement.
///    Le glisser dans le cycle périodique ferait démarrer un transfert de
///    plusieurs minutes à l'ouverture de l'app, sur un forfait payé par le
///    commercial, sans qu'il l'ait demandé.
/// 2. **Il a besoin d'être visible.** Un premier téléchargement long sans
///    progression affichée est indistinguable d'une app plantée. On rend donc la
///    progression, page par page.
/// 3. **Le curseur est distinct.** Un curseur unique partagé avec le pull métier
///    divergerait au premier téléchargement interrompu : et une reprise avec le
///    mauvais curseur, ici, veut dire retélécharger 500 000 lignes.
///
/// Aucun `import 'package:flutter/...'` : comme tout `lib/core/sync/`, ce
/// fichier doit rester exécutable dans l'isolat WorkManager.
class Phase2DirectorySync {
  Phase2DirectorySync({
    required AppDatabase database,
    required ApiPort api,
    Clock clock = const SystemClock(),
    this.pageSize = 2000,
  }) : _db = database,
       _api = api,
       _clock = clock;

  final AppDatabase _db;
  final ApiPort _api;
  final Clock _clock;

  /// Taille de page demandée au serveur. 2000 est son défaut et son optimum :
  /// au-dessous, on multiplie les allers-retours sur un lien 2G ; au-dessus
  /// (le serveur plafonne à 5000), une page perdue en fin de transfert coûte
  /// plus cher à refaire qu'elle n'a fait gagner.
  final int pageSize;

  /// Clé de curseur dans `sync_state`. Distincte de celle de `SyncEngine`.
  static const String cursorKey = 'phase2_directory';

  bool _pulling = false;

  /// Vrai tant qu'un téléchargement est en cours. Lu par l'écran pour ne pas
  /// lancer deux transferts de 500 000 lignes en parallèle.
  bool get isPulling => _pulling;

  /// Tire l'annuaire depuis le curseur, page par page.
  ///
  /// [onProgress] est appelé après **chaque page écrite**, avec le nombre
  /// cumulé d'entrées appliquées et le total local. Après la page, pas avant :
  /// une progression qui devance l'écriture ment, et la seule chose qu'on ne
  /// puisse pas se permettre est de dire à un commercial que son annuaire est
  /// à jour alors qu'il ne l'est pas.
  ///
  /// [maxPages] borne le transfert. 300 pages × 2000 = 600 000 lignes, soit
  /// au-delà du plus gros portefeuille attendu ; la borne n'est pas une limite
  /// fonctionnelle, c'est le garde-fou qui empêche une boucle qui n'avancerait
  /// pas : curseur non honoré, `hasMore` toujours vrai : de tourner
  /// indéfiniment dans un isolat, batterie comprise.
  Future<int> pull({
    int maxPages = 300,
    void Function(int applied, bool hasMore)? onProgress,
  }) async {
    if (_pulling) return 0;
    _pulling = true;
    try {
      int applied = 0;
      String? cursor = await readCursor();

      for (int page = 0; page < maxPages; page++) {
        final Phase2DirectoryPage result = await _api.pullPhase2Directory(
          cursor: cursor,
          limit: pageSize,
        );
        applied += await _applyPage(result.entries);
        cursor = result.nextCursor;
        await writeCursor(cursor);
        onProgress?.call(applied, result.hasMore);
        if (!result.hasMore) break;
        // Une page vide avec `hasMore` vrai n'existe pas dans le contrat, mais
        // si elle arrivait, le curseur serait identique au précédent et la
        // boucle tournerait jusqu'à `maxPages` pour rien.
        if (result.entries.isEmpty) break;
      }
      return applied;
    } finally {
      _pulling = false;
    }
  }

  /// Écriture LWW par `rev`.
  ///
  /// Le `WHERE` porte tout : sans lui, une page rejouée : curseur non avancé
  /// après une coupure : réécrirait une ligne plus récente avec une version plus
  /// ancienne. Ici, concrètement, cela ressusciterait un dossier déjà clos et le
  /// commercial rappellerait un numéro déjà traité.
  ///
  /// **`>=` et non `>`, contrairement au pull métier.** L'écart est délibéré et
  /// c'est lui qui rend la réconciliation possible : `markLocallyClosed` écrit
  /// un statut optimiste **sans incrémenter `rev`**. Si le serveur refuse cette
  /// écriture (`PHASE2_ALREADY_COMPLETED`), sa propre `rev` n'a pas bougé : avec
  /// un `>` strict, le pull suivant ne corrigerait donc jamais le miroir
  /// optimiste, et l'écran continuerait d'afficher une issue que le serveur n'a
  /// jamais acceptée. À `rev` égale, c'est le serveur qui a raison.
  Future<int> _applyPage(List<Phase2DirectoryEntry> entries) async {
    if (entries.isEmpty) return 0;
    await _db.batch((Batch batch) {
      for (final Phase2DirectoryEntry e in entries) {
        batch.insert(
          _db.phase2Directory,
          Phase2DirectoryCompanion.insert(
            prospectId: e.prospectId,
            phoneE164: e.phoneE164,
            phase2Status: Value<String>(e.phase2Status),
            enrollmentMethod: Value<String?>(e.enrollmentMethod),
            rev: Value<int>(e.rev),
            updatedAt: e.updatedAt,
          ),
          onConflict: DoUpdate<Phase2Directory, Phase2DirectoryData>(
            (Phase2Directory old) => Phase2DirectoryCompanion.custom(
              phoneE164: const CustomExpression<String>('excluded.phone_e164'),
              phase2Status: const CustomExpression<String>('excluded.phase2_status'),
              enrollmentMethod: const CustomExpression<String>(
                'excluded.enrollment_method',
              ),
              rev: const CustomExpression<int>('excluded.rev'),
              updatedAt: const CustomExpression<DateTime>('excluded.updated_at'),
            ),
            where: (Phase2Directory old) =>
                const CustomExpression<int>('excluded.rev').isBiggerOrEqual(old.rev),
          ),
        );
      }
    });
    return entries.length;
  }

  /// Miroir optimiste d'une issue terminale, écrit au moment de la saisie.
  ///
  /// Sans lui, le commercial qui vient d'enregistrer une méthode et qui
  /// retaperait le même numéro : cela arrive, la pile de papier n'est pas
  /// triée : retomberait sur le formulaire de saisie et enregistrerait une
  /// seconde tentative que le serveur refuserait en `PHASE2_ALREADY_COMPLETED`.
  ///
  /// **`rev` n'est PAS incrémentée.** C'est délibéré : la ligne locale reste
  /// « en retard » d'une révision, donc le prochain pull, qui rapportera la
  /// `rev` réellement attribuée par le serveur, l'emportera et réconciliera :
  /// y compris quand le serveur a tranché autrement que nous (conflit).
  Future<void> markLocallyClosed({
    required String prospectId,
    required String outcome,
    String? method,
  }) async {
    // CONVERSION EXPLICITE issue d'appel → statut de dossier. Écrire `outcome`
    // directement fonctionnait par coïncidence de noms ; voir
    // [Phase2Statuses.forOutcome].
    final String? status = Phase2Statuses.forOutcome(outcome);
    if (status == null) return;
    await (_db.update(
      _db.phase2Directory,
    )..where((Phase2Directory t) => t.prospectId.equals(prospectId))).write(
      Phase2DirectoryCompanion(
        phase2Status: Value<String>(status),
        enrollmentMethod: Value<String?>(
          status == Phase2Statuses.methodObtained ? method : null,
        ),
        updatedAt: Value<DateTime>(_clock.now()),
      ),
    );
  }

  Future<Phase2DirectoryData?> lookupByPhone(String phoneE164) =>
      _db.phase2ByPhone(phone: phoneE164).getSingleOrNull();

  Future<int> count() => _db.countPhase2Directory().getSingle();

  /// Dossiers que mes appels ont clos.
  ///
  /// En Dart et non en requête nommée : la liste des issues terminales était
  /// retapée dans le SQL, ce qui en faisait une quatrième copie d'une règle que
  /// seul le serveur tranche. Ici, elle est LUE depuis [CallOutcomes.terminal].
  Future<int> countClosed() {
    final Expression<int> total = _db.callAttempts.id.count();
    return (_db.selectOnly(_db.callAttempts)
          ..addColumns(<Expression<Object>>[total])
          ..where(_db.callAttempts.outcome.isIn(CallOutcomes.terminal)))
        .map((TypedResult row) => row.read(total) ?? 0)
        .getSingle();
  }

  Stream<int> watchCount() => _db.countPhase2Directory().watchSingle();

  Future<DateTime?> lastPulledAt() async => (await _stateRow())?.lastPulledAt;

  Stream<SyncStateData?> watchState() => (_db.select(
    _db.syncState,
  )..where((SyncState t) => t.collection.equals(cursorKey))).watchSingleOrNull();

  Future<String?> readCursor() async => (await _stateRow())?.cursor;

  Future<SyncStateData?> _stateRow() => (_db.select(
    _db.syncState,
  )..where((SyncState t) => t.collection.equals(cursorKey))).getSingleOrNull();

  Future<void> writeCursor(String? cursor) async {
    await _db
        .into(_db.syncState)
        .insertOnConflictUpdate(
          SyncStateCompanion.insert(
            collection: cursorKey,
            cursor: Value<String?>(cursor),
            lastPulledAt: Value<DateTime?>(_clock.now()),
          ),
        );
  }

  /// Efface l'annuaire et le curseur, **et épargne le travail non envoyé**.
  ///
  /// Appelée à la déconnexion. Un annuaire de 500 000 numéros qui survivrait au
  /// départ de son propriétaire sur un téléphone personnel n'est pas un détail
  /// d'hygiène : c'est la fuite que la limitation à six champs cherchait
  /// justement à borner.
  ///
  /// Le curseur part avec le reste. Le conserver ferait croire au prochain
  /// utilisateur que son annuaire est à jour alors qu'il est vide, et le pull
  /// delta suivant ne ramènerait que les lignes modifiées depuis : c'est-à-dire
  /// presque rien.
  ///
  /// ═══ LA PURGE EMPORTAIT UNE MATINÉE D'APPELS QUE LE SERVEUR N'A JAMAIS VUE ═══
  ///
  /// Elle vidait `call_attempts` et **toutes** les opérations `call_attempt` de
  /// la file, quel que soit leur statut. Or l'écran de déconnexion compte les
  /// éléments en attente avec `countPendingOutbox`, qui ne filtre PAS sur le
  /// type d'entité : les tentatives d'appel non envoyées étaient donc comptées
  /// dans le chiffre annoncé, et la boîte de dialogue promettait mot pour mot
  /// « ces saisies ne partiront qu'à la prochaine connexion avec ce compte ».
  /// L'utilisateur lisait cette promesse, confirmait, et la purge détruisait
  /// exactement ce qu'on venait de lui garantir. Le serveur n'en avait jamais eu
  /// copie : la perte est définitive et rien dans l'app ne peut la signaler.
  ///
  /// **Ce qui part et ce qui reste, et pourquoi la ligne passe là.** Le secret à
  /// protéger est le NUMÉRO, et il n'est que dans `phase2_directory` : le test
  /// voisin de `phase2_test.dart` vérifie qu'aucune colonne nominative n'a été
  /// glissée dans `call_attempts`, qui ne porte qu'un identifiant de dossier,
  /// une issue, une méthode et un commentaire. Conserver une tentative non
  /// envoyée ne conserve donc aucun numéro : l'argument de fuite ne la couvre
  /// pas, et il ne peut pas servir à justifier de détruire le travail de son
  /// auteur.
  ///
  /// Une tentative **déjà partie** n'a, elle, plus de raison de rester : c'est
  /// un journal que le serveur détient, et le prochain utilisateur de l'appareil
  /// n'a pas à le lire.
  ///
  /// C'est exactement le traitement que la phase 1 reçoit déjà : ses opérations
  /// survivent à la déconnexion, avec la réserve que la boîte de dialogue
  /// énonce. Les deux files se comportent enfin pareil.
  Future<void> purge() async {
    await _db.transaction(() async {
      await _db.delete(_db.phase2Directory).go();

      // Les opérations CLOSES seulement. `OutboxStatus.open` couvre `pending`,
      // `syncing`, `conflict` et `failed` : les quatre états que l'écran compte
      // comme « en attente », donc les quatre que la promesse engage.
      await (_db.delete(_db.outbox)..where(
            (Outbox o) =>
                o.entityType.equals(callAttemptEntity) &
                o.status.isIn(OutboxStatus.open).not(),
          ))
          .go();

      // Une tentative dont l'opération est encore en file doit rester : c'est
      // elle que l'opération décrit, et l'écran de phase 2 la relit. La
      // sous-requête évite de construire un `IN` de plusieurs centaines de
      // termes un lendemain de tournée sans réseau.
      await _db.customStatement(
        'DELETE FROM call_attempts WHERE id NOT IN ('
        'SELECT entity_id FROM outbox WHERE entity_type = ? AND status IN '
        '(${List<String>.filled(OutboxStatus.open.length, '?').join(', ')}))',
        <Object?>[callAttemptEntity, ...OutboxStatus.open],
      );

      await (_db.delete(
        _db.syncState,
      )..where((SyncState t) => t.collection.equals(cursorKey))).go();
    });
  }
}

/// Nom d'entité de la phase 2 dans l'outbox et dans le contrat de push.
///
/// Constante et non littéral : une faute de frappe produirait des opérations
/// que le sélecteur classerait en `prospect` : le moteur ne fait pas de
/// distinction par défaut : et le serveur les refuserait sans que rien n'indique
/// pourquoi.
const String callAttemptEntity = 'call_attempt';

/// Issues d'un appel, telles que le serveur les nomme.
///
/// Les valeurs viennent de l'énumération GÉNÉRÉE depuis `apps/api/openapi.json`
/// et ne sont plus retapées : le membre `unknown_default_open_api` est écarté,
/// il décrit une valeur que ce client ne connaît pas encore et qu'aucun écran ne
/// doit jamais proposer à la saisie.
abstract final class CallOutcomes {
  static const String methodObtained = 'METHOD_OBTAINED';
  static const String unreachable = 'UNREACHABLE';
  static const String callback = 'CALLBACK';
  static const String refused = 'REFUSED';
  static const String wrongNumber = 'WRONG_NUMBER';
  static const String other = 'OTHER';

  static final List<String> all = CallOutcome.values
      .where((CallOutcome o) => o != CallOutcome.unknownDefaultOpenApi)
      .map((CallOutcome o) => o.value)
      .toList(growable: false);

  /// Les issues qui closent le dossier.
  ///
  /// ═══ UNE SEULE DÉFINITION, DÉRIVÉE ═══
  ///
  /// Cet ensemble était écrit QUATRE fois : ici, dans
  /// `Phase2DirectorySync.terminalOutcomes`, dans la requête `countMyClosed` de
  /// `schema.drift`, et côté serveur. Quatre copies d'une règle que le serveur
  /// est seul à trancher : la première divergence se serait vue en production,
  /// sous la forme d'un dossier compté clos localement et rouvert au pull
  /// suivant.
  ///
  /// La dérivation est exacte : une issue est terminale si et seulement si elle
  /// correspond à un [Phase2Status]. C'est la définition même du serveur, et
  /// c'est ce qui rend `markLocallyClosed` typable.
  static final Set<String> terminal = Phase2Statuses.all
      .where((String s) => s != Phase2Statuses.pending)
      .toSet();
}

/// Méthodes d'enrôlement, dérivées de l'énumération générée.
///
/// Retapées à la main, elles rendaient inopérant le `enumUnknownDefaultCase:
/// true` d'`openapi-config.yaml`, dont c'est précisément le rôle : accueillir un
/// membre ajouté côté serveur sans rien casser.
abstract final class EnrollmentMethods {
  static const String platform = 'PLATFORM';
  static const String physical = 'PHYSICAL';
  static const String voiceOrElectronicMessaging = 'VOICE_OR_ELECTRONIC_MESSAGING';

  static final List<String> all = EnrollmentMethod.values
      .where((EnrollmentMethod m) => m != EnrollmentMethod.unknownDefaultOpenApi)
      .map((EnrollmentMethod m) => m.value)
      .toList(growable: false);
}

/// Statuts de phase 2 d'un dossier. **Distincts des issues d'appel** : les
/// confondre ferait écrire `CALLBACK` dans une colonne que le serveur n'accepte
/// pas.
abstract final class Phase2Statuses {
  static const String pending = 'PENDING';
  static const String methodObtained = 'METHOD_OBTAINED';
  static const String refused = 'REFUSED';
  static const String wrongNumber = 'WRONG_NUMBER';

  static final List<String> all = Phase2Status.values
      .where((Phase2Status s) => s != Phase2Status.unknownDefaultOpenApi)
      .map((Phase2Status s) => s.value)
      .toList(growable: false);

  /// Le statut de dossier correspondant à une issue d'appel, ou `null` si cette
  /// issue ne clôt rien.
  ///
  /// ═══ CE QUE `markLocallyClosed` FAISAIT ═══
  ///
  /// Elle écrivait une valeur de `CallOutcome` dans une colonne de
  /// `Phase2Status`. Ça marchait, mais **par coïncidence** : trois membres
  /// portent le même nom dans les deux énumérations. Le jour où le serveur
  /// renomme une issue, ou en ajoute une terminale qui ne porte pas le nom du
  /// statut, la ligne locale reçoit une valeur que le serveur n'accepte pas et
  /// l'écran affiche un état qui n'existe pas.
  ///
  /// La conversion est maintenant EXPLICITE et rend `null` pour les trois issues
  /// non terminales (`UNREACHABLE`, `CALLBACK`, `OTHER`).
  static String? forOutcome(String outcome) {
    if (outcome == pending) return null;
    return all.contains(outcome) ? outcome : null;
  }
}
