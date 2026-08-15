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
/// deux : en plus de faire transiter des noms et des téléphones dans un
/// historique de navigation.
class RouteMemory {
  RouteMemory(this._prefs, {required this.buildNumber, this.draftExists});

  /// « Reste-t-il une saisie inachevée sous cet identifiant ? »
  ///
  /// Injectée et non lue ici : cette classe est du stockage de préférences, elle
  /// n'a pas à connaître la base locale. `null` en test et dans les aperçus, où
  /// la question ne se pose pas.
  final Future<bool> Function(String draftId)? draftExists;

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
    // transporté dans l'URL : ni numéro, ni identifiant de prospect : donc la
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

  /// ═══ L'INDEX DE BRANCHE A ÉTÉ SUPPRIMÉ ═══
  ///
  /// Un champ `branch` était écrit à chaque mémorisation et relu par une méthode
  /// `readBranchIndex()` que **seul un test appelait** : la production ne l'a
  /// jamais consultée. Et elle n'en a pas besoin :
  /// `StatefulShellRoute.indexedStack` déduit l'onglet de l'URL restaurée, donc
  /// l'index était au mieux redondant, au pire une seconde source de vérité qui
  /// pouvait contredire la première. Un test vert sur du code mort donne
  /// l'illusion d'une fonctionnalité couverte.

  /// Mémorise l'adresse courante, ou **efface la mémoire** si elle ne l'est pas.
  ///
  /// L'ancienne version se contentait de renoncer sur une route non
  /// restaurable : l'entrée précédente survivait donc intacte. Un commercial qui
  /// quittait un formulaire pour Réglages, puis fermait l'app, rouvrait sur le
  /// formulaire : jusqu'à 24 h plus tard, sur une saisie qu'il avait sciemment
  /// abandonnée. La mémoire doit suivre l'intention, pas la dernière adresse qui
  /// s'est trouvée mémorisable.
  Future<void> write(String location, {DateTime? now}) async {
    // La protection du brouillon prime dans les DEUX chemins : c'est elle qui
    // empêche un simple retour arrière d'orpheliner une saisie en cours.
    if (await _wouldBuryADraft(location)) return;
    // Une route PUBLIQUE (connexion, accueil d'intégration) n'est pas une
    // intention de l'utilisateur, c'est une porte : le garde de session l'y a
    // envoyé. Effacer ici renverrait le commercial sur l'accueil après
    // reconnexion, alors qu'il était au milieu d'une fiche. On laisse donc la
    // mémoire intacte : c'est `read` qui refusera de restaurer sans session.
    if (Routes.isPublic(location)) return;
    if (!isRestorable(location)) {
      await clear();
      return;
    }
    await _prefs.setString(
      _key,
      jsonEncode(<String, Object?>{
        // L'URI COMPLÈTE, paramètres de requête compris : c'est `?draft=<id>`
        // qui ramène la saisie en cours.
        'uri': location,
        'build': buildNumber,
        'at': (now ?? DateTime.now().toUtc()).millisecondsSinceEpoch,
      }),
    );
  }

  /// L'écriture entrante enterrerait-elle l'adresse d'une saisie en cours ?
  ///
  /// ═══ LE SCÉNARIO ═══
  ///
  /// La mémorisation écoute le `routerDelegate` : **chaque** changement d'adresse
  /// la déclenche, y compris un retour arrière. Un commercial ouvre
  /// « Nouveau représentant » depuis le sélecteur, tape un nom, revient d'un
  /// geste pour vérifier une fiche : `/representants/nouveau?draft=X` est aussitôt
  /// remplacé par `/representants`. Le système tue le processus dix secondes plus
  /// tard, et la restauration à froid rouvre le sélecteur : le brouillon est
  /// toujours en base, mais plus aucune adresse ne le désigne.
  ///
  /// On refuse donc l'écrasement quand les TROIS conditions tiennent :
  ///
  /// 1. l'adresse mémorisée porte une référence de brouillon ;
  /// 2. l'adresse entrante en est un ANCÊTRE direct (`/representants` face à
  ///    `/representants/nouveau`) : un vrai changement de contexte
  ///    (`/prospects/nouveau`, `/historique`) écrase normalement, sans quoi la
  ///    mémoire se figerait pour de bon ;
  /// 3. le brouillon existe encore. Enregistré ou supprimé, il n'y a plus rien
  ///    à protéger et l'écriture reprend son cours.
  Future<bool> _wouldBuryADraft(String incoming) async {
    final Future<bool> Function(String)? lookup = draftExists;
    if (lookup == null) return false;

    final String? stored = _prefs.getString(_key);
    if (stored == null || stored.isEmpty) return false;

    final String? location = _locationOf(stored);
    if (location == null) return false;

    final Uri storedUri = Uri.tryParse(location) ?? Uri(path: location);
    final String? draftId = storedUri.queryParameters[Routes.draftParam];
    if (draftId == null || draftId.isEmpty) return false;

    if (!_isAncestor(incoming, storedUri.path)) return false;
    return lookup(draftId);
  }

  String? _locationOf(String raw) {
    try {
      final Object? decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final Object? uri = decoded['uri'];
      return uri is String && uri.isNotEmpty ? uri : null;
    } on FormatException {
      return null;
    }
  }

  /// `/representants` est un ancêtre de `/representants/nouveau`. L'accueil, non :
  /// il est ancêtre de tout, et le traiter comme tel figerait la mémoire dès
  /// qu'un brouillon existe quelque part.
  static bool _isAncestor(String incoming, String storedPath) {
    final Uri uri = Uri.tryParse(incoming) ?? Uri(path: incoming);
    final String path = uri.path.isEmpty ? Routes.home : uri.path;
    if (path == Routes.home) return false;
    return storedPath.startsWith('$path/');
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
