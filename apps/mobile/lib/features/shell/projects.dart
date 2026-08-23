import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/router/route_paths.dart';
import '../../core/theme/app_theme.dart';
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
    tagline: 'Enrôlement des enseignants syndiqués',
    path: Routes.chues,
    icon: PhosphorIconsRegular.chalkboardTeacher,
  ),
  grandPublic(
    label: 'Projet Grand Public',
    tagline: 'Enrôlement hors syndicat',
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
  final String path;
  final IconData icon;

  ThemeData get theme =>
      this == CpiProject.chues ? AppTheme.chues : AppTheme.light;

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
class ProjectScope extends StatelessWidget {
  const ProjectScope({super.key, required this.project, required this.child});

  final CpiProject project;
  final Widget child;

  @override
  Widget build(BuildContext context) =>
      Theme(data: project.theme, child: child);
}
