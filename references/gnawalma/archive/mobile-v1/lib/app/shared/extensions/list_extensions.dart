extension ListGroupingExtension<T> on Iterable<T> {
  /// Groups the elements of the list by a key.
  Map<K, List<T>> groupBy<K>(K Function(T) keySelector) {
    final Map<K, List<T>> groups = {};
    for (final element in this) {
      final key = keySelector(element);
      if (!groups.containsKey(key)) {
        groups[key] = [];
      }
      groups[key]!.add(element);
    }
    return groups;
  }
}
