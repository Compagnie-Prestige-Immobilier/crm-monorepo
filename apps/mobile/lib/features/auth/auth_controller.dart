import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/sync/api_port.dart';
import '../../core/sync/token_store.dart';
import '../../data/secure/secure_token_store.dart';
import '../notifications/notification_inbox.dart';
import '../notifications/notifications_controller.dart';
import 'auth_state.dart';

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    unawaited(Future<void>.microtask(restore));
    return const AuthState.unknown();
  }

  TokenStore get _tokens => ref.read(tokenStoreProvider);
  ApiPort get _api => ref.read(apiPortProvider);

  Future<void> restore() async {
    try {
      final String? refresh = await _tokens.readRefreshToken();
      if (refresh == null) {
        state = const AuthState.signedOut();
        return;
      }
      final TokenStore store = _tokens;
      String? id;
      String? name;
      String? role;
      String? email;
      String? departementId;
      if (store is SecureTokenStore) {
        final ({
          String fullName,
          String id,
          String? role,
          String? email,
          String? departementId,
        })?
        identity = await store.readIdentity();
        id = identity?.id;
        name = identity?.fullName;
        role = identity?.role;
        email = identity?.email;
        departementId = identity?.departementId;
      }
      state = AuthState(
        status: AuthStatus.authenticated,
        userId: id,
        fullName: name,
        role: role,
        email: email,
        departementId: departementId,
      );
    } on Object {
      // Coffre chiffré illisible : sans ce repli l'état reste `unknown` et
      // `app.dart` peint son écran d'amorçage indéfiniment.
      state = const AuthState.signedOut(
        errorMessage:
            'Session illisible sur cet appareil. Reconnectez-vous pour continuer.',
      );
    }
  }

  Future<bool> signIn({
    required String identifier,
    required String password,
    bool staySignedIn = true,
  }) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final TokenStore store = _tokens;
      if (store is SecureTokenStore) {
        store.persistRefreshToken = staySignedIn;
      }
      final AuthTokens tokens = await _api.login(
        identifier: identifier,
        password: password,
      );
      await store.save(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      );
      if (store is SecureTokenStore) {
        await store.saveIdentity(
          userId: tokens.userId,
          fullName: tokens.fullName,
          role: tokens.role,
          email: tokens.email,
          departementId: tokens.departementId,
        );
      }
      state = AuthState(
        status: AuthStatus.authenticated,
        userId: tokens.userId,
        fullName: tokens.fullName,
        role: tokens.role,
        email: tokens.email,
        departementId: tokens.departementId,
      );
      unawaited(ref.read(notificationInboxProvider).refresh(force: true));
      return true;
    } on ApiException catch (e) {
      state = AuthState.signedOut(errorMessage: _messageFor(e));
      return false;
    } on Object {
      // Une panne du coffre chiffré laissait `isSubmitting` à vrai pour
      // toujours : bouton grisé, roue qui tourne, application à tuer.
      state = const AuthState.signedOut(
        errorMessage:
            'Ce téléphone n\'a pas pu enregistrer la session. Réessayez, '
            'puis redémarrez-le si le message revient.',
      );
      return false;
    }
  }

  void onSessionExpired() {
    if (state.status == AuthStatus.unauthenticated) return;
    state = const AuthState.signedOut(
      errorMessage: 'Votre session a expiré. Reconnectez-vous.',
    );
  }

  Future<void> signOut() async {
    await ref.read(pushInboxStoreProvider).purge();
    await ref.read(phase2DirectoryProvider).purge();
    final String? refresh = await _tokens.readRefreshToken();
    if (refresh != null) {
      try {
        await _api.logout(refreshToken: refresh);
      } on ApiException {
        // Une déconnexion serveur ratée ne retient pas l'utilisateur : on efface
        // localement quoi qu'il arrive.
      }
    }
    await _tokens.clear();
    state = const AuthState.signedOut();
  }

  static String _messageFor(ApiException e) => switch (e.code) {
    'invalid_credentials' => 'Identifiant ou mot de passe incorrect.',
    'account_disabled' => 'Ce compte est désactivé. Contactez votre responsable.',
    'network' || 'timeout' => 'Réseau indisponible. Réessayez une fois connecté.',
    _ => e.message ?? 'Connexion impossible pour le moment.',
  };
}
