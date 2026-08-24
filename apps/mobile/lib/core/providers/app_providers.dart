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
import '../../data/repositories/visites_repository.dart';
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

final Provider<AppDatabase> appDatabaseProvider = Provider<AppDatabase>((
  Ref ref,
) {
  throw UnimplementedError(
    'appDatabaseProvider doit être surchargé dans main().',
  );
});

final Provider<SharedPreferences> sharedPreferencesProvider =
    Provider<SharedPreferences>((Ref ref) {
      throw UnimplementedError(
        'sharedPreferencesProvider doit être surchargé dans main().',
      );
    });

final Provider<String> buildNumberProvider = Provider<String>((Ref ref) => '0');

final Provider<Clock> clockProvider = Provider<Clock>(
  (Ref ref) => const SystemClock(),
);

final Provider<TokenStore> tokenStoreProvider = Provider<TokenStore>((Ref ref) {
  return SecureTokenStore();
});

final Provider<({Dio dio, CrmApiClient client})> apiClientProvider =
    Provider<({Dio dio, CrmApiClient client})>((Ref ref) {
      return ApiClientFactory.build(
        tokens: ref.watch(tokenStoreProvider),
        mutex: DatabaseRefreshMutex(ref.watch(appDatabaseProvider)),
        onSessionExpired: () {
          ref.read(authControllerProvider.notifier).onSessionExpired();
        },
      );
    });

final Provider<ApiPort> apiPortProvider = Provider<ApiPort>((Ref ref) {
  return DioApi(ref.watch(apiClientProvider).client);
});

final Provider<RouteMemory> routeMemoryProvider = Provider<RouteMemory>((
  Ref ref,
) {
  return RouteMemory(
    ref.watch(sharedPreferencesProvider),
    buildNumber: ref.watch(buildNumberProvider),
    draftExists: (String draftId) =>
        ref.read(draftRepositoryProvider).exists(draftId),
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

final Provider<Phase2DirectorySync> phase2DirectoryProvider =
    Provider<Phase2DirectorySync>((Ref ref) {
      return Phase2DirectorySync(
        database: ref.watch(appDatabaseProvider),
        api: ref.watch(apiPortProvider),
        clock: ref.watch(clockProvider),
      );
    });

final Provider<WriteRepository> writeRepositoryProvider =
    Provider<WriteRepository>((Ref ref) {
      return WriteRepository(
        ref.watch(appDatabaseProvider),
        clock: ref.watch(clockProvider),
      );
    });

final Provider<DraftRepository> draftRepositoryProvider =
    Provider<DraftRepository>((Ref ref) {
      return DraftRepository(
        ref.watch(appDatabaseProvider),
        clock: ref.watch(clockProvider),
      );
    });

final Provider<ReferenceRepository> referenceRepositoryProvider =
    Provider<ReferenceRepository>((Ref ref) {
      return ReferenceRepository(ref.watch(appDatabaseProvider));
    });

final NotifierProvider<AuthController, AuthState> authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

final NotifierProvider<SyncCoordinator, SyncUiState> syncCoordinatorProvider =
    NotifierProvider<SyncCoordinator, SyncUiState>(SyncCoordinator.new);

final StreamProvider<int> representantCountProvider = StreamProvider<int>((
  Ref ref,
) {
  return ref.watch(appDatabaseProvider).countRepresentants().watchSingle();
});

final StreamProvider<int> prospectCountProvider = StreamProvider<int>((
  Ref ref,
) {
  return ref.watch(appDatabaseProvider).countProspects().watchSingle();
});

final StreamProvider<int> grandPublicProspectCountProvider =
    StreamProvider<int>((Ref ref) {
      return ref
          .watch(referenceRepositoryProvider)
          .watchProspectCount(projet: 'GRAND_PUBLIC');
    });

/// Ce qu'un envoi peut encore faire partir. `countPendingOutbox` comptait aussi
/// `conflict` et `failed` : le bandeau annonçait « sera envoyé au retour du
/// réseau » pour des lignes qu'aucun réseau ne débloquera.
final StreamProvider<int> pendingSyncCountProvider = StreamProvider<int>((
  Ref ref,
) {
  return ref.watch(appDatabaseProvider).countSchedulableOutbox().watchSingle();
});

/// Ce qui attend une décision humaine, dans « À corriger ».
final StreamProvider<int> blockedSyncCountProvider = StreamProvider<int>((
  Ref ref,
) {
  return ref.watch(appDatabaseProvider).countBlockedOutbox().watchSingle();
});

final StreamProvider<List<ActivityDay>> activityLast7DaysProvider =
    StreamProvider<List<ActivityDay>>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
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

final StreamProvider<int> needsAttentionCountProvider = StreamProvider<int>((
  Ref ref,
) {
  return ref
      .watch(referenceRepositoryProvider)
      .watchNeedsAttention()
      .map((List<OutboxData> rows) => rows.length);
});

final StreamProvider<List<OutboxData>> needsAttentionProvider =
    StreamProvider<List<OutboxData>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchNeedsAttention();
    });

final StreamProvider<List<Region>> regionsProvider =
    StreamProvider<List<Region>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchRegions();
    });

final departementsProvider = StreamProvider.family<List<Departement>, String?>((
  Ref ref,
  String? regionId,
) {
  return ref
      .watch(referenceRepositoryProvider)
      .watchDepartements(regionId: regionId);
});

final iefsProvider = StreamProvider.family<List<Ief>, String?>((
  Ref ref,
  String? departementId,
) {
  return ref
      .watch(referenceRepositoryProvider)
      .watchIefs(departementId: departementId);
});

final StreamProvider<List<Banque>> banquesProvider =
    StreamProvider<List<Banque>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchBanques();
    });

