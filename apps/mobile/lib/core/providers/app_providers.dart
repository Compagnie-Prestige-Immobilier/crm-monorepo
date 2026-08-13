import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';
import 'package:drift/drift.dart' show QueryRow, ResultSetImplementation;
import 'package:flutter/material.dart' show DateUtils;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../ui/widgets/activity_chart.dart' show ActivityDay;

import '../../data/local/database.dart';
import '../../data/local/refresh_mutex_db.dart';
import '../../data/repositories/draft_repository.dart';
import '../../data/repositories/reference_repository.dart';
import '../../data/repositories/write_repository.dart';
import '../../data/secure/secure_token_store.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/auth_state.dart';
import '../network/dio_factory.dart';
import '../router/route_memory.dart';
import '../sync/api_port.dart';
import '../sync/clock.dart';
import '../sync/dio_api.dart';
import '../sync/phase2_directory_sync.dart';
import '../sync/sync_engine.dart';
import '../sync/sync_engine_factory.dart';
import '../sync/token_store.dart';
import 'sync_coordinator.dart';

/// Racine des dépendances de l'isolat UI.
///
/// Riverpod **enveloppe** les objets Dart purs de `lib/core/sync/`, il ne les
/// remplace pas. Le worker WorkManager appelle `buildSyncEngine()` directement,
/// sans conteneur : c'est la même fabrique des deux côtés, et c'est la seule
/// façon de garantir qu'ils synchronisent avec la même configuration.

/// Surchargé dans `main()` : la base est ouverte avant le premier widget.
final Provider<AppDatabase> appDatabaseProvider = Provider<AppDatabase>((Ref ref) {
  throw UnimplementedError('appDatabaseProvider doit être surchargé dans main().');
});

/// Surchargé dans `main()` — la lecture des préférences est asynchrone et on ne
/// veut pas d'un premier cadre incapable de restaurer la route.
final Provider<SharedPreferences> sharedPreferencesProvider = Provider<SharedPreferences>(
  (Ref ref) {
    throw UnimplementedError(
      'sharedPreferencesProvider doit être surchargé dans main().',
    );
  },
);

/// `versionCode` Android, surchargé dans `main()`. Il conditionne la
/// restauration de route : une route enregistrée par une autre version peut ne
/// plus exister.
final Provider<String> buildNumberProvider = Provider<String>((Ref ref) => '0');

final Provider<Clock> clockProvider = Provider<Clock>((Ref ref) => const SystemClock());

final Provider<TokenStore> tokenStoreProvider = Provider<TokenStore>((Ref ref) {
  return SecureTokenStore();
});

/// **L'unique** transport de l'app, et le client généré qui s'appuie dessus.
///
/// Un seul Dio, construit ici, avec ses intercepteurs. Laisser le client généré
/// fabriquer le sien lui donnerait un transport sans authentification ni
/// renouvellement : toutes les requêtes partiraient en 401.
final Provider<({Dio dio, CrmApiClient client})> apiClientProvider =
    Provider<({Dio dio, CrmApiClient client})>((Ref ref) {
      return ApiClientFactory.build(
        tokens: ref.watch(tokenStoreProvider),
        // Sérialise le renouvellement avec celui de l'isolat WorkManager, qui
        // parle au serveur avec le même jeton persisté. Sans ce verrou, un
        // worker qui se réveille pendant un démarrage d'app fait révoquer la
        // famille de jetons et déconnecte le commercial.
        mutex: DatabaseRefreshMutex(ref.watch(appDatabaseProvider)),
        // Le renouvellement a définitivement échoué : on ne peut pas laisser
        // l'app afficher des écrans vides derrière un garde silencieux.
        onSessionExpired: () {
          ref.read(authControllerProvider.notifier).onSessionExpired();
        },
      );
    });

final Provider<ApiPort> apiPortProvider = Provider<ApiPort>((Ref ref) {
  return DioApi(ref.watch(apiClientProvider).client);
});

final Provider<RouteMemory> routeMemoryProvider = Provider<RouteMemory>((Ref ref) {
  return RouteMemory(
    ref.watch(sharedPreferencesProvider),
    buildNumber: ref.watch(buildNumberProvider),
  );
});

final Provider<SyncEngine> syncEngineProvider = Provider<SyncEngine>((Ref ref) {
  return buildSyncEngine(
    database: ref.watch(appDatabaseProvider),
    api: ref.watch(apiPortProvider),
    tokens: ref.watch(tokenStoreProvider),
    clock: ref.watch(clockProvider),
  );
});

