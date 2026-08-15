import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/sync/api_port.dart';
import '../../core/sync/token_store.dart';
import '../../data/secure/secure_token_store.dart';
import '../notifications/notification_inbox.dart';
import '../notifications/notifications_controller.dart';
import 'auth_state.dart';

/// Contrôleur de session.
///
/// Écrit à la main plutôt que généré par `riverpod_generator` : sur Flutter
/// 3.41.7 (Dart 3.11.5), `riverpod_generator` et `drift_dev` n'ont aucun palier
/// d'`analyzer` commun : voir le commentaire en tête de `pubspec.yaml`. Un
/// `Notifier` manuel a exactement la même sémantique, sans le générateur.
class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    // La restauration est asynchrone ; l'état part de `unknown` pour que le
    // garde de route sache qu'il ne sait pas encore.
    Future<void>.microtask(restore);
    return const AuthState.unknown();
  }

  TokenStore get _tokens => ref.read(tokenStoreProvider);
  ApiPort get _api => ref.read(apiPortProvider);

  /// Démarrage à froid : y a-t-il une session sur le disque ?
  Future<void> restore() async {
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
    if (store is SecureTokenStore) {
      final ({String fullName, String id, String? role, String? email})? identity =
          await store.readIdentity();
      id = identity?.id;
      name = identity?.fullName;
      role = identity?.role;
      email = identity?.email;
    }
    // On ne rafraîchit PAS le jeton d'accès ici. L'app est hors ligne la moitié
    // du temps ; exiger un aller-retour réseau au démarrage rendrait la session
    // dépendante du réseau, ce qui est exactement ce qu'on cherche à éviter.
    // Le rafraîchissement se fait à la première requête qui en a besoin.
    state = AuthState(
      status: AuthStatus.authenticated,
      userId: id,
      fullName: name,
      role: role,
      email: email,
    );
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
        // L'identité est enregistrée MÊME quand « rester connecté » est décoché.
        // Ce n'est pas un secret, et le moteur en a besoin dans l'isolat de fond
        // pour trancher les 409 de téléphone : sans identifiant de commercial, il
        // ne peut pas savoir si une fiche en doublon est la sienne, et doit
        // remonter à l'utilisateur un conflit qu'il aurait pu résoudre seul.
        await store.saveIdentity(
          userId: tokens.userId,
          fullName: tokens.fullName,
          role: tokens.role,
          email: tokens.email,
        );
      }
      state = AuthState(
        status: AuthStatus.authenticated,
        userId: tokens.userId,
        fullName: tokens.fullName,
        role: tokens.role,
        email: tokens.email,
      );
      // La boîte de réception se rapatrie APRÈS que l'état est passé à
      // `authenticated` : la requête a besoin du jeton d'accès. Elle ne bloque
      // pas la connexion et n'échoue jamais bruyamment : l'utilisateur veut
      // travailler, pas déboguer une notification.
      //
      // Aucun jeton d'appareil n'est enregistré : sans Firebase il n'y en a
      // plus, et `/devices/register` n'aurait rien à transmettre.
      unawaited(ref.read(notificationInboxProvider).refresh(force: true));
      return true;
    } on ApiException catch (e) {
      state = AuthState.signedOut(errorMessage: _messageFor(e));
      return false;
    }
  }

  /// Le renouvellement de jeton a définitivement échoué.
  ///
  /// Appelée depuis l'intercepteur et depuis le coordinateur de synchronisation.
  /// Les jetons sont déjà effacés à ce stade ; il ne reste qu'à basculer l'état
  /// pour que le garde de route renvoie sur l'écran de connexion **avec un
  /// message**. Sans ce message, l'utilisateur se retrouve devant un formulaire
  /// de connexion sans comprendre ce qui vient de se passer.
  void onSessionExpired() {
    if (state.status == AuthStatus.unauthenticated) return;
    state = const AuthState.signedOut(
      errorMessage: 'Votre session a expiré. Reconnectez-vous.',
    );
  }

  /// Déconnexion explicite.
  ///
  /// **L'annuaire de phase 2 est purgé ici, et seulement ici.**
  ///
  /// Pourquoi ici : cet appareil est le téléphone personnel du commercial, et
  /// l'annuaire y réplique jusqu'à 500 000 numéros. Le laisser survivre au
  /// départ de son propriétaire annulerait tout le bénéfice de l'avoir réduit à
  /// six champs : le numéro est justement le champ qu'on distribue.
  ///
  /// Pourquoi PAS dans [onSessionExpired] : une session expirée n'est pas un
  /// départ. Le commercial va se reconnecter avec le même compte, et effacer son
  /// annuaire lui imposerait de retélécharger 500 000 lignes sur son forfait
  /// parce qu'un jeton a dépassé sa durée de vie pendant la nuit.
  ///
  /// La purge est **committée avant** l'effacement des jetons : dans l'ordre
  /// inverse, une interruption entre les deux laisserait un annuaire complet sur
  /// un appareil sans session, donc sans écran pour le purger.
  Future<void> signOut() async {
    // Les annonces sont purgées au même titre que l'annuaire : elles peuvent
    // nommer des prospects, et le téléphone est personnel. Il n'y a plus de
    // jeton d'appareil à révoquer côté serveur : sans Firebase, aucun jeton
    // n'a été enregistré.
    await ref.read(pushInboxStoreProvider).purge();
    await ref.read(phase2DirectoryProvider).purge();
    final String? refresh = await _tokens.readRefreshToken();
    if (refresh != null) {
      try {
        await _api.logout(refreshToken: refresh);
      } on ApiException {
        // Une déconnexion serveur ratée ne doit pas retenir l'utilisateur sur
        // l'appareil : on efface localement quoi qu'il arrive.
      }
    }
    await _tokens.clear();
    state = const AuthState.signedOut();
  }

  /// Messages en français, sans code technique : l'utilisateur est un
  /// téléconseiller au téléphone, pas un développeur.
  static String _messageFor(ApiException e) => switch (e.code) {
    'invalid_credentials' => 'Identifiant ou mot de passe incorrect.',
    'account_disabled' => 'Ce compte est désactivé. Contactez votre responsable.',
    'network' || 'timeout' => 'Réseau indisponible. Réessayez une fois connecté.',
    _ => e.message ?? 'Connexion impossible pour le moment.',
  };
}
