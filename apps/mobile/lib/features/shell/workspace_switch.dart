import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../ui/widgets/cpi_kit.dart';
import '../auth/auth_state.dart';
import 'projects.dart';

extension CpiProjectShortLabel on CpiProject {
  String get shortLabel => switch (this) {
    CpiProject.accueil => 'Accueil',
    CpiProject.chues => 'CHUES',
    CpiProject.grandPublic => 'Grand Public',
  };
}

/// Pastille d'en-tête qui NOMME le projet courant et ouvre la liste des autres.
///
/// Remplace l'icône « grille » : un pictogramme seul ne disait à personne qu'il
/// changeait de projet. Une seule tuile ouverte pour ce rôle → la pastille ne
/// propose que le retour à la page des projets.
class CpiWorkspaceSwitch extends ConsumerWidget {
  const CpiWorkspaceSwitch({super.key, required this.current});

  final CpiProject current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState auth = ref.watch(authControllerProvider);
    final String? role = auth.role;
    final List<CpiProject> others = CpiProject.values
        .where((CpiProject p) => p != current && p.isOpenTo(role))
        .toList();
    // Un seul projet ouvert : rien à changer, la pastille n'est qu'un nom.
    if (others.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: CpiSpacing.xs),
        child: CpiTag(current.shortLabel),
      );
    }
    // `container` obligatoire : sans lui le nœud fusionne dans l'en-tête et
    // c'est tout le bandeau qui s'appellerait « Projet CHUES ».
    return Semantics(
      container: true,
      button: true,
      label: 'Projet ${current.shortLabel}. Changer de projet',
      onTap: () => _ouvrir(context, others),
      // Un seul nœud : `FHeader.nested` neutralise les rappels du `FButton`
      // (groupe tactile), c'est cette coquille qui porte l'activation.
      excludeSemantics: true,
      child: Builder(
        builder: (BuildContext context) => ConstrainedBox(
          // `FHeader.nested` pose ses préfixes sous les contraintes ENTIÈRES de
          // l'en-tête, puis borne le titre à ce qui reste : une pastille aussi
          // large que l'écran lève `Invalid argument` à la mise en page et laisse
          // l'écran blanc. Les 120 dp réservés tiennent deux actions de droite,
          // sur 320 dp comme au plus grand texte.
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width - 120,
          ),
          child: FButton(
            variant: FButtonVariant.outline,
            mainAxisSize: MainAxisSize.min,
            // Pas d'icône de projet : « Grand Public » n'a la place que pour
            // son nom et le chevron à côté d'une action de droite sur 320 dp.
            suffix: const Icon(
              PhosphorIconsRegular.caretDown,
              size: CpiIconSize.sm,
            ),
            onPress: () => _ouvrir(context, others),
            // La rangée de `FButton` ne fléchit pas son libellé : sans
            // `Flexible`, « Grand Public » déborde au lieu de s'élider.
            child: Flexible(
              child: Text(current.shortLabel, overflow: TextOverflow.ellipsis),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _ouvrir(BuildContext context, List<CpiProject> others) =>
      showCpiSheet<void>(
        context,
        title: 'Changer de projet',
        builder: (BuildContext sheet) => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            CpiCard.rows(<CpiRow>[
              for (final CpiProject p in others)
                CpiRow(
                  title: p.label,
                  subtitle: p.tagline,
                  leading: Icon(p.icon, size: CpiIconSize.lg),
                  onTap: () {
                    Navigator.of(sheet).pop();
                    context.go(p.path);
                  },
                ),
              CpiRow(
                title: 'Tous les projets',
                leading: const Icon(
                  PhosphorIconsRegular.squaresFour,
                  size: CpiIconSize.lg,
                ),
                onTap: () {
                  Navigator.of(sheet).pop();
                  context.go(Routes.home);
                },
              ),
            ]),
          ],
        ),
      );
}
