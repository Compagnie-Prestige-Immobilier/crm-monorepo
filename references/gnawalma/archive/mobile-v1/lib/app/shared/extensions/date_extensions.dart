extension DateTimeExtensions on DateTime {
  /// Checks if this date is in the past (before today)
  bool get isBeforeToday {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return isBefore(today);
  }

  /// Checks if this date is today
  bool get isToday {
    final now = DateTime.now();
    return year == now.year && month == now.month && day == now.day;
  }

  /// Checks if this date is tomorrow
  bool get isTomorrow {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    return year == tomorrow.year &&
        month == tomorrow.month &&
        day == tomorrow.day;
  }

  /// Returns the number of days between this date and now
  int get daysFromNow {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final thatDay = DateTime(year, month, day);
    return thatDay.difference(today).inDays;
  }

  /// Returns a human-readable "time ago" string
  String get timeAgo {
    final now = DateTime.now();
    final diff = now.difference(this);

    if (diff.inDays == 0) {
      return 'Aujourd\'hui';
    } else if (diff.inDays == 1) {
      return 'Hier';
    } else if (diff.inDays < 7) {
      return 'Il y a ${diff.inDays} jours';
    } else if (diff.inDays < 30) {
      return 'Il y a ${(diff.inDays / 7).floor()} semaines';
    } else {
      return 'Il y a ${(diff.inDays / 30).floor()} mois';
    }
  }
}
