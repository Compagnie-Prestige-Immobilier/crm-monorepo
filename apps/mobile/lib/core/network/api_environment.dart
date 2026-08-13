/// Adresse du serveur — **Dart pur**.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// POURQUOI LE DÉFAUT DÉPEND DU MODE DE COMPILATION
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Le défaut était `http://10.0.2.2:3001` en toutes circonstances — l'alias de
/// la machine du développeur vu depuis l'émulateur Android. Sur un vrai
/// téléphone, cette adresse ne désigne rien : l'APK s'installait, l'écran de
/// connexion s'affichait, et la connexion échouait sans que rien ne dise
/// pourquoi. Il fallait se souvenir de passer `--dart-define` à CHAQUE build de
/// release, et l'oublier une fois produisait un APK muet.
///
/// Un oubli qui casse la version distribuée ne doit pas être possible. Le
/// défaut suit donc le mode de compilation :
///
///   - **release** → le serveur de production. Un APK distribué parle au VPS,
///     qu'on ait pensé au `--dart-define` ou non.
///   - **debug / profile** → `10.0.2.2:3001`, l'API locale, ce que veut un
///     développement sur émulateur.
///
/// `--dart-define=CPI_API_BASE_URL=…` reste prioritaire dans les deux cas :
///
///     flutter run   --dart-define=CPI_API_BASE_URL=https://go.cpi-chues.com
///     flutter build apk --release   # pointe déjà sur la production
///
/// `bool.fromEnvironment('dart.vm.product')` et non `kReleaseMode` : cette
/// constante vient du VM Dart, pas de `package:flutter/foundation.dart`. Ce
/// fichier est atteint depuis l'isolat WorkManager, qui n'a pas d'arbre de
/// widgets, et un test de balayage interdit `package:flutter` dans cette
/// couche. Les deux valent la même chose ; seule celle-ci est importable ici.
abstract final class ApiEnvironment {
  /// Production. Constante nommée pour que l'écran « À propos » puisse dire si
  /// l'appareil parle au bon serveur sans réécrire l'URL une seconde fois.
  static const String productionBaseUrl = 'https://go.cpi-chues.com';

  /// Alias de la machine hôte vu depuis l'émulateur Android. `localhost` y
  /// désigne l'émulateur lui-même et ne répond à rien.
  static const String emulatorHostBaseUrl = 'http://10.0.2.2:3001';

  static const bool _isRelease = bool.fromEnvironment('dart.vm.product');

  static const String baseUrl = String.fromEnvironment(
    'CPI_API_BASE_URL',
    defaultValue: _isRelease ? productionBaseUrl : emulatorHostBaseUrl,
  );

  /// `true` quand l'appareil parle à une adresse de développement.
  ///
  /// Sert l'avertissement de l'écran « À propos » : un utilisateur qui ne se
  /// connecte pas doit pouvoir constater lui-même que son APK vise une machine
  /// locale, sans avoir à joindre un développeur.
  static bool get isDevelopmentServer =>
      baseUrl.contains('10.0.2.2') ||
      baseUrl.contains('localhost') ||
      baseUrl.contains('127.0.0.1');

  /// En-tête `user-agent` exigé par `/auth/login` et `/auth/refresh` : le
  /// serveur s'en sert pour lier une famille de jetons à un appareil.
  static const String userAgent = 'CPI-GO/1.0 (Android)';
}
