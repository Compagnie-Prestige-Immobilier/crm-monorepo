import 'dart:developer' as developer;
import 'dart:io' show Platform;

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../ui/widgets/cpi_kit.dart';

/// Ouvre le clavier du téléphone, numéro déjà composé.
///
/// `ACTION_DIAL` et non `ACTION_CALL` : l'appui sur vert reste au
/// téléconseiller, et l'application n'a donc besoin d'aucune permission
/// d'appel. Sans clavier joignable, le numéro part au presse-papier plutôt que
/// de laisser un bouton sans effet.
Future<void> appelerNumero(BuildContext context, String phoneE164) async {
  final bool compose = await lancerAppel(
    AndroidIntent(action: 'android.intent.action.DIAL', data: 'tel:$phoneE164'),
  );
  if (compose) return;
  await Clipboard.setData(ClipboardData(text: phoneE164));
  if (!context.mounted) return;
  cpiToast(context, 'Numéro copié. Composez-le depuis le téléphone.');
}

/// Hors Android, `AndroidIntent.launch` rend la main sans rien écrire sur son
/// canal : le lancement réel est invisible sur banc de test, d'où la couture.
@visibleForTesting
Future<bool> Function(AndroidIntent intent) lancerAppel = lancerAppelParIntent;

Future<bool> lancerAppelParIntent(AndroidIntent intent) async {
  if (!Platform.isAndroid) return false;
  try {
    await intent.launch();
    return true;
  } on Object catch (e) {
    developer.log('Clavier téléphonique inaccessible : $e', name: 'cpi.tel');
    return false;
  }
}
