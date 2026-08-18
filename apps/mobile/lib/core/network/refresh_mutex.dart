abstract interface class RefreshMutex {
  Future<T> protect<T>(Future<T> Function() body);
}

class NoRefreshMutex implements RefreshMutex {
  const NoRefreshMutex();

  @override
  Future<T> protect<T>(Future<T> Function() body) => body();
}
