abstract interface class RefreshMutex {
  Future<T> protect<T>(Future<T> Function() body);
}

/// Le verrou n'a pas été obtenu. Exécuter quand même le corps protégé ferait
/// partir un second renouvellement en parallèle : le serveur y lit un rejeu et
/// révoque toute la famille de jetons.
class RefreshLockBusy implements Exception {
  const RefreshLockBusy();

  @override
  String toString() => 'RefreshLockBusy(un autre isolat renouvelle déjà)';
}

class NoRefreshMutex implements RefreshMutex {
  const NoRefreshMutex();

  @override
  Future<T> protect<T>(Future<T> Function() body) => body();
}
