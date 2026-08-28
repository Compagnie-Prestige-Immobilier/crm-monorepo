import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/router/route_paths.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/empty_state.dart';

/// Le refus d'accès du registre, partagé par `/accueil` et `/accueil/chiffres`.
///
/// `RouteMemory` peut restaurer `/accueil/chiffres` seul, sans passer par
/// `/accueil` : sans cette même garde sur les deux écrans, un compte sans
/// accès au registre verrait des compteurs de visiteurs.
class AccesRefuse extends StatelessWidget {
  const AccesRefuse({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    void versLesProjets() => context.go(Routes.home);

    return CpiScaffold(
      title: title,
      leading: CpiHeaderAction(
        icon: PhosphorIconsRegular.squaresFour,
        label: 'Projets',
        onPressed: versLesProjets,
      ),
      body: CpiEmptyState(
        icon: PhosphorIconsDuotone.lockSimple,
        title: 'Registre réservé',
        message:
            'Ce compte ne tient pas le registre des visites. '
            'Demandez l\'accès à la direction.',
        action: CpiButton(
          'Revenir aux projets',
          variant: CpiButtonVariant.secondary,
          expand: false,
          onPressed: versLesProjets,
        ),
      ),
    );
  }
}
