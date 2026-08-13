import 'dart:convert';
import 'dart:developer' as developer;

import 'package:shared_preferences/shared_preferences.dart';

import 'route_paths.dart';

/// Mémorise la dernière route pour la restaurer au démarrage à froid.
///
/// Android tue une application en arrière-plan sans prévenir, en particulier sur
/// les appareils visés ici. Un commercial qui prend un appel au milieu d'une
/// fiche doit retrouver sa fiche, pas l'accueil.
///
/// ## Quatre conditions, toutes nécessaires
///
/// 1. **Session valide.** Restaurer `/representants/nouveau` pour un utilisateur
///    déconnecté produirait un écran vide derrière un garde de route.
/// 2. **Même numéro de build.** Une mise à jour peut avoir déplacé ou supprimé
///    la route ; la restaurer ouvrirait l'app sur un « Page introuvable ». Le
///    numéro de build est la seule information qui distingue deux versions
///    installées successivement.
/// 3. **Moins de 24 h.** Au-delà, l'intention de l'utilisateur a expiré : il
///    ouvre l'app pour faire autre chose.
/// 4. **Route dans une liste blanche explicite.** Une liste blanche et pas une
///    liste noire : la liste noire oublie toujours la route ajoutée le mois
///    suivant, et l'oubli ne se voit qu'en production.
///
/// ## Pourquoi `?draft=<id>` et pas l'état du formulaire dans l'URL
///
/// La route transporte **une référence** au brouillon, jamais son contenu. Les
/// deux mécanismes restent ainsi indépendants : une URL corrompue ne détruit pas
/// la saisie, un brouillon illisible n'empêche pas d'ouvrir l'écran. Sérialiser
/// le formulaire dans l'URL les couple, et la panne de l'un devient la panne des
/// deux — en plus de faire transiter des noms et des téléphones dans un
/// historique de navigation.
class RouteMemory {
  RouteMemory(this._prefs, {required this.buildNumber});

  static const String _key = 'route_memory.v2';
  static const Duration maxAge = Duration(hours: 24);

  /// Préfixes restaurables. Tout le reste retombe sur l'accueil.
  static const List<String> allowList = <String>[
    Routes.home,
    Routes.representants,
    Routes.newRepresentant,
    Routes.prospects,
    Routes.newProspect,
    Routes.corrections,
    Routes.historique,
    // Restaurable : une pile d'appels se traite en une session, et l'app tuée
    // par le système au milieu doit rouvrir sur l'écran de saisie. Rien n'y est
    // transporté dans l'URL — ni numéro, ni identifiant de prospect — donc la
    // restauration ne fait fuiter aucune donnée dans l'historique.
    Routes.phase2,
    Routes.notifications,
  ];

  final SharedPreferences _prefs;

  /// `versionCode` Android. Fourni par `package_info_plus` au démarrage.
  final String buildNumber;

  /// Lit la route restaurable, ou `null`.
  ///
  /// [authenticated] est passé par l'appelant plutôt que lu ici : cette classe
  /// est du stockage, pas un garde de session, et la faire dépendre de l'état
  /// d'authentification la rendrait impossible à tester seule.
  String? read({required bool authenticated, DateTime? now}) {
    if (!authenticated) return null;
    final String? raw = _prefs.getString(_key);
    if (raw == null || raw.isEmpty) return null;

    final Map<String, Object?> record;
    try {
      final Object? decoded = jsonDecode(raw);
      if (decoded is! Map) throw const FormatException('mémoire de route non objet');
      record = decoded.cast<String, Object?>();
    } on FormatException catch (e) {
      // Même règle que pour les brouillons : on jette et on journalise. Une
      // mémoire de route illisible ne doit pas empêcher l'app de démarrer.
      developer.log('Mémoire de route illisible, effacée : $e', name: 'cpi.route');
      unawaitedClear();
      return null;
    }

    if (record['build'] != buildNumber) return null;

    final int? stamp = record['at'] as int?;
    if (stamp == null) return null;
    final DateTime savedAt = DateTime.fromMillisecondsSinceEpoch(stamp, isUtc: true);
    if ((now ?? DateTime.now().toUtc()).difference(savedAt) > maxAge) return null;

    final Object? location = record['uri'];
    if (location is! String || location.isEmpty) return null;
    if (!isRestorable(location)) return null;
    return location;
  }

  /// Index de branche du shell (barre de navigation), pour rouvrir sur le bon
  /// onglet. Séparé de l'URI : une branche invalide ne doit pas invalider la
  /// route.
  int readBranchIndex() {
    final String? raw = _prefs.getString(_key);
    if (raw == null) return 0;
    try {
      final Object? decoded = jsonDecode(raw);
      if (decoded is Map && decoded['branch'] is int) return decoded['branch'] as int;
    } on FormatException {
      return 0;
    }
    return 0;
  }

  Future<void> write(String location, {int branchIndex = 0, DateTime? now}) async {
    if (!isRestorable(location)) return;
    await _prefs.setString(
      _key,
      jsonEncode(<String, Object?>{
        // L'URI COMPLÈTE, paramètres de requête compris — c'est `?draft=<id>`
        // qui ramène la saisie en cours.
        'uri': location,
        'branch': branchIndex,
        'build': buildNumber,
        'at': (now ?? DateTime.now().toUtc()).millisecondsSinceEpoch,
      }),
    );
  }

  Future<void> clear() => _prefs.remove(_key);

  void unawaitedClear() {
    // Volontairement non attendu : appelé depuis un chemin synchrone de lecture.
    clear().ignore();
  }

  /// Liste blanche : le chemin doit correspondre exactement à une entrée, ou en
  /// être un sous-chemin direct.
  static bool isRestorable(String location) {
    if (Routes.isPublic(location)) return false;
    final Uri uri = Uri.tryParse(location) ?? Uri(path: location);
    final String path = uri.path.isEmpty ? Routes.home : uri.path;
    for (final String allowed in allowList) {
      if (path == allowed) return true;
      if (allowed != Routes.home && path.startsWith('$allowed/')) return true;
    }
    return false;
  }
}
