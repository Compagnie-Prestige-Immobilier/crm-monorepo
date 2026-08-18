class SessionExpired implements Exception {
  const SessionExpired([this.cause]);

  final Object? cause;

  @override
  String toString() => 'SessionExpired(${cause ?? 'refresh refusé'})';
}
