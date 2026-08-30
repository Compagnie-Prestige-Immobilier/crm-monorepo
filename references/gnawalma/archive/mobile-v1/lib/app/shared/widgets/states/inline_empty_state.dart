import 'package:flutter/material.dart';
import '../../theme/app_colors_extensions.dart';
import '../../theme/app_text_styles.dart';

class InlineEmptyState extends StatelessWidget {
  final String message;
  final VoidCallback? onAction;
  final String actionLabel;
  final IconData? icon;
  final String? description;

  const InlineEmptyState({
    super.key,
    required this.message,
    this.onAction,
    this.actionLabel = 'Ajouter',
    this.icon,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: description ?? message,
      button: onAction != null,
      child: Center(
        child: Column(
          children: [
            if (icon != null)
              Semantics(
                excludeSemantics: true,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Icon(
                    icon,
                    size: 18,
                    color: context.textSecondaryColor.withValues(alpha: 0.5),
                  ),
                ),
              ),
            ExcludeSemantics(
              child: Text(
                message,
                style: AppTextStyles.caption.copyWith(
                  color: context.textSecondaryColor.withValues(alpha: 0.5),
                ),
                textAlign: TextAlign.center,
              ),
            ),
            if (description != null && description!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: ExcludeSemantics(
                  child: Text(
                    description!,
                    style: AppTextStyles.caption.copyWith(
                      color: context.textSecondaryColor.withValues(alpha: 0.4),
                      fontSize: 12,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            if (onAction != null)
              Semantics(
                button: true,
                label: actionLabel,
                child: ExcludeSemantics(
                  child: TextButton(
                    onPressed: onAction,
                    child: Text(actionLabel),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
