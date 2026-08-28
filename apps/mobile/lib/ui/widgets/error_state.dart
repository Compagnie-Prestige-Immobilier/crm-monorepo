import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/sync/api_port.dart';
import '../../core/theme/cpi_tokens.dart';
import 'cpi_forui.dart';
import 'cpi_kit.dart';

String messageErreur(Object error) {
  if (error is ApiException) {
    final String? message = error.message;
    if (message != null && message.trim().isNotEmpty) return message;
    return 'Erreur ${error.code}.';
  }
  return '$error';
}

class CpiFailureBanner extends StatelessWidget {
  const CpiFailureBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) => FAlert(
      variant: FAlertVariant.destructive,
      icon: const Icon(PhosphorIconsRegular.warningCircle),
      title: Text(message),
    ),
  );
}

/// Un écran en défaut n'est jamais une impasse : il dit ce qui a échoué et
/// offre le geste qui le rattrape. Trois écrans affichaient l'exception Dart
/// centrée, sans aucun bouton.
class CpiErrorState extends StatelessWidget {
  const CpiErrorState({
    super.key,
    required this.message,
    required this.onRetry,
    this.retryLabel = 'Réessayer',
  });

  final String message;
  final VoidCallback onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) => Padding(
      padding: const EdgeInsets.all(CpiSpacing.md),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          CpiFailureBanner(message: message),
          const SizedBox(height: CpiSpacing.sm),
          // `CpiButton` et non `FButton` : le plancher de 56 dp, l'élision du
          // libellé et la coquille sémantique sont déjà à l'intérieur.
          CpiButton(
            retryLabel,
            variant: CpiButtonVariant.secondary,
            icon: PhosphorIconsRegular.arrowClockwise,
            onPressed: onRetry,
          ),
        ],
      ),
    ),
  );
}