final StreamProvider<List<Syndicat>> syndicatsProvider =
    StreamProvider<List<Syndicat>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchSyndicats();
    });

final StreamProvider<List<CanauxProvenanceData>> canauxProvenanceProvider =
    StreamProvider<List<CanauxProvenanceData>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchCanauxProvenance();
    });

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

final StreamProvider<List<ProspectSyncViewData>>
grandPublicProspectListProvider = StreamProvider<List<ProspectSyncViewData>>((
  Ref ref,
) {
  return ref
      .watch(referenceRepositoryProvider)
      .watchAllProspects(
        search: ref.watch(historiqueSearchProvider),
        projet: 'GRAND_PUBLIC',
      );
});

final NotifierProvider<RepresentantPickerSearch, String>
representantPickerSearchProvider =
    NotifierProvider<RepresentantPickerSearch, String>(
      RepresentantPickerSearch.new,
    );

class RepresentantPickerSearch extends Notifier<String> {
  @override
  String build() => '';

  void set(String value) => state = value;
}

final StreamProvider<List<RepresentantSyncViewData>>
representantPickerListProvider = StreamProvider<List<RepresentantSyncViewData>>(
  (Ref ref) {
    return ref
        .watch(referenceRepositoryProvider)
        .watchRepresentants(
          search: ref.watch(representantPickerSearchProvider),
        );
  },
);

final representantDetailProvider =
    StreamProvider.family<RepresentantSyncViewData?, String>((
      Ref ref,
      String representantId,
    ) {
      return ref
          .watch(referenceRepositoryProvider)
          .watchRepresentant(representantId);
    });

final prospectsForRepresentantProvider =
    StreamProvider.family<List<ProspectSyncViewData>, String>((
      Ref ref,
      String representantId,
    ) {
      return ref
          .watch(referenceRepositoryProvider)
          .watchProspectsFor(representantId);
    });

final representantCommentsProvider =
    StreamProvider.family<List<RepresentantComment>, String>((
      Ref ref,
      String representantId,
    ) {
      return ref
          .watch(referenceRepositoryProvider)
          .watchCommentsFor(representantId);
    });

final prospectCountForProvider = StreamProvider.family<int, String>((
  Ref ref,
  String representantId,
) {
  return ref
      .watch(referenceRepositoryProvider)
      .watchProspectCountFor(representantId);
});

final StreamProvider<int> phase2DirectoryCountProvider = StreamProvider<int>((
  Ref ref,
) {
  return ref.watch(phase2DirectoryProvider).watchCount();
});

final StreamProvider<SyncStateData?> phase2DirectoryStateProvider =
    StreamProvider<SyncStateData?>((Ref ref) {
      return ref.watch(phase2DirectoryProvider).watchState();
    });

final StreamProvider<({int attempts, int methods, int closed})>
phase2ProgressProvider =
    StreamProvider<({int attempts, int methods, int closed})>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      return db.countMyAttempts().watchSingle().asyncMap((int attempts) async {
        return (
          attempts: attempts,
          methods: await db.countMyMethods().getSingle(),
          closed: await ref.read(phase2DirectoryProvider).countClosed(),
        );
      });
    });

final StreamProvider<int> phase2PendingCountProvider = StreamProvider<int>((
  Ref ref,
) {
  return ref.watch(appDatabaseProvider).countPhase2Pending().watchSingle();
});

final StreamProvider<List<CallReason>> callReasonsProvider =
    StreamProvider<List<CallReason>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchCallReasons();
    });

final Provider<VisitesRepository> visitesRepositoryProvider =
    Provider<VisitesRepository>((Ref ref) {
      return VisitesRepository(ref.watch(appDatabaseProvider));
    });

final NotifierProvider<RegistreSearch, String> registreSearchProvider =
    NotifierProvider<RegistreSearch, String>(RegistreSearch.new);

class RegistreSearch extends Notifier<String> {
  @override
  String build() => '';

  void set(String value) => state = value;
}

final NotifierProvider<RegistrePeriode, PeriodeRegistre>
registrePeriodeProvider = NotifierProvider<RegistrePeriode, PeriodeRegistre>(
  RegistrePeriode.new,
);

class RegistrePeriode extends Notifier<PeriodeRegistre> {
  @override
  PeriodeRegistre build() => PeriodeRegistre.jour;

  void set(PeriodeRegistre value) => state = value;
}

final StreamProvider<VisitesPage> registreProvider =
    StreamProvider<VisitesPage>((Ref ref) {
      return ref
          .watch(visitesRepositoryProvider)
          .watch(
            search: ref.watch(registreSearchProvider),
            periode: ref.watch(registrePeriodeProvider),
            maintenant: ref.watch(clockProvider).now(),
          );
    });

final StreamProvider<CompteursAccueil> compteursAccueilProvider =
    StreamProvider<CompteursAccueil>((Ref ref) {
      return ref
          .watch(visitesRepositoryProvider)
          .watchCompteurs(ref.watch(clockProvider).now());
    });

final StreamProvider<List<ActivityDay>> activiteVisites7JoursProvider =
    StreamProvider<List<ActivityDay>>((Ref ref) {
      return ref
          .watch(visitesRepositoryProvider)
          .watchActivite7Jours(ref.watch(clockProvider).now());
    });

final StreamProvider<TopLabels> topLabelsVisitesProvider =
    StreamProvider<TopLabels>((Ref ref) {
      return ref
          .watch(visitesRepositoryProvider)
          .watchTopLabels(ref.watch(clockProvider).now());
    });

final StreamProvider<HeureDePointe?> heureDePointeVisitesProvider =
    StreamProvider<HeureDePointe?>((Ref ref) {
      return ref
          .watch(visitesRepositoryProvider)
          .watchHeureDePointe(ref.watch(clockProvider).now());
    });
