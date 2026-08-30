/// The two product spaces.
///
/// One brand, two spaces that must never look mixed. Everything they share is
/// shared; the accent is what differs, and that resolution lives in
/// `shared/theme/app_colors.dart` as an extension on this type.
///
/// This was a holder of two `String` constants, which meant `activeSpace` was
/// an unvalidated string everywhere it travelled: any typo compiled, and a
/// stored value from an older build could match neither branch and silently
/// route nowhere. [fromStorageKey] is now the single place a persisted value
/// becomes a space.
enum AppSpace {
  /// Atelier workspace: manage workshops, clients, orders, stock.
  atelier('atelier'),

  /// Client workspace: discover workshops, browse, contact.
  client('client');

  const AppSpace(this.storageKey);

  /// Key persisted by `StorageService`. Must stay stable across releases —
  /// changing one orphans every installed device's stored preference.
  final String storageKey;

  /// Resolves a persisted value, tolerating null and unknown input.
  ///
  /// Returns null rather than guessing: the caller decides whether an
  /// unrecognised value means "first launch" or "show the space selector".
  static AppSpace? fromStorageKey(String? value) => switch (value) {
    'atelier' => AppSpace.atelier,
    'client' => AppSpace.client,
    _ => null,
  };
}
