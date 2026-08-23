import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:cpi_go/core/network/timeout_profile.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/dio_api.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Classification des échecs de transport.
///
/// C'est la règle métier la plus dense du module réseau : c'est elle qui décide
/// si une saisie est réessayée, comptée, ou condamnée. Deux erreurs y ont coûté
/// des journées de prospection :
///
///  · un portail captif répond **200 avec du HTML**, et le lot entier (jusqu'à
///    deux cents opérations) partait en `failed` ;
///  · une coupure réseau était classée comme un 500, si bien que quelques
///    minutes sans antenne épuisaient les huit tentatives.
void main() {
  group('lien mort vs refus serveur', () {
    test(
      'une coupure de connexion est INJOIGNABLE, pas réessayable-serveur',
      () {
        final ApiException e = DioApi.classify(
          DioException(
            requestOptions: RequestOptions(path: '/api/v1/sync/push'),
            type: DioExceptionType.connectionError,
          ),
          'push',
        );
        expect(e.code, 'NETWORK');
        expect(e.kind, FailureKind.unreachable);
        expect(e.isUnreachable, isTrue);
      },
    );

    test('un délai dépassé est INJOIGNABLE : le serveur n\'a rien refusé', () {
      for (final DioExceptionType type in <DioExceptionType>[
        DioExceptionType.connectionTimeout,
        DioExceptionType.receiveTimeout,
      ]) {
        final ApiException e = DioApi.classify(
          DioException(
            requestOptions: RequestOptions(path: '/api/v1/sync/push'),
            type: type,
          ),
          'push',
        );
        expect(e.code, 'TIMEOUT', reason: '$type');
        expect(e.kind, FailureKind.unreachable, reason: '$type');
      }
    });

    /// L'envoi expiré porte son PROPRE code : le lot a bien été tenté, et c'est
    /// ce qui le rend un jour visible plutôt que d'être reconstruit à
    /// l'identique tous les cycles, indéfiniment, sans compter de tentative.
    test('un envoi qui expire se distingue d\'un réseau absent', () {
      final ApiException e = DioApi.classify(
        DioException(
          requestOptions: RequestOptions(path: '/api/v1/sync/push'),
          type: DioExceptionType.sendTimeout,
        ),
        'push',
      );
      expect(e.code, ClientErrorCodes.sendTimeout);
      expect(e.kind, FailureKind.unreachable);
    });

    test('un 500 reste un refus du serveur, donc une tentative comptée', () {
      final ApiException e = DioApi.classify(
        DioException(
          requestOptions: RequestOptions(path: '/api/v1/sync/push'),
          type: DioExceptionType.badResponse,
          response: Response<dynamic>(
            requestOptions: RequestOptions(path: '/api/v1/sync/push'),
            statusCode: 503,
          ),
        ),
        'push',
      );
      expect(e.kind, FailureKind.retryable);
      expect(e.isUnreachable, isFalse);
    });

    /// ═══ LE PORTAIL CAPTIF NE RÉPOND PAS QUE 200 ═══
    ///
    /// La règle du corps non-JSON ne portait que sur les 2xx. Beaucoup de
    /// portails, et les proxys d'entreprise, rendent 403 avec leur page HTML de
    /// connexion : cette réponse tombait dans la branche terminale et condamnait
    /// le lot entier, jusqu'à deux cents saisies à reprendre une par une, pour
    /// un problème qui se règle en acceptant les conditions du wifi.
    test(
      'un 403 en HTML est un lien mort, pas un refus qui condamne le lot',
      () {
        final ApiException e = DioApi.classify(
          DioException(
            requestOptions: RequestOptions(path: '/api/v1/sync/push'),
            type: DioExceptionType.badResponse,
            response: Response<dynamic>(
              requestOptions: RequestOptions(path: '/api/v1/sync/push'),
              statusCode: 403,
              data: '<html><body>Connectez-vous au wifi</body></html>',
              headers: Headers.fromMap(<String, List<String>>{
                'content-type': <String>['text/html; charset=utf-8'],
              }),
            ),
          ),
          'push',
        );
        expect(e.code, DioApi.nonJsonResponseCode);
        expect(e.kind, FailureKind.unreachable);
        expect(e.isUnreachable, isTrue);
      },
    );

    /// Le filet ne doit PAS avaler un vrai refus. Notre serveur rend toujours du
    /// JSON avec un `code` : c'est ce couple qui le distingue d'un équipement
    /// intermédiaire, et le rejouer reproduirait le même refus.
    test('un 403 du serveur, en JSON, reste terminal', () {
      final ApiException e = DioApi.classify(
        DioException(
          requestOptions: RequestOptions(path: '/api/v1/sync/push'),
          type: DioExceptionType.badResponse,
          response: Response<dynamic>(
            requestOptions: RequestOptions(path: '/api/v1/sync/push'),
            statusCode: 403,
            data: <String, Object?>{
              'code': 'FORBIDDEN',
              'message': 'Accès refusé.',
            },
            headers: Headers.fromMap(<String, List<String>>{
              'content-type': <String>['application/json'],
            }),
          ),
        ),
        'push',
      );
      expect(e.code, 'FORBIDDEN');
      expect(e.kind, FailureKind.terminal);
    });

    /// 511 n'a pas besoin du filet : il est déjà `>= 500`, donc rejouable.
    test('un 511 reste rejouable sans passer par le filet', () {
      final ApiException e = DioApi.classify(
        DioException(
          requestOptions: RequestOptions(path: '/api/v1/sync/push'),
          type: DioExceptionType.badResponse,
          response: Response<dynamic>(
            requestOptions: RequestOptions(path: '/api/v1/sync/push'),
            statusCode: 511,
            data: '<html>portail</html>',
          ),
        ),
        'push',
      );
      expect(e.kind, FailureKind.retryable);
    });

    /// Sans état distinct, l'APK cesse simplement de recevoir des données et
    /// n'affiche qu'une erreur générique, sans jamais dire qu'il faut mettre à
    /// jour.
    test('un 426 est une mise à jour requise, pas un refus quelconque', () {
      final ApiException e = DioApi.classify(
        DioException(
          requestOptions: RequestOptions(path: '/api/v1/sync/pull'),
          type: DioExceptionType.badResponse,
          response: Response<dynamic>(
            requestOptions: RequestOptions(path: '/api/v1/sync/pull'),
            statusCode: DioApi.upgradeRequired,
            headers: Headers.fromMap(<String, List<String>>{
              Headers.contentTypeHeader: <String>['application/json'],
            }),
            data: <String, Object?>{
              'code': ServerErrorCodes.appUpdateRequired,
              'message': 'Installez la mise à jour.',
            },
          ),
        ),
        'pull',
      );
      expect(e.code, ServerErrorCodes.appUpdateRequired);
      expect(e.kind, FailureKind.appUpdateRequired);
      expect(e.retryable, isFalse);
    });

    /// Le refus de validation NOMME les opérations fautives. C'est le seul
    /// verdict par opération qu'une réponse d'erreur porte, et sans lui une
    /// seule saisie malformée condamne les cent quatre-vingt-dix-neuf autres.
    test('un 400 de validation désigne les opérations refusées', () {
      final ApiException e = DioApi.classify(
        DioException(
          requestOptions: RequestOptions(path: '/api/v1/sync/push'),
          type: DioExceptionType.badResponse,
          response: Response<dynamic>(
            requestOptions: RequestOptions(path: '/api/v1/sync/push'),
            statusCode: 400,
            headers: Headers.fromMap(<String, List<String>>{
              Headers.contentTypeHeader: <String>['application/json'],
            }),
            data: <String, Object?>{
              'code': 'BAD_REQUEST',
              'message': 'operations.3.data.nom must be a string',
              'details': <String>[
                'operations.3.data.nom must be a string',
                'operations.3.data.phone must be a string',
                'operations.11.entityId must be a UUID',
              ],
            },
          ),
        ),
        'push',
      );
      expect(e.kind, FailureKind.terminal);
      expect(e.rejectedOperations, <int>[3, 11]);
    });

    test('un refus qui ne nomme personne ne désigne aucune opération', () {
      final ApiException e = DioApi.classify(
        DioException(
          requestOptions: RequestOptions(path: '/api/v1/sync/push'),
          type: DioExceptionType.badResponse,
          response: Response<dynamic>(
            requestOptions: RequestOptions(path: '/api/v1/sync/push'),
            statusCode: 400,
            headers: Headers.fromMap(<String, List<String>>{
              Headers.contentTypeHeader: <String>['application/json'],
            }),
            data: <String, Object?>{
              'code': 'PAYLOAD_VERSION_UNSUPPORTED',
              'message': 'Format refusé.',
            },
          ),
        ),
        'push',
      );
      expect(e.rejectedOperations, isEmpty);
    });
  });

  group('corps 2xx illisible', () {
    /// Un client dont l'adaptateur rend exactement ce qu'on lui dit.
    DioApi apiAnswering(String body, {required String? contentType}) {
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://exemple.test'));
      dio.httpClientAdapter = _CannedAdapter(
        body: body,
        contentType: contentType,
      );
      return DioApi(CrmApiClient(dio: dio, interceptors: <Interceptor>[]));
    }

    test(
      'un portail captif ne condamne pas le lot : lien mort, pas refus',
      () async {
        // Hôtel, aéroport, salle de formation : la passerelle répond 200 avec sa
        // page de connexion à n'importe quelle requête. Classée `terminal`, elle
        // faisait passer les deux cents opérations du lot en `failed`, chacune à
        // reprendre à la main dans « À corriger ».
        final DioApi api = apiAnswering(
          '<html><body>Connectez-vous au Wi-Fi</body></html>',
          contentType: 'text/html; charset=utf-8',
        );

        await expectLater(
          api.push(
            batchId: 'b-1',
            payloadVersion: 1,
            operations: const <SyncOperationDto>[],
          ),
          throwsA(
            isA<ApiException>()
                .having((ApiException e) => e.code, 'code', 'NON_JSON_RESPONSE')
                .having(
                  (ApiException e) => e.kind,
                  'kind',
                  FailureKind.unreachable,
                ),
          ),
        );
      },
    );

    test(
      'sans content-type non plus : c\'est déjà le signe d\'un intermédiaire',
      () async {
        final DioApi api = apiAnswering('pas du JSON', contentType: null);
        await expectLater(
          api.push(
            batchId: 'b-1',
            payloadVersion: 1,
            operations: const <SyncOperationDto>[],
          ),
          throwsA(
            isA<ApiException>().having(
              (ApiException e) => e.kind,
              'kind',
              FailureKind.unreachable,
            ),
          ),
        );
      },
    );

    test('un JSON qui ne respecte pas le contrat reste TERMINAL', () async {
      // Là, c'est bien le serveur qui a répondu, et mal : le rejouer rendrait
      // le même corps. Huit tentatives silencieuses ne feraient que retarder le
      // moment où quelqu'un s'en aperçoit.
      final DioApi api = apiAnswering(
        jsonEncode(<String, Object?>{'batchId': 42}),
        contentType: 'application/json; charset=utf-8',
      );

      await expectLater(
        api.push(
          batchId: 'b-1',
          payloadVersion: 1,
          operations: const <SyncOperationDto>[],
        ),
        throwsA(
          isA<ApiException>()
              .having(
                (ApiException e) => e.code,
                'code',
                'RESPONSE_SCHEMA_MISMATCH',
              )
              .having((ApiException e) => e.kind, 'kind', FailureKind.terminal),
        ),
      );
    });

    /// ═══ UN 2xx À CORPS VIDE SORTAIT DE TOUTE CLASSIFICATION ═══
    ///
    /// `response.data!` sur un corps vide lève une `TypeError` : ni
    /// `DioException`, ni `FormatException`. Aucun des deux `catch` de `_guard`
    /// ne la voyait, et aucun `catch` du moteur non plus, qui ne visent que
    /// [ApiException]. Elle traversait `_sendBatch`, `drain` et `runOnce` :
    /// la ligne restait en `syncing`, bail vivant, jusqu'à l'expiration du bail.
    /// Deux minutes pendant lesquelles la file ne bouge plus et l'interface
    /// n'a rien à dire.
    test('un 2xx à corps VIDE est classé, jamais lâché en TypeError', () async {
      final DioApi api = apiAnswering(
        '',
        contentType: 'application/json; charset=utf-8',
      );

      await expectLater(
        api.push(
          batchId: 'b-1',
          payloadVersion: 1,
          operations: const <SyncOperationDto>[],
        ),
        throwsA(
          isA<ApiException>()
              .having(
                (ApiException e) => e.code,
                'code',
                'RESPONSE_SCHEMA_MISMATCH',
              )
              .having((ApiException e) => e.kind, 'kind', FailureKind.terminal),
        ),
      );
    });

    test('un corps vide SANS content-type JSON reste un lien mort', () async {
      // La coupure d'un proxy d'opérateur : 200, rien dedans, pas de type. Le
      // serveur n'a rien refusé, donc aucune tentative ne doit être comptée.
      final DioApi api = apiAnswering('', contentType: null);

      await expectLater(
        api.pull(payloadVersion: 4),
        throwsA(
          isA<ApiException>()
              .having(
                (ApiException e) => e.code,
                'code',
                DioApi.nonJsonResponseCode,
              )
              .having(
                (ApiException e) => e.kind,
                'kind',
                FailureKind.unreachable,
              ),
        ),
      );
    });
  });

  /// L'annuaire de phase 2 était le dernier appel écrit à la main, URL et noms
  /// de champs en dur, sous un TODO qui promettait sa disparition « quand
  /// `openapi.json` couvrira la route ». Elle la couvrait déjà. Le passage à
  /// `Phase2Api.pullPhase2Directory` doit conserver trois propriétés que le
  /// bloc brut portait, et qu'aucune ne se déduit du type de retour.
  group('annuaire de phase 2 : le client généré, plus jamais Dio en direct', () {
    /// Le corps que le serveur rend réellement, à la clé près.
    String directoryBody(List<Map<String, Object?>> entries) =>
        jsonEncode(<String, Object?>{
          'entries': entries,
          'nextCursor': 'c-suivant',
          'hasMore': false,
          'serverTime': '2026-08-15T10:00:00.000Z',
        });

    Map<String, Object?> entryJson({
      String phase2Status = 'METHOD_OBTAINED',
      Object? enrollmentMethod = 'PLATFORM',
      Object rev = 7,
      Map<String, Object?> extra = const <String, Object?>{},
    }) => <String, Object?>{
      'prospectId': 'p-1',
      'phoneE164': '+221771234567',
      'phase2Status': phase2Status,
      'enrollmentMethod': enrollmentMethod,
      'rev': rev,
      'updatedAt': '2026-08-15T09:30:00.000Z',
      ...extra,
    };

    /// Le vrai [DioApi], monté sur cet adaptateur, avec l'intercepteur de délai
    /// que l'application installe : c'est lui qui traduit `Options.extra` en
    /// `receiveTimeout`, et sans lui on ne testerait pas la chaîne complète.
    DioApi apiOn(_CannedAdapter adapter) {
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://exemple.test'));
      dio.httpClientAdapter = adapter;
      return DioApi(
        CrmApiClient(
          dio: dio,
          interceptors: <Interceptor>[const TimeoutProfileInterceptor()],
        ),
      );
    }

    test('le tout premier téléchargement n\'envoie PAS `since`', () async {
      // `DirectoryQueryDto` valide `@MinLength(1)` sur `since`, et cette
      // contrainte n'apparaît PAS dans `openapi.json` : le client généré n'omet
      // donc que `null` et mettrait `since=` sur le fil pour une chaîne vide.
      // Le serveur la refuserait en 400, classé terminal : sur un appareil
      // neuf, l'annuaire ne se téléchargerait jamais.
      for (final String? cursor in <String?>[null, '']) {
        final _CannedAdapter adapter = _CannedAdapter(
          body: directoryBody(const <Map<String, Object?>>[]),
        );
        await apiOn(adapter).pullPhase2Directory(cursor: cursor);
        final Map<String, String> query =
            adapter.lastRequest!.uri.queryParameters;
        expect(
          query.containsKey('since'),
          isFalse,
          reason: 'curseur ${cursor == null ? 'nul' : 'vide'}',
        );
        expect(query['limit'], '2000');
      }
    });

    test('un curseur réel, lui, part bien en `since`', () async {
      final _CannedAdapter adapter = _CannedAdapter(
        body: directoryBody(const <Map<String, Object?>>[]),
      );
      await apiOn(adapter).pullPhase2Directory(cursor: 'c-42', limit: 500);
      final Map<String, String> query =
          adapter.lastRequest!.uri.queryParameters;
      expect(query['since'], 'c-42');
      expect(query['limit'], '500');
    });

    test(
      'le profil de délai traverse le client généré jusqu\'au transport',
      () async {
        // Le client généré n'expose pas de paramètre de délai : le profil passe
        // par `Options.extra`. Perdu en route, il laisse les 3 s que Dio se donne
        // par défaut, et une page de 2 000 entrées n'arrive jamais en 2G.
        final _CannedAdapter adapter = _CannedAdapter(
          body: directoryBody(const <Map<String, Object?>>[]),
        );
        await apiOn(adapter).pullPhase2Directory();
        expect(
          adapter.lastRequest!.extra[TimeoutProfile.extraKey],
          TimeoutProfile.read.name,
        );
        expect(
          adapter.lastRequest!.receiveTimeout,
          TimeoutProfile.read.receive,
        );
      },
    );

    /// ═══ LE LOT NE POUVAIT PAS PARTIR SUR UN LIEN MONTANT LENT ═══
    ///
    /// `sendTimeout` est le budget TOTAL d'émission du corps dans dio 5, pas un
    /// délai d'inactivité. Laissé aux 30 s de `BaseOptions`, un lot de 512 Ko
    /// n'a aucune chance sur EDGE : il expirait à chaque cycle, était
    /// reconstruit à l'identique, et ne devenait jamais visible.
    test('le push a de quoi émettre son lot sur EDGE', () {
      const int maxBatchBits = SyncEngine.defaultMaxBatchBytes * 8;
      // Débit montant réaliste d'un EDGE chargé, en bits par seconde.
      const int edgeUplink = 20000;
      expect(
        TimeoutProfile.push.send,
        isNotNull,
        reason: 'sans profil, le push retombe sur les 30 s de BaseOptions',
      );
      expect(
        TimeoutProfile.push.send!.inSeconds,
        greaterThanOrEqualTo(maxBatchBits ~/ edgeUplink),
      );
    });

    test('une note vocale garde un délai adapté à son poids', () async {
      final File recording = File(
        '${Directory.systemTemp.path}/cpi-recording-timeout-${DateTime.now().microsecondsSinceEpoch}.m4a',
      );
      addTearDown(() {
        if (recording.existsSync()) recording.deleteSync();
      });
      recording.writeAsBytesSync(<int>[1, 2, 3]);
      final _CannedAdapter adapter = _CannedAdapter(
        body: jsonEncode(<String, Object?>{
          'attemptId': 'attempt-1',
          'bytes': 3,
        }),
      );

      await apiOn(
        adapter,
      ).uploadCallRecording(attemptId: 'attempt-1', path: recording.path);

      expect(
        adapter.lastRequest!.extra[TimeoutProfile.extraKey],
        TimeoutProfile.upload.name,
      );
      expect(
        adapter.lastRequest!.receiveTimeout,
        TimeoutProfile.upload.receive,
      );
      expect(adapter.lastRequest!.sendTimeout, TimeoutProfile.upload.send);
    });

    test(
      'un portail captif sur l\'annuaire reste un lien mort, pas un refus',
      () async {
        // Le commercial est en salle de formation ou à l'hôtel : la passerelle
        // répond 200 avec sa page de connexion. Le client généré emballe l'échec
        // de désérialisation dans un `DioException(type: unknown)` portant la
        // réponse 2xx : c'est `_guard` qui doit y relire le `content-type`.
        final _CannedAdapter adapter = _CannedAdapter(
          body: '<html><body>Connectez-vous au Wi-Fi</body></html>',
          contentType: 'text/html; charset=utf-8',
        );
        await expectLater(
          apiOn(adapter).pullPhase2Directory(),
          throwsA(
            isA<ApiException>()
                .having(
                  (ApiException e) => e.code,
                  'code',
                  DioApi.nonJsonResponseCode,
                )
                .having(
                  (ApiException e) => e.kind,
                  'kind',
                  FailureKind.unreachable,
                ),
          ),
        );
      },
    );

    test('un JSON hors contrat sur l\'annuaire, lui, reste TERMINAL', () async {
      final _CannedAdapter adapter = _CannedAdapter(
        body: jsonEncode(<String, Object?>{'entries': 42}),
      );
      await expectLater(
        apiOn(adapter).pullPhase2Directory(),
        throwsA(
          isA<ApiException>()
              .having(
                (ApiException e) => e.code,
                'code',
                'RESPONSE_SCHEMA_MISMATCH',
              )
              .having((ApiException e) => e.kind, 'kind', FailureKind.terminal),
        ),
      );
    });

    test(
      'six champs traversent, et le serveur peut bien en envoyer trente',
      () async {
        // La frontière de confidentialité se tient CÔTÉ CLIENT aussi : l'annuaire
        // est répliqué sur le téléphone personnel du commercial et couvre tout le
        // portefeuille. Ni nom, ni banque, ni syndicat, même envoyés.
        final _CannedAdapter adapter = _CannedAdapter(
          body: directoryBody(<Map<String, Object?>>[
            entryJson(
              extra: const <String, Object?>{
                'fullName': 'Aminata Diallo',
                'banque': 'CBAO',
                'syndicat': 'SUDES',
                'adresse': 'Dakar, Plateau',
              },
            ),
          ]),
        );
        final Phase2DirectoryPage page = await apiOn(
          adapter,
        ).pullPhase2Directory();
        final Phase2DirectoryEntry entry = page.entries.single;
        expect(entry.prospectId, 'p-1');
        expect(entry.phoneE164, '+221771234567');
        expect(entry.phase2Status, 'METHOD_OBTAINED');
        expect(entry.enrollmentMethod, 'PLATFORM');
        expect(entry.rev, 7);
        expect(entry.updatedAt, DateTime.utc(2026, 8, 15, 9, 30));
        expect(page.nextCursor, 'c-suivant');
        expect(page.hasMore, isFalse);
        expect(page.serverTime, DateTime.utc(2026, 8, 15, 10));
      },
    );

    test(
      'le DTO généré ne porte que ces six champs : un septième fait tomber ce test',
      () {
        // Le seul point où l'ajout d'un champ côté serveur devient visible. Sans
        // lui, `openapi.json` régénérerait un `DirectoryEntryDto` élargi et
        // personne ne se demanderait si ce champ a le droit de descendre sur les
        // téléphones. C'est une décision humaine, pas une régénération.
        expect(
          DirectoryEntryDto(
            prospectId: 'p-1',
            phoneE164: '+221771234567',
            phase2Status: Phase2Status.PENDING,
            enrollmentMethod: null,
            rev: 1,
            updatedAt: DateTime.utc(2026),
          ).toJson().keys.toSet(),
          <String>{
            'prospectId',
            'phoneE164',
            'phase2Status',
            'enrollmentMethod',
            'rev',
            'updatedAt',
          },
        );
      },
    );

    test(
      'un statut que ce client ne connaît pas encore n\'invalide pas la page',
      () async {
        // `enumUnknownDefaultCase: true` existe pour ça : un membre ajouté côté
        // serveur ne doit pas faire échouer un annuaire de 500 000 lignes. On
        // rend la chaîne DU CONTRAT (`.value`) et non l'identifiant Dart
        // (`.name`), qui n'existe nulle part côté serveur.
        final _CannedAdapter adapter = _CannedAdapter(
          body: directoryBody(<Map<String, Object?>>[
            entryJson(phase2Status: 'EXPIRED'),
          ]),
        );
        final Phase2DirectoryPage page = await apiOn(
          adapter,
        ).pullPhase2Directory();
        expect(
          page.entries.single.phase2Status,
          Phase2Status.unknownDefaultOpenApi.value,
        );
        expect(page.entries.single.phase2Status, 'unknown_default_open_api');
      },
    );

    test(
      '`rev` flottant redescend en entier : la colonne locale l\'est',
      () async {
        // JSON ne distingue pas entier et flottant, et le contrat déclare `rev`
        // en `number` : un sérialiseur qui écrirait `7.0` doit rester lisible.
        final _CannedAdapter adapter = _CannedAdapter(
          body: directoryBody(<Map<String, Object?>>[entryJson(rev: 7.0)]),
        );
        final Phase2DirectoryPage page = await apiOn(
          adapter,
        ).pullPhase2Directory();
        expect(page.entries.single.rev, 7);
        expect(page.entries.single.rev, isA<int>());
      },
    );
  });

  group('ResponseFormatException', () {
    test('reconnaît les variantes de JSON', () {
      expect(
        ResponseFormatException('x', 'application/json; charset=utf-8').isJson,
        isTrue,
      );
      expect(
        ResponseFormatException('x', 'application/problem+json').isJson,
        isTrue,
      );
      expect(ResponseFormatException('x', 'text/html').isJson, isFalse);
      expect(ResponseFormatException('x', null).isJson, isFalse);
    });
  });
}

/// Adaptateur qui rend toujours la même réponse, sans réseau, et **retient la
/// requête telle qu'elle est partie**.
///
/// Retenir la requête est ce qui permet de vérifier ce que le client généré met
/// réellement sur le fil : un paramètre omis plutôt qu'envoyé vide, un profil de
/// délai qui a bien traversé les intercepteurs. Sans cela, on ne testerait que
/// le décodage de la réponse, c'est-à-dire la moitié du contrat.
class _CannedAdapter implements HttpClientAdapter {
  _CannedAdapter({
    required this.body,
    this.contentType = 'application/json; charset=utf-8',
  });

  final String body;
  final String? contentType;

  /// La dernière requête vue par le transport, intercepteurs appliqués.
  RequestOptions? lastRequest;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastRequest = options;
    return ResponseBody.fromString(
      body,
      200,
      headers: <String, List<String>>{
        if (contentType != null)
          Headers.contentTypeHeader: <String>[contentType!],
      },
    );
  }
}
