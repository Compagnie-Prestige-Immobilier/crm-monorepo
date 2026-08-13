import 'package:drift/drift.dart';

import '../../data/local/database.dart';
import 'api_port.dart';
import 'clock.dart';

/// Réplication de l'annuaire de phase 2 — **Dart pur**.
///
/// Volontairement séparée de `SyncEngine` et de son cycle de 60 secondes. Trois
/// raisons, toutes de terrain :
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
///    divergerait au premier téléchargement interrompu — et une reprise avec le
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

  /// Les trois issues qui closent un dossier côté serveur. Les autres
  /// (`UNREACHABLE`, `CALLBACK`, `OTHER`) laissent la tâche ouverte.
  static const Set<String> terminalOutcomes = <String>{
    'METHOD_OBTAINED',
    'REFUSED',
    'WRONG_NUMBER',
  };

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
  /// pas — curseur non honoré, `hasMore` toujours vrai — de tourner
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
  /// Le `WHERE` porte tout : sans lui, une page rejouée — curseur non avancé
  /// après une coupure — réécrirait une ligne plus récente avec une version plus
  /// ancienne. Ici, concrètement, cela ressusciterait un dossier déjà clos et le
  /// commercial rappellerait un numéro déjà traité.
  ///
  /// **`>=` et non `>`, contrairement au pull métier.** L'écart est délibéré et
  /// c'est lui qui rend la réconciliation possible : `markLocallyClosed` écrit
  /// un statut optimiste **sans incrémenter `rev`**. Si le serveur refuse cette
  /// écriture (`PHASE2_ALREADY_COMPLETED`), sa propre `rev` n'a pas bougé — avec
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
  /// retaperait le même numéro — cela arrive, la pile de papier n'est pas
  /// triée — retomberait sur le formulaire de saisie et enregistrerait une
  /// seconde tentative que le serveur refuserait en `PHASE2_ALREADY_COMPLETED`.
  ///
  /// **`rev` n'est PAS incrémentée.** C'est délibéré : la ligne locale reste
  /// « en retard » d'une révision, donc le prochain pull, qui rapportera la
  /// `rev` réellement attribuée par le serveur, l'emportera et réconciliera —
  /// y compris quand le serveur a tranché autrement que nous (conflit).
  Future<void> markLocallyClosed({
    required String prospectId,
    required String outcome,
    String? method,
  }) async {
    if (!terminalOutcomes.contains(outcome)) return;
    await (_db.update(
      _db.phase2Directory,
    )..where((Phase2Directory t) => t.prospectId.equals(prospectId))).write(
      Phase2DirectoryCompanion(
        phase2Status: Value<String>(outcome),
        enrollmentMethod: Value<String?>(outcome == 'METHOD_OBTAINED' ? method : null),
        updatedAt: Value<DateTime>(_clock.now()),
      ),
    );
  }

  Future<Phase2DirectoryData?> lookupByPhone(String phoneE164) =>
      _db.phase2ByPhone(phone: phoneE164).getSingleOrNull();

  Future<int> count() => _db.countPhase2Directory().getSingle();

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

  /// Efface l'annuaire, les tentatives locales, leurs opérations en file et le
  /// curseur — **tout ce que la phase 2 a posé sur cet appareil**.
  ///
  /// Appelée à la déconnexion. Un annuaire de 500 000 numéros qui survivrait au
  /// départ de son propriétaire sur un téléphone personnel n'est pas un détail
  /// d'hygiène : c'est la fuite que la limitation à six champs cherchait
  /// justement à borner.
  ///
  /// Le curseur part avec le reste. Le conserver ferait croire au prochain
  /// utilisateur que son annuaire est à jour alors qu'il est vide, et le pull
  /// delta suivant ne ramènerait que les lignes modifiées depuis — c'est-à-dire
  /// presque rien.
  Future<void> purge() async {
    await _db.transaction(() async {
      await _db.delete(_db.phase2Directory).go();
      await _db.delete(_db.callAttempts).go();
      await (_db.delete(
        _db.outbox,
      )..where((Outbox o) => o.entityType.equals(callAttemptEntity))).go();
      await (_db.delete(
        _db.syncState,
      )..where((SyncState t) => t.collection.equals(cursorKey))).go();
    });
  }
}

/// Nom d'entité de la phase 2 dans l'outbox et dans le contrat de push.
///
/// Constante et non littéral : une faute de frappe produirait des opérations
/// que le sélecteur classerait en `prospect` — le moteur ne fait pas de
/// distinction par défaut — et le serveur les refuserait sans que rien n'indique
/// pourquoi.
const String callAttemptEntity = 'call_attempt';

/// Issues d'un appel, telles que le serveur les nomme.
abstract final class CallOutcomes {
  static const String methodObtained = 'METHOD_OBTAINED';
  static const String unreachable = 'UNREACHABLE';
  static const String callback = 'CALLBACK';
  static const String refused = 'REFUSED';
  static const String wrongNumber = 'WRONG_NUMBER';
  static const String other = 'OTHER';

  static const List<String> all = <String>[
    methodObtained,
    unreachable,
    callback,
    refused,
    wrongNumber,
    other,
  ];

  /// Les issues qui closent le dossier. `METHOD_OBTAINED` exige une méthode ;
  /// `REFUSED` et `WRONG_NUMBER` sont terminales sans méthode.
  static const Set<String> terminal = <String>{methodObtained, refused, wrongNumber};
}

/// Méthodes d'enrôlement.
abstract final class EnrollmentMethods {
  static const String platform = 'PLATFORM';
  static const String physical = 'PHYSICAL';
  static const String voiceOrElectronicMessaging = 'VOICE_OR_ELECTRONIC_MESSAGING';

  static const List<String> all = <String>[
    platform,
    physical,
    voiceOrElectronicMessaging,
  ];
}

/// Statuts de phase 2 d'un dossier. **Quatre valeurs, distinctes des six issues
/// d'appel** — les confondre ferait écrire `CALLBACK` dans une colonne que le
/// serveur n'accepte pas.
abstract final class Phase2Statuses {
  static const String pending = 'PENDING';
  static const String methodObtained = 'METHOD_OBTAINED';
  static const String refused = 'REFUSED';
  static const String wrongNumber = 'WRONG_NUMBER';
}
