import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/sync/api_port.dart';
import '../../core/sync/dio_api.dart';
import '../../data/local/database.dart';

/// Les listes de l'accueil (entreprises, objets, directions, destinataires)
/// restent en ligne : elles alimentent le formulaire, changent rarement, et
/// leur échec s'affiche déjà à l'écran. Le registre lui-même, lu et écrit hors
/// ligne, vit dans la table locale `visites` et le moteur de synchronisation.
abstract interface class VisitesPort {
  Future<VisiteReferentielsBundleDto> referentiels();
}

class DioVisitesPort implements VisitesPort {
  const DioVisitesPort(this._api);

  final VisitesApi _api;

  @override
  Future<VisiteReferentielsBundleDto> referentiels() =>
      _send('referentiels', () => _api.listVisiteReferentiels());

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

final Provider<VisitesPort> visitesPortProvider = Provider<VisitesPort>((Ref ref) {
  return DioVisitesPort(ref.watch(apiClientProvider).client.getVisitesApi());
});

final FutureProvider<VisiteReferentielsBundleDto> visiteReferentielsProvider =
    FutureProvider<VisiteReferentielsBundleDto>((Ref ref) {
      return ref.watch(visitesPortProvider).referentiels();
    });

/// Le registre du jour, lu en local : il tient sans réseau, comme le reste de
/// l'application. Une inscription hors ligne y apparaît immédiatement, sa
/// référence complétée dès que le pull suivant la redescend.
final StreamProvider<List<Visite>> registreDuJourProvider =
    StreamProvider<List<Visite>>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      final String jour = jourDakar(ref.watch(clockProvider).now());
      return db.registreDuJour(jour: jour).watch();
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