/// Réplication de l'annuaire de phase 2. Séparée du moteur : son volume, sa
/// périodicité et son curseur n'ont rien de commun avec le pull métier.
final Provider<Phase2DirectorySync> phase2DirectoryProvider =
    Provider<Phase2DirectorySync>((Ref ref) {
      return Phase2DirectorySync(
        database: ref.watch(appDatabaseProvider),
        api: ref.watch(apiPortProvider),
        clock: ref.watch(clockProvider),
      );
    });

final Provider<WriteRepository> writeRepositoryProvider = Provider<WriteRepository>((
  Ref ref,
) {
  return WriteRepository(ref.watch(appDatabaseProvider), clock: ref.watch(clockProvider));
});

final Provider<DraftRepository> draftRepositoryProvider = Provider<DraftRepository>((
  Ref ref,
) {
  return DraftRepository(ref.watch(appDatabaseProvider), clock: ref.watch(clockProvider));
});

final Provider<ReferenceRepository> referenceRepositoryProvider =
    Provider<ReferenceRepository>((Ref ref) {
      return ReferenceRepository(ref.watch(appDatabaseProvider));
    });

final NotifierProvider<AuthController, AuthState> authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

final NotifierProvider<SyncCoordinator, SyncUiState> syncCoordinatorProvider =
    NotifierProvider<SyncCoordinator, SyncUiState>(SyncCoordinator.new);

/// Compteurs de l'écran d'accueil. Des flux, pas des `Future` : une écriture
/// hors ligne doit se voir immédiatement sur les cartes, sans rechargement.
final StreamProvider<int> representantCountProvider = StreamProvider<int>((Ref ref) {
  return ref.watch(appDatabaseProvider).countRepresentants().watchSingle();
});

final StreamProvider<int> prospectCountProvider = StreamProvider<int>((Ref ref) {
  return ref.watch(appDatabaseProvider).countProspects().watchSingle();
});

final StreamProvider<int> pendingSyncCountProvider = StreamProvider<int>((Ref ref) {
  return ref.watch(appDatabaseProvider).countPendingOutbox().watchSingle();
});

/// Saisies des sept derniers jours, réparties entre envoyées et en attente.
///
/// `customSelect` et non une requête déclarée dans `schema.drift` : la requête
/// est purement d'affichage, elle ne mérite pas un passage de générateur ni une
/// entrée dans le schéma versionné. Elle lit les **vues** de synchronisation,
/// qui portent déjà `sync_status` en joignant l'outbox : aucune colonne
/// dénormalisée à tenir à jour, donc rien à oublier.
///
/// Aucun appel réseau : c'est un flux drift, il se réémet dès qu'une écriture
/// locale touche l'une des trois tables.
final StreamProvider<List<ActivityDay>> activityLast7DaysProvider =
    StreamProvider<List<ActivityDay>>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      // `date(..., 'localtime')` : les DATETIME sont stockés en texte ISO-8601
      // UTC (voir build.yaml). Grouper sans conversion placerait une saisie de
      // 23 h au lendemain pour l'utilisateur.
      const String sql = '''
SELECT day,
       SUM(is_synced) AS synced,
       SUM(is_pending) AS pending
FROM (
  SELECT date(client_created_at, 'localtime') AS day,
         CASE WHEN sync_status = 'synced' THEN 1 ELSE 0 END AS is_synced,
         CASE WHEN sync_status = 'synced' THEN 0 ELSE 1 END AS is_pending
  FROM representant_sync_view
  WHERE deleted_at IS NULL
  UNION ALL
  SELECT date(client_created_at, 'localtime'),
         CASE WHEN sync_status = 'synced' THEN 1 ELSE 0 END,
         CASE WHEN sync_status = 'synced' THEN 0 ELSE 1 END
  FROM prospect_sync_view
  WHERE deleted_at IS NULL
)
WHERE day >= date('now', 'localtime', '-6 days')
GROUP BY day
''';
      return db
          .customSelect(
            sql,
            readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
              db.representants,
              db.prospects,
              db.outbox,
            },
          )
          .watch()
          .map((List<QueryRow> rows) {
            final Map<String, QueryRow> byDay = <String, QueryRow>{
              for (final QueryRow r in rows) r.read<String>('day'): r,
            };
            final DateTime today = DateUtils.dateOnly(DateTime.now());
            return List<ActivityDay>.generate(7, (int i) {
              final DateTime day = today.subtract(Duration(days: 6 - i));
              final String key = _isoDay(day);
              final QueryRow? row = byDay[key];
              return ActivityDay(
                day: day,
                synced: row?.read<int?>('synced') ?? 0,
                pending: row?.read<int?>('pending') ?? 0,
              );
            });
          });
    });

