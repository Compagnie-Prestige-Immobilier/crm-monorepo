import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/services/auth_session_store.dart';
import 'api_client.dart';
import 'session_controller.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    sessionStore: ref.read(authSessionStoreProvider),
    onSessionExpired: () =>
        ref.read(sessionControllerProvider.notifier).clearSession(),
  );
});

final networkAvailabilityProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();
  final initial = await connectivity.checkConnectivity();
  yield !initial.contains(ConnectivityResult.none);

  await for (final results in connectivity.onConnectivityChanged) {
    yield !results.contains(ConnectivityResult.none);
  }
});
