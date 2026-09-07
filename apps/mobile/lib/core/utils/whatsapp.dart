import 'dart:developer' as developer;

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/widgets.dart';

import '../../ui/widgets/cpi_kit.dart';

/// Trois états et non un booléen : sans `nonDemande`, rien ne distingue « il n'a
/// pas WhatsApp » de « on ne lui a pas posé la question », et c'est cette
/// différence qui décide de qui on rappelle.
enum WhatsappStatus {
  nonDemande('NON_DEMANDE', 'Non demandé'),
  memeNumero('MEME_NUMERO', 'Même numéro'),
  autreNumero('AUTRE_NUMERO', 'Autre numéro'),
  aucun('AUCUN', 'Pas de WhatsApp');

  const WhatsappStatus(this.code, this.label);

  final String code;
  final String label;

  /// Nul si le serveur a ajouté un état que cette version ignore. L'appelant
  /// affiche alors le code brut plutôt que de faire disparaître l'information.
  static WhatsappStatus? parse(String code) {
    for (final WhatsappStatus s in WhatsappStatus.values) {
      if (s.code == code) return s;
    }
    return null;
  }
}

const int kProfessionMaxLength = 120;

/// Le lien `wa.me` d'un numéro E.164. WhatsApp veut les chiffres seuls : avec le
/// « + », il ouvre une conversation vide au lieu de celle du numéro. Un
/// message facultatif s'ajoute en paramètre `text`.
String waLink(String phoneE164, [String? message]) {
  final String base = 'https://wa.me/${phoneE164.replaceFirst('+', '')}';
  if (message == null || message.isEmpty) return base;
  return '$base?text=${Uri.encodeComponent(message)}';
}

/// Substitue les jetons du gabarit `messageWhatsapp` (EB-29). Les mêmes noms
/// que `texteDuMessage` côté web : `{prenom}`, `{lien}`, `{teleconseiller}`,
/// `{telephoneTeleconseiller}`.
String rendreMessageWhatsapp(String gabarit, Map<String, String> valeurs) {
  return gabarit.replaceAllMapped(
    RegExp(r'\{(\w+)\}'),
    (Match m) => valeurs[m.group(1)] ?? m.group(0)!,
  );
}

/// Ouvre la conversation WhatsApp du numéro. Un téléphone sans WhatsApp installé
/// n'a aucune activité pour ce lien : l'échec se dit, il n'arrête rien.
Future<void> ecrireSurWhatsapp(
  BuildContext context,
  String phoneE164, [
  String? message,
]) async {
  try {
    await AndroidIntent(
      action: 'action_view',
      data: waLink(phoneE164, message),
    ).launch();
  } on Object catch (e) {
    developer.log('WhatsApp injoignable : $e', name: 'cpi.whatsapp');
    if (!context.mounted) return;
    cpiToast(context, 'WhatsApp n\'est pas installé sur ce téléphone.');
  }
}
