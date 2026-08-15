/// Erreur typée de fin de session : **Dart pur**.
///
/// Typée et non « une `DioException` de plus » : quand le renouvellement du
/// jeton échoue, *toutes* les requêtes en vol doivent échouer de la même façon
/// et l'UI doit pouvoir distinguer « pas de réseau » (on garde la session, on
/// réessaiera) de « la session est morte » (on déconnecte). Un code d'erreur
/// dans une chaîne de caractères se serait perdu au premier `catch (e)`.
class SessionExpired implements Exception {
  const SessionExpired([this.cause]);

  final Object? cause;

  @override
  String toString() => 'SessionExpired(${cause ?? 'refresh refusé'})';
}
