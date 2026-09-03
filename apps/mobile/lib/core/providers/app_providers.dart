import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';
import 'package:drift/drift.dart'
    show
        BooleanExpressionOperators,
        OrderClauseGenerator,
        OrderingTerm,
        QueryRow,
        ResultSetImplementation,
        Variable;
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
  return ref
      .watch(referenceRepositoryProvider)
      .watchRepresentantCount(moi: _moi(ref));
});

final StreamProvider<int> prospectCountProvider = StreamProvider<int>((
  Ref ref,
) {
  return ref
      .watch(referenceRepositoryProvider)
      .watchProspectCount(moi: _moi(ref));
});

final StreamProvider<int> representantsSansProspectProvider =
    StreamProvider<int>((Ref ref) {
      return ref
          .watch(referenceRepositoryProvider)
          .watchRepresentantsSansProspect(moi: _moi(ref));
    });

final StreamProvider<int> grandPublicProspectCountProvider =
    StreamProvider<int>((Ref ref) {
      return ref
          .watch(referenceRepositoryProvider)
          .watchProspectCount(projet: 'GRAND_PUBLIC', moi: _moi(ref));
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

final StreamProvider<List<IncomeBand>> incomeBandsProvider =
    StreamProvider<List<IncomeBand>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchIncomeBands();
    });

final StreamProvider<List<Profession>> professionsProvider =
    StreamProvider<List<Profession>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchProfessions();
    });

final StreamProvider<List<Employeur>> employeursProvider =
    StreamProvider<List<Employeur>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchEmployeurs();
    });

final StreamProvider<List<StatutQualificationRow>>
statutsQualificationProvider = StreamProvider<List<StatutQualificationRow>>((
  Ref ref,
) {
  return ref.watch(referenceRepositoryProvider).watchStatutsQualification();
});

final StreamProvider<List<PaysRow>> paysProvider =
    StreamProvider<List<PaysRow>>((Ref ref) {
      return ref.watch(referenceRepositoryProvider).watchPays();
    });

final NotifierProvider<HistoriqueSearch, String> historiqueSearchProvider =
    NotifierProvider<HistoriqueSearch, String>(HistoriqueSearch.new);

class HistoriqueSearch extends Notifier<String> {
  @override
  String build() => '';

  void set(String value) => state = value;
}

/// L'identifiant du compte connecté, ou la chaîne vide : les requêtes qui
/// bornent au périmètre d'appel s'en servent comme paramètre lié.
String _moi(Ref ref) =>
    ref.watch(authControllerProvider.select((AuthState s) => s.userId)) ?? '';

/// Le compte est-il borné à ses campagnes ? Faux pour l'encadrement, et faux
/// tant que le périmètre n'a jamais été lu. Sert à l'état vide, pas au filtre :
/// le filtre, lui, vit dans les requêtes.
final StreamProvider<bool> perimetreBorneProvider = StreamProvider<bool>((
  Ref ref,
) {
  final AppDatabase db = ref.watch(appDatabaseProvider);
  return (db.select(db.attributions)
        ..where((Attributions t) => t.kind.equals(attributionBorne)))
      .watch()
      .map((List<Attribution> rows) => rows.isNotEmpty);
});

final StreamProvider<List<RepresentantSyncViewData>> representantListProvider =
    StreamProvider<List<RepresentantSyncViewData>>((Ref ref) {
      return ref
          .watch(referenceRepositoryProvider)
          .watchRepresentants(
            search: ref.watch(historiqueSearchProvider),
            moi: _moi(ref),
          );
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
        moi: _moi(ref),
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
          moi: _moi(ref),
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

final prospectDetailProvider =
    StreamProvider.family<ProspectSyncViewData?, String>((
      Ref ref,
      String prospectId,
    ) {
      return ref.watch(referenceRepositoryProvider).watchProspect(prospectId);
    });

/// Où en est la conversion de ce prospect : ce que le serveur en sait
/// (l'annuaire) et ce que le dernier appel saisi sur CE téléphone en dit.
typedef ProspectCallState = ({
  String? status,
  String? method,
  DateTime? callbackAt,
  DateTime? lastAttemptAt,
});

final prospectCallStateProvider =
    StreamProvider.family<ProspectCallState, String>((
      Ref ref,
      String prospectId,
    ) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      return db
          .customSelect(
            'SELECT d.phase2_status AS status, '
            '       COALESCE(a.method, d.enrollment_method) AS method, '
            '       a.callback_at AS callback_at, '
            '       a.client_created_at AS attempt_at '
            'FROM (SELECT ?1 AS id) AS q '
            'LEFT JOIN phase2_directory d ON d.prospect_id = q.id '
            'LEFT JOIN call_attempts a ON a.prospect_id = q.id '
            '  AND a.client_created_at = ('
            '    SELECT MAX(client_created_at) FROM call_attempts '
            '    WHERE prospect_id = q.id)',
            variables: <Variable<Object>>[Variable<String>(prospectId)],
            readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
              db.phase2Directory,
              db.callAttempts,
            },
          )
          .watchSingle()
          .map(
            (QueryRow row) => (
              status: row.read<String?>('status'),
              method: row.read<String?>('method'),
              callbackAt: row.read<DateTime?>('callback_at'),
              lastAttemptAt: row.read<DateTime?>('attempt_at'),
            ),
          );
    });

