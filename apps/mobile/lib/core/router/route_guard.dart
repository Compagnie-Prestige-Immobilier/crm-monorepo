import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/shell/projects.dart';
import 'route_paths.dart';

/// Le refus d'entrer dans un projet fermé, à dire UNE fois, sur la coque
/// d'arrivée. `null` quand il n'y a rien à annoncer.
final NotifierProvider<AccesRefuse, String?> accesRefuseProvider =
    NotifierProvider<AccesRefuse, String?>(AccesRefuse.new);

class AccesRefuse extends Notifier<String?> {
  static const String message = 'Vous n\'avez pas accès à ce projet.';

  @override
  String? build() => null;

  void poser() => state = message;

  void consommer() {
    if (state != null) state = null;
  }
}

/// Le filet de sécurité des coques : personne n'entre dans un projet fermé à
/// son rôle, par quelque chemin que ce soit.
///
/// `redirect` refuse déjà les adresses interdites, mais il ne rejoue pas quand
/// c'est le RÔLE qui change sous les pieds — jeton rafraîchi, rétrogradation
/// décidée côté serveur. Ce garde-là écoute les deux, et renvoie d'où l'on
/// vient plutôt qu'à un accueil générique.
class RouteGuard {
  RouteGuard({required this.role, required this.onRefus});

  final String? Function() role;
  final VoidCallback onRefus;

  static const int memoire = 10;

  final List<String> _autorisees = <String>[];

  GoRouter? _router;

  bool _enVol = false;

  /// Le routeur ne peut pas être passé au constructeur : son `redirect`
  /// interroge déjà ce garde-là pour savoir où renvoyer.
  void attacher(GoRouter router) => _router = router;

  void verifier() {
    final GoRouter? router = _router;
    if (router == null || _enVol) return;

    final RouteMatchList config = router.routerDelegate.currentConfiguration;
    if (config.isEmpty) return;
    final String location = config.uri.toString();
    final String? courant = role();

    if (autorise(config.uri.path, courant)) {
      _retenir(location);
      return;
    }

    final String cible = repli(courant);
    // Rien de mieux à proposer : y renvoyer relancerait ce même contrôle.
    if (cible == location) return;

    _enVol = true;
    onRefus();
    // Jamais pendant une construction : `go` reconstruit l'arbre qui appelle.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _enVol = false;
      router.go(cible);
    });
  }

  /// La dernière adresse qui a passé le contrôle, pour savoir d'où l'on vient.
  void _retenir(String location) {
    if (_autorisees.isNotEmpty && _autorisees.last == location) return;
    _autorisees.add(location);
    if (_autorisees.length > memoire) _autorisees.removeAt(0);
  }

  /// D'où l'on vient si c'est encore permis, sinon la porte du rôle. Un rôle
  /// rétrogradé voit les adresses devenues interdites sautées une à une.
  String repli(String? courant) {
    _autorisees.removeWhere((String vue) => !autorise(_cheminDe(vue), courant));
    return _autorisees.isEmpty ? atterrissage(courant) : _autorisees.last;
  }

  static String _cheminDe(String location) =>
      Uri.tryParse(location)?.path ?? location;

  static bool autorise(String path, String? role) {
    final CpiProject? projet = CpiProject.duChemin(path);
    return projet == null || projet.isOpenTo(role);
  }

  /// Là où un rôle atterrit quand il n'a nulle part d'où revenir : sa porte
  /// unique s'il n'en a qu'une, le hub sinon.
  static String atterrissage(String? role) {
    final List<CpiProject> ouverts = CpiProject.values
        .where((CpiProject p) => p.isOpenTo(role))
        .toList(growable: false);
    return ouverts.length == 1 ? ouverts.single.path : Routes.home;
  }
}
