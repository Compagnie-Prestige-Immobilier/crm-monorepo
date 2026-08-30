import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/services/auth_session_store.dart';
import '../../modules/auth/domain/auth_session.dart';

final sessionControllerProvider =
    AsyncNotifierProvider<SessionController, AuthSession?>(
      SessionController.new,
    );

class SessionController extends AsyncNotifier<AuthSession?> {
  @override
  Future<AuthSession?> build() {
    return ref.read(authSessionStoreProvider).read();
  }

  Future<void> setSession(AuthSession session) async {
    await ref.read(authSessionStoreProvider).write(session);
    state = AsyncData(session);
  }

  Future<void> clearSession() async {
    await ref.read(authSessionStoreProvider).clear();
    state = const AsyncData(null);
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(ref.read(authSessionStoreProvider).read);
  }
}
