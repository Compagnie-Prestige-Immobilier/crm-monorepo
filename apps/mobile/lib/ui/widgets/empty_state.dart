import 'package:flutter/material.dart';

import '../../core/theme/cpi_tokens.dart';

/// Le seul état vide de l'application : icône, titre, phrase d'issue.
///
/// Sept écrans l'écrivaient chacun à leur façon, du bloc complet à la phrase
/// nue : l'utilisateur ne savait pas si l'écran était vide ou cassé.
class CpiEmptyState extends StatelessWidget {
  const CpiEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.iconColor,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Color? iconColor;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Widget contenu = Padding(
      padding: const EdgeInsets.all(CpiSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(
            icon,
            size: CpiIconSize.display,
            color: iconColor ?? theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: CpiSpacing.md),
          Text(
            title,
            style: theme.textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: CpiSpacing.xs),
          Text(
            message,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...<Widget>[
            const SizedBox(height: CpiSpacing.lg),
            action!,
          ],
        ],
      ),
    );

    // Centré quand la place le permet, défilant sinon : à 1,76x sur 320 dp le
    // bloc dépasse la hauteur restante, et un état vide ne doit pas déborder.
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints box) {
        if (!box.hasBoundedHeight) return contenu;
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: box.maxHeight),
            child: Center(child: contenu),
          ),
        );
      },
    );
  }
}
