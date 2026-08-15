import 'package:intl/intl.dart';

/// « il y a N min », en français, à partir d'un instant passé.
///
/// ## Pourquoi une seule copie
///
/// Cette fonction existait deux fois, mot pour mot, dans `reglages_screen.dart`
/// et `phase2_screen.dart`. Deux copies d'une règle d'affichage, c'est deux
/// endroits où corriger le même défaut : et le défaut était réel dans les deux.
///
/// ## Pourquoi le pincement à zéro
///
/// `DateTime.now().difference(when)` est NÉGATIF quand `when` est dans le futur,
/// et l'écran rendait alors « il y a -180 min ». Ce n'est pas un cas théorique :
///
///  * les horodatages de synchronisation viennent du SERVEUR, dont l'horloge
///    n'est pas celle du téléphone : quelques secondes d'avance suffisent ;
///  * les appareils d'entrée de gamme du parc sénégalais dérivent, et
///    l'utilisateur remet son horloge à l'heure : tout ce qui a été estampillé
///    pendant la dérive se retrouve dans le futur.
///
/// Un futur est donc traité comme « à l'instant » : c'est ce qui est vrai à la
/// précision près, et c'est la seule formulation qui ne fasse pas douter
/// l'utilisateur de ce que l'application vient de lui dire.
String relativeTime(DateTime when, {DateTime? now}) {
  final Duration delta = (now ?? DateTime.now()).difference(when);
  if (delta.isNegative || delta.inMinutes < 1) return 'à l\'instant';
  if (delta.inHours < 1) return 'il y a ${delta.inMinutes} min';
  if (delta.inDays < 1) return 'il y a ${delta.inHours} h';
  return 'le ${DateFormat('d MMMM à HH:mm', 'fr').format(when)}';
}