/// Un rappel promis : la liste des rappels et le compteur des deux accueils
/// lisent la même forme, qu'il porte sur un prospect ou sur un représentant.
typedef Rappel = ({
  String id,
  String sujetId,
  String nom,
  String phoneE164,
  DateTime at,
});

/// Les rappels promis pendant un appel Grand Public, du plus proche au plus
/// lointain. Ne sont retenus que ceux d'aujourd'hui et d'après : un rappel de la
/// semaine dernière ne se rattrape plus, il se rappelle.
///
/// Un rappel n'est en attente que tant qu'AUCUN appel plus récent n'a été saisi
/// sur la fiche : rappeler quelqu'un, c'est saisir un appel de plus, et c'est ce
/// qui honore la promesse. Sans cette clause, le rappel tenu restait compté pour
/// toujours et le nombre de l'accueil ne redescendait jamais.
final StreamProvider<List<Rappel>> grandPublicRappelsProvider =
    StreamProvider<List<Rappel>>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      final Clock clock = ref.watch(clockProvider);
      return db
          .customSelect(
            'SELECT a.id AS id, a.prospect_id AS prospect_id, '
            '       a.callback_at AS callback_at, p.nom AS nom, '
            '       p.prenom AS prenom, p.phone_e164 AS phone_e164 '
            'FROM call_attempts AS a '
            'JOIN prospect_journeys AS j ON j.prospect_id = a.prospect_id '
            '  AND j.projet = \'GRAND_PUBLIC\' '
            'JOIN prospects AS p ON p.id = a.prospect_id '
            '  AND p.deleted_at IS NULL '
            'WHERE a.callback_at IS NOT NULL '
            '  AND NOT EXISTS (SELECT 1 FROM call_attempts AS b '
            '    WHERE b.prospect_id = a.prospect_id AND b.id <> a.id '
            '      AND b.client_created_at >= a.client_created_at) '
            'ORDER BY a.callback_at ASC',
            readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
              db.callAttempts,
              db.prospectJourneys,
              db.prospects,
            },
          )
          .watch()
          .map((List<QueryRow> rows) {
            final DateTime debut = DateUtils.dateOnly(clock.now());
            return rows
                .where(
                  (QueryRow r) =>
                      !r.read<DateTime>('callback_at').isBefore(debut),
                )
                .map(
                  (QueryRow r) => (
                    id: r.read<String>('id'),
                    sujetId: r.read<String>('prospect_id'),
                    nom: '${r.read<String>('prenom')} ${r.read<String>('nom')}'
                        .trim(),
                    phoneE164: r.read<String>('phone_e164'),
                    at: r.read<DateTime>('callback_at'),
                  ),
                )
                .toList(growable: false);
          });
    });

/// Les rappels promis pendant un appel de qualification (phase 1). La table est
/// vidée de la promesse dès qu'un appel de plus est saisi sur le représentant :
/// c'est `WriteRepository.recordRepCallAttempt` qui l'honore, ici il n'y a rien
/// à filtrer d'autre que la date.
final StreamProvider<List<Rappel>> representantRappelsProvider =
    StreamProvider<List<Rappel>>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      final Clock clock = ref.watch(clockProvider);
      return (db.select(db.repCallbackReminders)
            ..orderBy(<OrderClauseGenerator<RepCallbackReminders>>[
              (RepCallbackReminders t) => OrderingTerm.asc(t.scheduledAt),
            ]))
          .watch()
          .map((List<RepCallbackReminder> rows) {
            final DateTime debut = DateUtils.dateOnly(clock.now());
            return rows
                .where(
                  (RepCallbackReminder r) => !r.scheduledAt.isBefore(debut),
                )
                .map(
                  (RepCallbackReminder r) => (
                    id: r.id,
                    sujetId: r.representantId,
                    nom: r.fullName,
                    phoneE164: r.phoneE164,
                    at: r.scheduledAt,
                  ),
                )
                .toList(growable: false);
          });
    });

