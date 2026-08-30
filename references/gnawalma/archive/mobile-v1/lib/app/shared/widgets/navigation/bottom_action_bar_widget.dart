import 'package:flutter/material.dart';

import '../../../shared/widgets/layouts/polished_page.dart';

/// Reusable sticky action footer for multi-step flows.
class BottomActionBar extends StatelessWidget {
  const BottomActionBar({
    super.key,
    this.onBack,
    this.onNext,
    this.nextLabel = 'Continuer',
    this.backLabel = 'Retour',
    this.isLoading = false,
    this.showBackButton = true,
    this.isNextEnabled = true,
    this.nextIcon = Icons.arrow_forward_rounded,
  });

  final VoidCallback? onBack;
  final VoidCallback? onNext;
  final String nextLabel;
  final String? backLabel;
  final bool isLoading;
  final bool showBackButton;
  final bool isNextEnabled;
  final IconData nextIcon;

  @override
  Widget build(BuildContext context) {
    return AppStickyActionBar(
      secondary: showBackButton && onBack != null
          ? OutlinedButton(
              onPressed: isLoading ? null : onBack,
              child: Text(backLabel ?? 'Retour'),
            )
          : null,
      primary: FilledButton.icon(
        onPressed: isLoading || !isNextEnabled ? null : onNext,
        icon: isLoading
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator.adaptive(
                  valueColor: AlwaysStoppedAnimation(
                    Theme.of(context).colorScheme.onPrimary,
                  ),
                ),
              )
            : Icon(nextIcon),
        label: Text(isLoading ? 'Traitement…' : nextLabel),
      ),
    );
  }
}
