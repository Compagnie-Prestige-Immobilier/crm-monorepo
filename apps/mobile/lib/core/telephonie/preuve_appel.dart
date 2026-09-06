import '../utils/phone.dart';
import 'telephonie_port.dart';

/// Le journal d'appels d'Android n'inscrit l'appel qu'au raccrochage, et son
/// horodatage est celui du téléphone : une minute d'avance couvre l'écart sans
/// ouvrir la porte à l'appel précédent.
const Duration kMargeJournal = Duration(minutes: 1);

/// Comparaison de repli : les neuf chiffres du plan sénégalais. Le journal rend
/// le numéro tel qu'il a été composé, pas tel que la fiche le porte.
const int kChiffresComparaison = 9;

/// Au-delà, un appel lancé n'est plus rapproché ni attaché à une tentative : le
/// journal du téléphone a pu tourner, et rattacher une preuve vieille de trois
/// heures à la tentative qu'on saisit maintenant serait une invention.
const Duration kFenetrePreuve = Duration(hours: 3);

/// L'entrée du journal qui correspond à l'appel lancé, s'il y en a une.
///
/// Un appel vers un AUTRE numéro n'est jamais retourné : la preuve d'appel se
/// rapproche sur un numéro déjà connu du CRM, et rien d'autre n'est conservé.
EntreeJournal? rapprocher(
  List<EntreeJournal> entrees, {
  required String e164,
  required DateTime lanceA,
}) {
  final DateTime plancher = lanceA.subtract(kMargeJournal);
  EntreeJournal? retenue;
  for (final EntreeJournal entree in entrees) {
    if (!_memeNumero(entree.numero, e164)) continue;
    if (entree.at.isBefore(plancher)) continue;
    if (retenue == null || entree.at.isAfter(retenue.at)) retenue = entree;
  }
  return retenue;
}

bool _memeNumero(String numero, String e164) {
  if (numero.isEmpty) return false;
  final String? normalise = Phone.toE164(numero);
  if (normalise != null && normalise == e164) return true;
  final String gauche = Phone.digitsOf(numero);
  final String droite = Phone.digitsOf(e164);
  if (gauche.length < kChiffresComparaison ||
      droite.length < kChiffresComparaison) {
    return false;
  }
  return gauche.substring(gauche.length - kChiffresComparaison) ==
      droite.substring(droite.length - kChiffresComparaison);
}

/// « Sortant · 1 min 32 · 14:02 », ou l'aveu que le téléphone n'a rien confirmé.
String libellePreuve({String? type, int? dureeSecondes, DateTime? at}) {
  if (type == null || at == null) return 'Non confirmé par le téléphone';
  final DateTime local = at.toLocal();
  final String heure =
      '${local.hour.toString().padLeft(2, '0')}:'
      '${local.minute.toString().padLeft(2, '0')}';
  return '${libelleTypeJournal(type)} · ${dureeAppel(dureeSecondes ?? 0)} · $heure';
}

String libelleTypeJournal(String type) => switch (type) {
  'sortant' => 'Sortant',
  'entrant' => 'Entrant',
  'manque' => 'Manqué',
  'rejete' => 'Rejeté',
  'bloque' => 'Bloqué',
  'messagerie' => 'Messagerie',
  'externe' => 'Autre appareil',
  _ => 'Inconnu',
};

String dureeAppel(int secondes) {
  if (secondes < 60) return '$secondes s';
  final int minutes = secondes ~/ 60;
  final int reste = secondes % 60;
  return reste == 0 ? '$minutes min' : '$minutes min $reste';
}