String _isoDay(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// Nombre d'opérations qui demandent une action humaine. Alimente la pastille
/// « À corriger ».
final StreamProvider<int> needsAttentionCountProvider = StreamProvider<int>((Ref ref) {
  return ref
      .watch(referenceRepositoryProvider)
      .watchNeedsAttention()
      .map((List<OutboxData> rows) => rows.length);
});

final StreamProvider<List<OutboxData>> needsAttentionProvider =
    StreamProvider<List<OutboxData>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchNeedsAttention();
    });

// ── Référentiels ─────────────────────────────────────────────────────────────

final StreamProvider<List<Departement>> departementsProvider =
    StreamProvider<List<Departement>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchDepartements();
    });

final StreamProvider<List<Banque>> banquesProvider = StreamProvider<List<Banque>>((
  Ref ref,
) {
  return ref.watch(referenceRepositoryProvider).watchBanques();
});

final StreamProvider<List<Syndicat>> syndicatsProvider = StreamProvider<List<Syndicat>>((
  Ref ref,
) {
  return ref.watch(referenceRepositoryProvider).watchSyndicats();
});

// ── Listes ───────────────────────────────────────────────────────────────────

/// Terme de recherche de l'écran Historique. Séparé de la liste pour que taper
/// ne reconstruise que la requête, pas l'écran.
final NotifierProvider<HistoriqueSearch, String> historiqueSearchProvider =
    NotifierProvider<HistoriqueSearch, String>(HistoriqueSearch.new);

class HistoriqueSearch extends Notifier<String> {
  @override
  String build() => '';

  void set(String value) => state = value;
}

final StreamProvider<List<RepresentantSyncViewData>> representantListProvider =
    StreamProvider<List<RepresentantSyncViewData>>((Ref ref) {
      return ref
          .watch(referenceRepositoryProvider)
          .watchRepresentants(search: ref.watch(historiqueSearchProvider));
    });

final prospectsForRepresentantProvider =
    StreamProvider.family<List<ProspectSyncViewData>, String>((
      Ref ref,
      String representantId,
    ) {
      return ref.watch(referenceRepositoryProvider).watchProspectsFor(representantId);
    });

final prospectCountForProvider = StreamProvider.family<int, String>((
  Ref ref,
  String representantId,
) {
  return ref.watch(referenceRepositoryProvider).watchProspectCountFor(representantId);
});

// ── Phase 2 ──────────────────────────────────────────────────────────────────

/// Taille de l'annuaire répliqué. Zéro veut dire « rien à chercher » : l'écran
/// propose alors le téléchargement au lieu d'un champ qui ne trouverait rien.
final StreamProvider<int> phase2DirectoryCountProvider = StreamProvider<int>((Ref ref) {
  return ref.watch(phase2DirectoryProvider).watchCount();
});

/// État du curseur d'annuaire — porte la date du dernier téléchargement.
final StreamProvider<SyncStateData?> phase2DirectoryStateProvider =
    StreamProvider<SyncStateData?>((Ref ref) {
      return ref.watch(phase2DirectoryProvider).watchState();
    });

/// Progression **personnelle** : ce que ce commercial a saisi sur cet appareil.
///
/// Ce n'est pas l'avancement de la campagne et l'écran ne le présente pas comme
/// tel. Le programme officiel est le PDF imprimé ; une app qui afficherait
/// « 42 / 120 » se substituerait à lui et ferait sauter des numéros que le
/// papier porte et qu'elle ignore.
final StreamProvider<({int attempts, int methods, int closed})> phase2ProgressProvider =
    StreamProvider<({int attempts, int methods, int closed})>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      // Trois flux fusionnés plutôt qu'une requête à trois sous-selects :
      // drift ne réémet que le flux dont la table a bougé, et les trois
      // portent sur la même table — la fusion coûte donc un rebuild, pas
      // trois requêtes.
      return db.countMyAttempts().watchSingle().asyncMap((int attempts) async {
        return (
          attempts: attempts,
          methods: await db.countMyMethods().getSingle(),
          closed: await db.countMyClosed().getSingle(),
        );
      });
    });

/// Nombre d'écritures de phase 2 encore en file. Distinct du compteur global :
/// sur cet écran, ce qui compte est « mes appels sont-ils partis ? », pas l'état
/// de la file de phase 1.
final StreamProvider<int> phase2PendingCountProvider = StreamProvider<int>((Ref ref) {
  return ref.watch(appDatabaseProvider).countPhase2Pending().watchSingle();
});
