import 'dart:developer' as developer;

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/notifications/rep_callback_notifications.dart';
import '../../ui/widgets/cpi_kit.dart';

/// Demande ce qu'il faut pour qu'un rappel promis sonne, et explique en une
/// phrase si le téléphone dit non. Ne bloque jamais la saisie en cours.
Future<void> demanderLAlarme(BuildContext context, WidgetRef ref) async {
  final RepCallbackPermissions accord = await ref
      .read(repCallbackNotificationsProvider)
      .ensurePermissions();
  if (accord.notifications || !context.mounted) return;

  final bool? reglages = await cpiConfirm(
    context,
    title: 'Le rappel ne sonnera pas',
    message:
        'Sans les notifications, CPI GO ne peut pas vous prévenir à l\'heure '
        'convenue.',
    confirmLabel: 'Ouvrir les réglages',
    cancelLabel: 'Plus tard',
  );
  if (reglages == true && context.mounted) {
    await ouvrirLaFicheApplication(context);
  }
}

/// La fiche de l'application dans les réglages Android : notifications,
/// batterie et alarmes s'y règlent. Il n'existe pas d'API Flutter pour ça.
Future<void> ouvrirLaFicheApplication(BuildContext context) async {
  try {
    await const AndroidIntent(
      action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
      data: 'package:sn.cpi.go',
    ).launch();
  } on Object catch (e) {
    developer.log('Fiche application inaccessible : $e', name: 'cpi.perm');
    if (!context.mounted) return;
    cpiToast(context, 'Ouvrez : Réglages → Applications → CPI GO.');
  }
}
