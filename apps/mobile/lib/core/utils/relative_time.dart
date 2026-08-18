import 'package:intl/intl.dart';

String relativeTime(DateTime when, {DateTime? now}) {
  final Duration delta = (now ?? DateTime.now()).difference(when);
  if (delta.isNegative || delta.inMinutes < 1) return 'à l\'instant';
  if (delta.inHours < 1) return 'il y a ${delta.inMinutes} min';
  if (delta.inDays < 1) return 'il y a ${delta.inHours} h';
  return 'le ${DateFormat('d MMMM à HH:mm', 'fr').format(when)}';
}
