import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/network/session_controller.dart';
import '../../client/discovery/controllers/marketplace_providers.dart';
import '../../operations/controllers/operations_providers.dart';
import '../data/auth_repository.dart';
import '../domain/auth_session.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.read(apiClientProvider));
});

final authActionControllerProvider =
    AsyncNotifierProvider<AuthActionController, void>(AuthActionController.new);

class AuthActionController extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<AuthSession?> signIn({
    required String identifier,
    required String pin,
  }) async {
    state = const AsyncLoading();
    try {
      final repository = ref.read(authRepositoryProvider);
      final tokenSession = await repository.login(
        identifier: identifier,
        pin: pin,
      );
      await ref
          .read(sessionControllerProvider.notifier)
          .setSession(tokenSession);

      final completeSession = await repository.enrichSession(tokenSession);
      await ref
          .read(sessionControllerProvider.notifier)
          .setSession(completeSession);
      _dropRemoteCaches();
      state = const AsyncData(null);
      return completeSession;
    } catch (error, stackTrace) {
      await ref.read(sessionControllerProvider.notifier).clearSession();
      state = AsyncError(error, stackTrace);
      return null;
    }
  }

  Future<AuthSession?> register({
    required String displayName,
    required String identifier,
    required String pin,
    required String role,
  }) async {
    state = const AsyncLoading();
    try {
      final repository = ref.read(authRepositoryProvider);
      await repository.register(
        displayName: displayName,
        identifier: identifier,
        pin: pin,
        role: role,
      );
      final tokenSession = await repository.login(
        identifier: identifier,
        pin: pin,
      );
      await ref
          .read(sessionControllerProvider.notifier)
          .setSession(tokenSession);
      final completeSession = await repository.enrichSession(tokenSession);
      await ref
          .read(sessionControllerProvider.notifier)
          .setSession(completeSession);
      _dropRemoteCaches();
      state = const AsyncData(null);
      return completeSession;
    } catch (error, stackTrace) {
      await ref.read(sessionControllerProvider.notifier).clearSession();
      state = AsyncError(error, stackTrace);
      return null;
    }
  }

  Future<void> logout() async {
    state = const AsyncLoading();
    try {
      await ref.read(authRepositoryProvider).logout();
    } catch (_) {
      // A local logout must still work if the session is already expired or the
      // network is unavailable. Server-side revocation will happen on expiry.
    } finally {
      await ref.read(sessionControllerProvider.notifier).clearSession();
      _dropRemoteCaches();
      state = const AsyncData(null);
    }
  }

  /// Vide les lectures distantes mises en cache par le compte precedent.
  ///
  /// `FutureProvider` retient aussi bien un resultat qu'une erreur : un atelier
  /// charge sous un compte survivait a la deconnexion, et une panne serveur
  /// laissait l'ecran de profil vide jusqu'au prochain demarrage a froid, sans
  /// jamais reessayer — observe sur appareil apres une interruption d'API.
  void _dropRemoteCaches() {
    ref.invalidate(remoteAteliersProvider);
    ref.invalidate(primaryRemoteAtelierProvider);
    ref.invalidate(sharedOrdersProvider);
    ref.invalidate(marketplaceContactsProvider);
    ref.invalidate(marketplacePromotionsProvider);
  }
}