/// Les représentants que MON dernier appel n'a pas joints, du plus récent au
/// plus ancien. Le résumé du dernier appel est écrit par le SERVEUR : un appel
/// consigné hors ligne n'entre dans cette liste qu'après sa remontée.
final StreamProvider<List<Rappel>> representantsInjoignablesProvider =
    StreamProvider<List<Rappel>>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      final String? moi = ref.watch(
        authControllerProvider.select((AuthState s) => s.userId),
      );
      if (moi == null) return Stream<List<Rappel>>.value(const <Rappel>[]);
      return (db.select(db.representants)
            ..where(
              (Representants t) =>
                  t.lastCallOutcome.equals('UNREACHABLE') &
                  t.lastCallById.equals(moi) &
                  t.lastCallAt.isNotNull() &
                  t.deletedAt.isNull(),
            )
            ..orderBy(<OrderClauseGenerator<Representants>>[
              (Representants t) => OrderingTerm.desc(t.lastCallAt),
            ]))
          .watch()
          .map(
            (List<Representant> rows) => rows
                .map(
                  (Representant r) => (
                    id: r.id,
                    sujetId: r.id,
                    nom: r.fullName,
                    phoneE164: r.phoneE164,
                    at: r.lastCallAt!,
                  ),
                )
                .toList(growable: false),
          );
    });

/// Une personne que J'AI appelée : ce que la ligne de « Mes contacts » montre.
/// [issue] et [statut] sont les codes bruts du serveur, traduits à l'écran.
typedef Contact = ({
  String id,
  String nom,
  String phoneE164,
  DateTime? at,
  String? issue,
  String statut,
});

/// Les représentants que J'AI appelés, du plus récent au plus ancien.
final StreamProvider<List<Contact>> mesContactsRepresentantsProvider =
    StreamProvider<List<Contact>>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      final String? moi = ref.watch(
        authControllerProvider.select((AuthState s) => s.userId),
      );
      if (moi == null) return Stream<List<Contact>>.value(const <Contact>[]);
      return (db.select(db.representants)
            ..where(
              (Representants t) =>
                  t.lastCallById.equals(moi) & t.deletedAt.isNull(),
            )
            ..orderBy(<OrderClauseGenerator<Representants>>[
              (Representants t) => OrderingTerm.desc(t.lastCallAt),
            ]))
          .watch()
          .map(
            (List<Representant> rows) => rows
                .map(
                  (Representant r) => (
                    id: r.id,
                    nom: r.fullName,
                    phoneE164: r.phoneE164,
                    at: r.lastCallAt,
                    issue: r.lastCallOutcome,
                    statut: r.relationStatus,
                  ),
                )
                .toList(growable: false),
          );
    });

/// Les prospects que J'AI appelés. Au Grand Public, bornés au parcours GP :
/// la colonne `projet` ne dit que par où la fiche est entrée.
final mesContactsProspectsProvider = StreamProvider.family<List<Contact>, bool>((
  Ref ref,
  bool grandPublic,
) {
  final AppDatabase db = ref.watch(appDatabaseProvider);
  final String? moi = ref.watch(
    authControllerProvider.select((AuthState s) => s.userId),
  );
  if (moi == null) return Stream<List<Contact>>.value(const <Contact>[]);
  return db
      .customSelect(
        'SELECT p.id AS id, p.nom AS nom, p.prenom AS prenom, '
        '       p.phone_e164 AS phone_e164, p.last_call_at AS at, '
        '       p.last_call_outcome AS issue, '
        '       COALESCE(d.phase2_status, \'PENDING\') AS statut '
        'FROM prospects AS p '
        'LEFT JOIN phase2_directory AS d ON d.prospect_id = p.id '
        'WHERE p.last_call_by_id = ?1 AND p.deleted_at IS NULL '
        '  AND (?2 = 0 OR EXISTS (SELECT 1 FROM prospect_journeys j '
        '        WHERE j.prospect_id = p.id AND j.projet = \'GRAND_PUBLIC\')) '
        'ORDER BY p.last_call_at DESC',
        variables: <Variable<Object>>[
          Variable<String>(moi),
          Variable<bool>(grandPublic),
        ],
        readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
          db.prospects,
          db.prospectJourneys,
          db.phase2Directory,
        },
      )
      .watch()
      .map(
        (List<QueryRow> rows) => rows
            .map(
              (QueryRow r) => (
                id: r.read<String>('id'),
                nom: '${r.read<String>('prenom')} ${r.read<String>('nom')}'
                    .trim(),
                phoneE164: r.read<String>('phone_e164'),
                at: r.read<DateTime?>('at'),
                issue: r.read<String?>('issue'),
                statut: r.read<String>('statut'),
              ),
            )
            .toList(growable: false),
      );
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
