import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_tokens.dart';

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
    final ThemeData theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(PhosphorIconsRegular.squaresFour),
          tooltip: 'Projets',
          onPressed: () => context.go(Routes.home),
        ),
        title: Text(title),
      ),
      body: Padding(
        padding: const EdgeInsets.all(CpiSpacing.xl),
        child: Center(
          child: Text(
            'Ce compte ne tient pas le registre des visites. '
            'Demandez l\'accès à la direction.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyLarge,
          ),
        ),
      ),
    );
  }
}
