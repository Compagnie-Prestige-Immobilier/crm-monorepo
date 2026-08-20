import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/sync/api_port.dart';
import '../../core/sync/dio_api.dart';

/// Le registre des visites n'a ni table locale ni flux de synchronisation : ces
/// trois appels partent directement au serveur et échouent sans réseau.
abstract interface class VisitesPort {
  Future<VisiteReferentielsBundleDto> referentiels();

  Future<List<VisiteDto>> registre({required String jour});

  Future<VisiteDto> inscrire(CreateVisiteDto visite);
}

class DioVisitesPort implements VisitesPort {
  const DioVisitesPort(this._api);

  final VisitesApi _api;

  @override
  Future<VisiteReferentielsBundleDto> referentiels() =>
      _send('referentiels', () => _api.listVisiteReferentiels());

  @override
  Future<List<VisiteDto>> registre({required String jour}) async {
    final VisiteListDto page = await _send(
      'registre',
      () => _api.listVisites(from: jour, to: jour, pageSize: kRegistrePageSize),
    );
    return page.items;
  }

  @override
  Future<VisiteDto> inscrire(CreateVisiteDto visite) =>
      _send('inscription', () => _api.createVisite(createVisiteDto: visite));

  Future<T> _send<T>(String operation, Future<Response<T>> Function() call) async {
    try {
      final Response<T> response = await call();
      final T? body = response.data;
      if (body == null) {
        throw const ApiException(
          'EMPTY_RESPONSE',
          message: 'Le serveur a répondu sans contenu.',
          kind: FailureKind.terminal,
        );
      }
      return body;
    } on DioException catch (error) {
      throw DioApi.classify(error, operation);
    }
  }
}

/// Le maximum accepté par l'API. Une journée d'accueil tient très en dessous.
const int kRegistrePageSize = 200;

final Provider<VisitesPort> visitesPortProvider = Provider<VisitesPort>((Ref ref) {
  return DioVisitesPort(ref.watch(apiClientProvider).client.getVisitesApi());
});

final FutureProvider<VisiteReferentielsBundleDto> visiteReferentielsProvider =
    FutureProvider<VisiteReferentielsBundleDto>((Ref ref) {
      return ref.watch(visitesPortProvider).referentiels();
    });

final FutureProvider<List<VisiteDto>> registreDuJourProvider =
    FutureProvider<List<VisiteDto>>((Ref ref) {
      final String jour = jourDakar(ref.watch(clockProvider).now());
      return ref.watch(visitesPortProvider).registre(jour: jour);
    });

/// Dakar est à UTC toute l'année : l'horloge du serveur et la sienne coïncident.
String jourDakar(DateTime at) {
  final DateTime utc = at.toUtc();
  return '${utc.year.toString().padLeft(4, '0')}-'
      '${utc.month.toString().padLeft(2, '0')}-'
      '${utc.day.toString().padLeft(2, '0')}';
}

String heureDakar(DateTime at) {
  final DateTime utc = at.toUtc();
  return '${utc.hour.toString().padLeft(2, '0')}:'
      '${utc.minute.toString().padLeft(2, '0')}';
}

final Set<String> _rolesDuRegistre = <String>{
  Role.ADMIN.value,
  Role.DIRECTION.value,
  Role.ACCUEIL.value,
};

bool peutTenirLeRegistre(String? role) =>
    role != null && _rolesDuRegistre.contains(role.toUpperCase());

String messageErreur(Object error) {
  if (error is ApiException) {
    final String? message = error.message;
    if (message != null && message.trim().isNotEmpty) return message;
    return 'Erreur ${error.code}.';
  }
  return '$error';
}
