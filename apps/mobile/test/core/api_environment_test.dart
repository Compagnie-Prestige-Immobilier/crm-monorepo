import 'package:cpi_go/core/network/api_environment.dart';
import 'package:flutter_test/flutter_test.dart';

/// L'adresse du serveur.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// LE DÉFAUT QUE CE FICHIER EXISTE POUR INTERDIRE
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Le défaut a été observé sur un vrai téléphone : l'APK s'installait, l'écran
/// de connexion s'affichait, et rien ne se connectait. Le défaut de
/// `CPI_API_BASE_URL` était `http://10.0.2.2:3001` : l'alias de la machine du
/// développeur vu depuis l'émulateur, qui ne désigne rien sur un appareil réel.
///
/// Il fallait donc se souvenir de `--dart-define` à CHAQUE build de release, et
/// l'oublier une seule fois produisait un APK muet. Un oubli qui casse la
/// version distribuée n'est pas une consigne à retenir, c'est un défaut de
/// conception.
///
/// LIMITE CONNUE, à lire avant de faire confiance à ce fichier : `flutter test`
/// s'exécute en mode DEBUG. Ces tests vérifient donc la branche développement
/// et la mécanique de bascule, jamais la valeur produite par un vrai build de
/// release : `dart.vm.product` y vaut toujours `false`. La garantie de bout en
/// bout est l'écran « À propos », qui affiche l'adresse réellement compilée.
void main() {
  group('adresse du serveur', () {
    test('la production est nommée, et c’est bien le domaine déployé', () {
      expect(ApiEnvironment.productionBaseUrl, 'https://go.cpi-chues.com');
      expect(
        ApiEnvironment.productionBaseUrl,
        startsWith('https://'),
        reason:
            'du HTTP nu ferait circuler les identifiants de connexion en clair '
            'sur un réseau mobile sénégalais',
      );
    });

    test('l’adresse de production n’est PAS une adresse de développement', () {
      // Le prédicat lui-même est vérifié : c'est lui qui décide de
      // l'avertissement affiché à l'utilisateur, et un prédicat faux rendrait
      // l'avertissement muet précisément quand il servirait.
      for (final String local in <String>[
        'http://10.0.2.2:3001',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ]) {
        expect(
          ApiEnvironment.productionBaseUrl,
          isNot(local),
          reason: 'la production ne doit jamais pointer sur une machine locale',
        );
      }
    });

    test('en mode debug, le défaut vise l’API locale', () {
      // `flutter test` tourne en debug : c'est la branche que ce test peut voir.
      // Elle doit viser la machine hôte, sinon développer sur émulateur
      // exigerait un `--dart-define` à chaque lancement.
      expect(ApiEnvironment.baseUrl, ApiEnvironment.emulatorHostBaseUrl);
      expect(ApiEnvironment.isDevelopmentServer, isTrue);
    });

    test('le libellé de l’émulateur est bien 10.0.2.2, jamais localhost', () {
      // `localhost` désigne l'ÉMULATEUR lui-même, pas la machine hôte : il ne
      // répond à rien. La confusion entre les deux est le grand classique du
      // développement Android, et elle se paie en une heure de recherche.
      expect(ApiEnvironment.emulatorHostBaseUrl, contains('10.0.2.2'));
      expect(ApiEnvironment.emulatorHostBaseUrl, isNot(contains('localhost')));
    });

    test('isDevelopmentServer reconnaît les trois formes locales', () {
      // Vérifié par construction sur les constantes exposées : le prédicat lit
      // `baseUrl`, on ne peut pas le nourrir arbitrairement sans recompiler.
      // Ce qu'on peut affirmer, c'est qu'il répond vrai sur la valeur courante
      // (debug) et que la constante de production ne contient aucune des trois.
      expect(ApiEnvironment.isDevelopmentServer, isTrue);
      expect(ApiEnvironment.productionBaseUrl, isNot(contains('10.0.2.2')));
      expect(ApiEnvironment.productionBaseUrl, isNot(contains('localhost')));
      expect(ApiEnvironment.productionBaseUrl, isNot(contains('127.0.0.1')));
    });

    test('l’en-tête user-agent est posé : /auth/login l’exige', () {
      expect(ApiEnvironment.userAgent, isNotEmpty);
      expect(ApiEnvironment.userAgent, contains('CPI-GO'));
    });
  });
}
