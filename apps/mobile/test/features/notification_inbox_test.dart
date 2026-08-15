import 'package:cpi_go/core/push/push_inbox_store.dart';
import 'package:cpi_go/core/push/push_message.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/notifications/notification_inbox.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';

/// Rapatriement de la boîte de réception, et **accusés de lecture**.
///
/// ═══ CE QUI SE PERDAIT ═══
///
/// `markRead` était un « tire et oublie » sans rejeu : une annonce lue dans un
/// village sans réseau n'était jamais remontée, et le siège la comptait non lue
/// indéfiniment. La file d'outbox n'est pas le bon foyer pour cette écriture :
/// elle ne transporte que des opérations de `/sync/push`, dont le contrat ne
/// connaît que `representant` et `prospect`. La réconciliation à chaque
/// rapatriement fait le même travail et **s'auto-répare**.
void main() {
  late AppDatabase db;
  late PushInboxStore store;

  setUp(() async {
    db = await openTestDatabase();
    store = PushInboxStore(db);
  });
  tearDown(() async => db.close());

  PushMessage message(String id) => PushMessage(
    id: id,
    title: 'Appels en attente',
    body: 'Trois fiches à appeler.',
    category: 'RAPPEL',
    sentAt: t0,
  );

  test('une lecture faite hors ligne repart au rapatriement suivant', () async {
    // Le commercial lit l'annonce dans un village. Le serveur ne l'apprend
    // jamais : il n'y a pas de réseau au moment du tap.
    await store.upsert(message('ntf-1'));
    await store.markRead('ntf-1');

    final _RecordingApi api = _RecordingApi(<_Item>[
      const _Item(id: 'ntf-1', readAt: null),
    ]);
    final NotificationInbox inbox = NotificationInbox(api: api, store: store);
    addTearDown(inbox.dispose);

    await inbox.refresh(force: true);

    expect(
      api.marked,
      <String>['ntf-1'],
      reason: 'le serveur ignore encore cette lecture : elle doit repartir',
    );
  });

  test('une lecture déjà connue du serveur ne repart pas', () async {
    await store.upsert(message('ntf-1'));
    await store.markRead('ntf-1');

    final _RecordingApi api = _RecordingApi(<_Item>[
      _Item(id: 'ntf-1', readAt: t0),
    ]);
    final NotificationInbox inbox = NotificationInbox(api: api, store: store);
    addTearDown(inbox.dispose);

    await inbox.refresh(force: true);

    expect(api.marked, isEmpty, reason: 'une requête par ouverture, pour rien');
  });

  test('une annonce non lue localement ne se marque pas lue', () async {
    await store.upsert(message('ntf-1'));

    final _RecordingApi api = _RecordingApi(<_Item>[
      const _Item(id: 'ntf-1', readAt: null),
    ]);
    final NotificationInbox inbox = NotificationInbox(api: api, store: store);
    addTearDown(inbox.dispose);

    await inbox.refresh(force: true);

    expect(api.marked, isEmpty);
  });

  group('verdict du rapatriement', () {
    test('au départ, on n\'a encore rien rapatrié', () {
      final NotificationInbox inbox = NotificationInbox(
        api: _RecordingApi(const <_Item>[]),
        store: store,
      );
      addTearDown(inbox.dispose);
      expect(inbox.status.value.state, InboxSync.never);
    });

    test('un succès date la liste', () async {
      final NotificationInbox inbox = NotificationInbox(
        api: _RecordingApi(const <_Item>[]),
        store: store,
      );
      addTearDown(inbox.dispose);

      await inbox.refresh(force: true);
      expect(inbox.status.value.state, InboxSync.ok);
      expect(inbox.status.value.lastSuccessAt, isNotNull);
    });

    test('un échec se déclare, au lieu de rendre 0 en silence', () async {
      // Rendre 0 rendait un échec indiscernable d'une boîte vide, et l'écran
      // affichait « Aucune annonce » dans les deux cas.
      final NotificationInbox inbox = NotificationInbox(
        api: _FailingApi(),
        store: store,
      );
      addTearDown(inbox.dispose);

      expect(await inbox.refresh(force: true), 0);
      expect(inbox.status.value.state, InboxSync.offline);
    });
  });
}

class _Item {
  const _Item({required this.id, this.readAt});

  final String id;
  final DateTime? readAt;
}

/// API qui rend la liste qu'on lui donne et note les accusés de lecture reçus.
class _RecordingApi implements NotificationsApi {
  _RecordingApi(this.items);

  final List<_Item> items;
  final List<String> marked = <String>[];

  @override
  Future<Response<InboxDto>> listMyNotifications({
    bool? unreadOnly,
    num? page = 1,
    num? pageSize = 50,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    return Response<InboxDto>(
      requestOptions: RequestOptions(path: '/notifications/mine'),
      statusCode: 200,
      data: InboxDto(
        unreadCount: 0,
        meta: PageMetaDto(
          total: items.length,
          page: 1,
          pageSize: 50,
          pageCount: 1,
        ),
        items: <InboxItemDto>[
          for (final _Item i in items)
            InboxItemDto(
              id: 'livraison-${i.id}',
              notificationId: i.id,
              title: 'Appels en attente',
              body: 'Trois fiches à appeler.',
              category: NotificationCategory.RAPPEL,
              route: null,
              isRead: i.readAt != null,
              readAt: i.readAt,
              createdAt: t0,
            ),
        ],
      ),
    );
  }

  @override
  Future<Response<OkDto>> markNotificationRead({
    required String id,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    marked.add(id);
    return Response<OkDto>(
      requestOptions: RequestOptions(path: '/notifications/$id/read'),
      statusCode: 200,
      data: OkDto(ok: true),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName} non utilisée ici');
}

/// Serveur injoignable : l'état normal d'une tournée.
class _FailingApi implements NotificationsApi {
  @override
  dynamic noSuchMethod(Invocation invocation) => throw DioException(
    requestOptions: RequestOptions(path: '/notifications/mine'),
    type: DioExceptionType.connectionError,
  );
}
