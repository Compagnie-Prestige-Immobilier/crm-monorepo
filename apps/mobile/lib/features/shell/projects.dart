import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/router/route_paths.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/forui_theme.dart';
import '../accueil/visites_repository.dart';

const Set<Role> _encadrement = <Role>{
  Role.ADMIN,
  Role.SUPERVISEUR,
  Role.DIRECTION,
};

enum CpiProject {
  accueil(
    label: 'Accueil',
    tagline: 'Registre des visites',
    path: Routes.accueil,
    icon: PhosphorIconsRegular.doorOpen,
  ),
  chues(
    label: 'Projet CHUES',
    // La CHUES est une coopérative d'habitat, pas un syndicat : « enseignants
    // syndiqués » désignait un public qui n'est pas le sien.
    tagline: 'Enseignants membres de la CHUES',
    path: Routes.chues,
    icon: PhosphorIconsRegular.chalkboardTeacher,
  ),
  grandPublic(
    label: 'Projet Grand Public',
    tagline: 'Enrôlement hors CHUES',
    path: Routes.grandPublic,
    icon: PhosphorIconsRegular.usersThree,
  );

  const CpiProject({
    required this.label,
    required this.tagline,
    required this.path,
    required this.icon,
  });

  final String label;
  final String tagline;

  /// Le premier onglet de la coque : c'est aussi l'adresse du projet.
  final String path;
  final IconData icon;

  /// Les trois coques portent les mêmes destinations transverses sous des
  /// chemins différents : `go_router` n'admet pas une même route dans deux
  /// coques, et un écran partagé ne peut donc pas les nommer en dur.
  String get corrections => switch (this) {
    CpiProject.accueil => Routes.accueilCorrections,
    CpiProject.grandPublic => Routes.grandPublicCorrections,
    CpiProject.chues => Routes.corrections,
  };

  String get reglages => switch (this) {
    CpiProject.accueil => Routes.accueilReglages,
    CpiProject.grandPublic => Routes.grandPublicReglages,
    CpiProject.chues => Routes.reglages,
  };

  /// L'onglet qui liste les saisies déjà faites. L'accueil n'en a pas de
  /// séparé : son registre EST la liste.
  String get fiches => switch (this) {
    CpiProject.accueil => Routes.accueil,
    CpiProject.grandPublic => Routes.grandPublicFiches,
    CpiProject.chues => Routes.historique,
  };

  /// Les pages qui n'appartiennent à aucun projet : elles se poussent
  /// par-dessus n'importe quelle coque et aucun rôle ne s'en voit refuser
  /// l'entrée. `/reglages` n'en est pas : c'est l'onglet du CHUES.
  static const Set<String> horsProjet = <String>{
    Routes.home,
    Routes.login,
    Routes.notifications,
    Routes.batteryHelp,
    Routes.about,
  };

  /// Le projet à qui appartient une adresse, ou `null` si elle est hors projet.
  /// Tout ce qui n'est ni l'accueil ni le grand public est du CHUES : ses
  /// écrans (représentants, prospects et appels) vivent à la racine
  /// pour des raisons historiques, sans préfixe qui les rattache.
  static CpiProject? duChemin(String path) {
    if (path.isEmpty || horsProjet.contains(path)) return null;
    if (path == Routes.accueil || path.startsWith('${Routes.accueil}/')) {
      return CpiProject.accueil;
    }
    if (path == Routes.grandPublic ||
        path.startsWith('${Routes.grandPublic}/')) {
      return CpiProject.grandPublic;
    }
    return CpiProject.chues;
  }

  ThemeData themeFor(Brightness brightness) {
    final bool isDark = brightness == Brightness.dark;
    if (this == CpiProject.chues) {
      return isDark ? AppTheme.chuesDark : AppTheme.chues;
    }
    return isDark ? AppTheme.dark : AppTheme.light;
  }

  bool isOpenTo(String? role) {
    final Role parsed = Role.values.firstWhere(
      (Role r) => r.value == role?.toUpperCase(),
      orElse: () => Role.unknownDefaultOpenApi,
    );
    return switch (this) {
      // La règle du registre est celle du module qui le tient : une tuile
      // ouverte sur un écran qui refuse ensuite l'accès serait pire que grisée.
      CpiProject.accueil => peutTenirLeRegistre(role),
      // Un rôle que cette version ne connaît pas garde la coque historique :
      // un rôle ajouté côté serveur ne doit pas verrouiller un téléphone déjà
      // déployé et hors réseau.
      CpiProject.chues =>
        parsed == Role.COMMERCIAL ||
            parsed == Role.BANQUE_FINANCE ||
            parsed == Role.unknownDefaultOpenApi ||
            _encadrement.contains(parsed),
      CpiProject.grandPublic =>
        parsed == Role.COMMERCIAL ||
            parsed == Role.BANQUE_FINANCE ||
            _encadrement.contains(parsed),
    };
  }
}

/// La palette suit la coque : chaque route d'un projet est peinte sous le thème
/// de ce projet, et le quitter rend celui du hub.
///
/// Le projet est aussi hérité : les écrans partagés par les trois coques
/// (« À corriger », « Réglages », la bande d'envoi) le demandent à
/// [ProjectScope.maybeOf] plutôt que de le deviner sur l'adresse courante, qui
/// est celle de la page poussée par-dessus et non celle de la coque.
class ProjectScope extends StatelessWidget {
  const ProjectScope({super.key, required this.project, required this.child});

  final CpiProject project;
  final Widget child;

  static CpiProject? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_ProjetHerite>()?.project;

  @override
  Widget build(BuildContext context) {
    // Respecte la luminosité déjà résolue par `MaterialApp` (thème choisi
    // Système/Clair/Sombre) : `ProjectScope` change la PALETTE, pas la
    // luminosité.
    final ThemeData theme = project.themeFor(Theme.of(context).brightness);
    return _ProjetHerite(
      project: project,
      child: Theme(
        data: theme,
        child: FTheme(
          data: cpiForuiTheme(
            theme,
            reduceMotion: MediaQuery.maybeDisableAnimationsOf(context) ?? false,
          ),
          child: child,
        ),
      ),
    );
  }
}

class _ProjetHerite extends InheritedWidget {
  const _ProjetHerite({required this.project, required super.child});

  final CpiProject project;

  @override
  bool updateShouldNotify(_ProjetHerite old) => old.project != project;
}
