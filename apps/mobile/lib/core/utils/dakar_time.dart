/// Dakar est à UTC toute l'année : l'horloge du serveur et la sienne coïncident.
String jourDakar(DateTime at) {
  final DateTime utc = at.toUtc();
  return '${utc.year.toString().padLeft(4, '0')}-'
      '${utc.month.toString().padLeft(2, '0')}-'
      '${utc.day.toString().padLeft(2, '0')}';
}

String heureDakar(DateTime at) {
  final DateTime utc = at.toUtc();
  return '${utc.hour.toString().padLeft(2, '0')}:'
      '${utc.minute.toString().padLeft(2, '0')}';
}
