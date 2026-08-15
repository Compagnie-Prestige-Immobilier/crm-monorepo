import 'package:cpi_go/core/router/route_memory.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('Routes.loginWithNext', () {
    test('encode la destination en composant d\'URI', () {
      final String location = Routes.loginWithNext('/representants/abc-123');
      expect(location, '/login?next=%2Frepresentants%2Fabc-123');
    });

    test('survit à une destination qui contient déjà une requête', () {
      // Sans encodage, `&filtre=actif` deviendrait un paramètre de /login et
      // serait perdu au retour.
      final String location = Routes.loginWithNext('/prospects?tri=date&filtre=actif');
      final Uri uri = Uri.parse(location);
      expect(uri.path, '/login');
      expect(uri.queryParameters[Routes.nextParam], '/prospects?tri=date&filtre=actif');
    });

    test('n\'empile pas /login sur lui-même', () {
      expect(Routes.loginWithNext(Routes.login), Routes.login);
      expect(Routes.loginWithNext(''), Routes.login);
    });

    test('le décodage est fait une seule fois par Uri.queryParameters', () {
      // Une destination contenant un `%` littéral doit revenir intacte. Un
      // `Uri.decodeComponent` supplémentaire côté garde la corromprait.
      const String target = '/recherche?q=100%25';
      final Uri uri = Uri.parse(Routes.loginWithNext(target));
      expect(uri.queryParameters[Routes.nextParam], target);
    });
  });

  group('Routes.isPublic', () {
    test('seul /login est public', () {
      expect(Routes.isPublic('/login'), isTrue);
      expect(Routes.isPublic('/login?next=%2F'), isTrue);
      expect(Routes.isPublic('/'), isFalse);
      expect(Routes.isPublic('/representants'), isFalse);
    });
  });

  group('RouteMemory', () {
    /// Instant fixe : la fenêtre de 24 h se teste en déplaçant `now`, jamais en
    /// attendant.
    final DateTime t0 = DateTime.utc(2026, 8, 12, 9);
    late RouteMemory memory;

    setUp(() async {
      SharedPreferences.setMockInitialValues(<String, Object>{});
      memory = RouteMemory(await SharedPreferences.getInstance(), buildNumber: '42');
    });

    test('rien à restaurer au premier lancement', () {
      expect(memory.read(authenticated: true, now: t0), isNull);
    });

    test('mémorise et restitue la dernière route métier', () async {
      await memory.write('/representants/abc', now: t0);
      expect(memory.read(authenticated: true, now: t0), '/representants/abc');
    });

    test('la référence au brouillon voyage dans l\'URI', () async {
      // C'est `?draft=<id>` qui ramène la saisie en cours : et une référence,
      // jamais le contenu du formulaire.
      await memory.write('/representants/nouveau?draft=d1', now: t0);
      expect(
        memory.read(authenticated: true, now: t0),
        '/representants/nouveau?draft=d1',
      );
    });

    test('ne mémorise jamais l\'écran de connexion', () async {
      await memory.write('/representants/abc', now: t0);
      await memory.write('/login?next=%2F', now: t0);
      // Restaurer /login renverrait un utilisateur déjà connecté sur un
      // formulaire de connexion.
      expect(memory.read(authenticated: true, now: t0), '/representants/abc');
    });

    test('sans session, rien n\'est restauré', () async {
      await memory.write('/representants/abc', now: t0);
      // Restaurer une route métier pour un utilisateur déconnecté produirait un
      // écran vide derrière un garde de route.
      expect(memory.read(authenticated: false, now: t0), isNull);
    });

    test('un autre numéro de build invalide la mémoire', () async {
      await memory.write('/representants/abc', now: t0);
      final RouteMemory afterUpdate = RouteMemory(
        await SharedPreferences.getInstance(),
        buildNumber: '43',
      );
      // La mise à jour a pu déplacer ou supprimer la route : la restaurer
      // ouvrirait l'app sur « Page introuvable ».
      expect(afterUpdate.read(authenticated: true, now: t0), isNull);
    });

    test('au-delà de 24 h, l\'intention a expiré', () async {
      await memory.write('/representants/abc', now: t0);
      expect(
        memory.read(
          authenticated: true,
          now: t0.add(const Duration(hours: 23, minutes: 59)),
        ),
        '/representants/abc',
      );
      expect(
        memory.read(
          authenticated: true,
          now: t0.add(const Duration(hours: 24, minutes: 1)),
        ),
        isNull,
      );
    });

    test('liste blanche : une route inconnue efface la mémoire', () async {
      await memory.write('/representants/abc', now: t0);
      expect(memory.read(authenticated: true, now: t0), '/representants/abc');

      await memory.write('/reglages/autorisations', now: t0);
      // ═══ CE QUI CHANGE ═══
      //
      // L'écriture renonçait en silence et laissait l'entrée précédente
      // intacte : quitter un formulaire pour Réglages puis fermer l'app
      // rouvrait le formulaire, jusqu'à 24 h plus tard, sur une saisie
      // sciemment abandonnée.
      expect(
        memory.read(authenticated: true, now: t0),
        isNull,
        reason: 'la mémoire suit l\'intention, pas la dernière adresse mémorisable',
      );

      expect(RouteMemory.isRestorable('/reglages/autorisations'), isFalse);
      expect(RouteMemory.isRestorable('/representants'), isTrue);
      expect(RouteMemory.isRestorable('/'), isTrue);
    });

    test('une mémoire illisible ne bloque pas le démarrage', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'flutter.route_memory.v2': 'ceci n\'est pas du JSON',
      });
      final RouteMemory corrupted = RouteMemory(
        await SharedPreferences.getInstance(),
        buildNumber: '42',
      );
      expect(corrupted.read(authenticated: true, now: t0), isNull);
    });

    test('clear efface la mémoire', () async {
      await memory.write('/prospects', now: t0);
      await memory.clear();
      expect(memory.read(authenticated: true, now: t0), isNull);
    });

    // ── Un retour arrière n'enterre pas une saisie en cours ────────────────────
    //
    // La mémorisation écoute le `routerDelegate` : CHAQUE changement d'adresse
    // l'appelle, retour arrière compris. Un commercial qui ouvre
    // « Nouveau représentant », tape un nom, puis revient au sélecteur pour
    // vérifier une fiche voyait `/representants/nouveau?draft=X` remplacé par
    // `/representants`. Le processus tué dix secondes plus tard, la restauration
    // à froid rouvrait le sélecteur : la saisie était toujours en base, et plus
    // aucune adresse ne la désignait.

    Future<RouteMemory> withDrafts(Set<String> existing) async {
      return RouteMemory(
        await SharedPreferences.getInstance(),
        buildNumber: '42',
        draftExists: (String id) async => existing.contains(id),
      );
    }

    test('revenir à l\'écran parent n\'écrase pas l\'adresse du brouillon', () async {
      final RouteMemory m = await withDrafts(<String>{'d1'});
      await m.write('/representants/nouveau?draft=d1', now: t0);
      await m.write('/representants', now: t0);
      expect(m.read(authenticated: true, now: t0), '/representants/nouveau?draft=d1');
    });

    test('une fois le brouillon enregistré, l\'écriture reprend son cours', () async {
      final RouteMemory kept = await withDrafts(<String>{'d1'});
      await kept.write('/representants/nouveau?draft=d1', now: t0);

      // Le formulaire a été enregistré : la transaction d'écriture a supprimé
      // le brouillon. Il n'y a plus rien à protéger.
      final RouteMemory saved = await withDrafts(const <String>{});
      await saved.write('/representants', now: t0);
      expect(saved.read(authenticated: true, now: t0), '/representants');
    });

    test('un vrai changement de contexte écrase, sinon la mémoire se fige', () async {
      final RouteMemory m = await withDrafts(<String>{'d1'});
      await m.write('/representants/nouveau?draft=d1', now: t0);
      await m.write('/prospects/nouveau?rep=r1', now: t0);
      expect(m.read(authenticated: true, now: t0), '/prospects/nouveau?rep=r1');
    });

    test('l\'accueil n\'est ancêtre de rien : il écrase normalement', () async {
      // `/` préfixe toutes les routes ; le traiter comme un ancêtre figerait la
      // mémoire dès qu'un brouillon existe quelque part.
      final RouteMemory m = await withDrafts(<String>{'d1'});
      await m.write('/representants/nouveau?draft=d1', now: t0);
      await m.write('/', now: t0);
      expect(m.read(authenticated: true, now: t0), '/');
    });
  });
}
