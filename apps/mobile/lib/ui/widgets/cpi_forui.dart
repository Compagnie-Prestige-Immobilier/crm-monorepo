import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

import '../../core/theme/forui_theme.dart';

/// Installe le thème ForUI dérivé du thème Material courant.
///
/// Sans `FTheme` au-dessus de lui, ForUI retombe sur sa palette `neutral` : un
/// composant posé hors d'un `CpiScaffold` — écran encore Material, test unitaire
/// monté dans un `Scaffold` nu — sortirait gris ardoise, en clair comme en
/// sombre. Chaque primitive de `lib/ui/widgets` installe donc son thème.
///
/// `lib/app.dart` et `ProjectScope` posent désormais un `FTheme` racine : ce
/// filet ne sert plus qu'aux widgets montés sans la racine de l'application.
class CpiForui extends StatelessWidget {
  const CpiForui({super.key, required this.builder});

  final WidgetBuilder builder;

  @override
  Widget build(BuildContext context) => FBasicTheme(
    data: cpiForuiTheme(
      Theme.of(context),
      reduceMotion: MediaQuery.maybeDisableAnimationsOf(context) ?? false,
    ),
    child: Builder(builder: builder),
  );
}
