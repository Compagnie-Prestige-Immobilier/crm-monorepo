import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/feedback/feedback.dart';
import '../../core/theme/cpi_tokens.dart';
import 'cpi_forui.dart';

/// Une réponse possible d'un [CpiChoiceGroup].
@immutable
class CpiChoice<T> {
  const CpiChoice({
    required this.value,
    required this.label,
    this.subtitle,
    this.details,
  });

  final T value;
  final String label;
  final String? subtitle;

  /// Pastille ou icône à droite du libellé.
  final Widget? details;
}

/// Question à une seule réponse, en tuiles pleine largeur.
///
/// Remplace `FSelectTileGroup` : dans un groupe, `FTappable` laisse le
/// reconnaisseur du groupe prendre le geste et sa tuile n'expose alors AUCUNE
/// action `tap` aux lecteurs d'écran (forui 0.21.3,
/// `foundation/tappable/tappable.dart`). Chaque option porte donc ici son
/// propre nœud : nom qui rappelle la question, rôle de bouton, appartenance au
/// groupe exclusif, et l'action qui la choisit.
class CpiChoiceGroup<T> extends StatelessWidget {
  const CpiChoiceGroup({
    super.key,
    required this.label,
    required this.options,
    required this.value,
    required this.onChanged,
    this.icon,
    this.description,
    this.showLabel = true,
  });

  final String label;

  /// À faux quand l'en-tête d'étape pose déjà la question : le nom reste dans
  /// la sémantique de chaque option, l'écran ne l'affiche pas deux fois.
  final bool showLabel;
  final List<CpiChoice<T>> options;
  final T? value;

  /// Appelé avec l'option touchée, même si elle est déjà choisie : c'est
  /// l'appelant qui décide si un second appui la retire.
  final ValueChanged<T> onChanged;

  final IconData? icon;
  final String? description;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) => FTileGroup(
      label: !showLabel
          ? null
          : icon == null
          ? Text(label)
          : Row(
              spacing: CpiSpacing.xs,
              children: <Widget>[
                Icon(icon, size: CpiIconSize.sm),
                Text(label),
              ],
            ),
      description: description == null ? null : Text(description!),
      children: <FTileMixin>[
        for (final CpiChoice<T> option in options)
          _ChoiceTile<T>(
            group: label,
            option: option,
            selected: option.value == value,
            onTap: () => onChanged(option.value),
          ),
      ],
    ),
  );
}

class _ChoiceTile<T> extends StatelessWidget with FTileMixin {
  const _ChoiceTile({
    required this.group,
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final String group;
  final CpiChoice<T> option;
  final bool selected;
  final VoidCallback onTap;

  /// Choisir une réponse claque : c'est le geste le plus répété de la saisie,
  /// et le seul retour que l'agent a quand il ne regarde pas l'écran.
  void _choisir() {
    CpiFeedbackService.instance.choix();
    onTap();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    button: true,
    selected: selected,
    inMutuallyExclusiveGroup: true,
    label: <String?>[
      '$group : ${option.label}',
      option.subtitle,
    ].nonNulls.join('. '),
    excludeSemantics: true,
    onTap: _choisir,
    child: FTile(
      // Sans taille : la tuile impose la sienne, comme au `FSelectTile` que
      // cette ligne remplace.
      prefix: Icon(
        PhosphorIconsRegular.check,
        color: selected ? null : Colors.transparent,
      ),
      title: Text(option.label),
      subtitle: option.subtitle == null ? null : Text(option.subtitle!),
      details: option.details,
      selected: selected,
      onPress: _choisir,
    ),
  );
}
