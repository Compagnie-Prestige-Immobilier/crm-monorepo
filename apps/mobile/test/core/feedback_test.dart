import 'package:audio_session/audio_session.dart';
import 'package:cpi_go/core/feedback/feedback.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Le vocabulaire des retours : une intention par geste, la même sensation
/// partout, et rien qui sonne quand le téléphone est posé en silencieux.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late List<MethodCall> canal;

  setUp(() {
    canal = <MethodCall>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (
          MethodCall call,
        ) async {
          if (call.method == 'HapticFeedback.vibrate') canal.add(call);
          return null;
        });
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null),
    );
  });

  /// Le service réel, sauf la pile audio : les garde-fous testés (réglages,
  /// gestes muets, mode sonnerie) sont tous au-dessus de `jouerLeSon`.
  _ServiceObserve service({
    AndroidRingerMode sonnerie = AndroidRingerMode.normal,
  }) => _ServiceObserve(sonnerie);

  List<String?> typesHaptiques() =>
      canal.map((MethodCall c) => c.arguments as String?).toList();

  group('vocabulaire', () {
    test('chaque intention a SA sensation', () async {
      final _ServiceObserve retours = service()
        ..appliquerReglages(
          haptiques: true,
          // Le son est jugé ailleurs : ici on ne mesure que la vibration.
          sons: false,
        );

      retours
        ..tap()
        ..choix()
        ..etape()
        ..succes()
        ..echec()
        ..rappel();
      await pumpEventQueue();

      expect(typesHaptiques(), <String?>[
        'HapticFeedbackType.selectionClick',
        'HapticFeedbackType.selectionClick',
        'HapticFeedbackType.lightImpact',
        'HapticFeedbackType.mediumImpact',
        'HapticFeedbackType.heavyImpact',
        // `vibrate()` n'a pas de type : c'est la vibration longue, réservée au
        // rappel qui tombe par-dessus l'écran.
        null,
      ]);
    });

    test('« successNotification » n\'est jamais demandé', () async {
      // API 30 alors que le parc descend à 24 : sur un Transsion sous
      // Android 7 le retour serait simplement absent.
      final _ServiceObserve retours = service();
      retours
        ..succes()
        ..echec();
      await pumpEventQueue();

      expect(
        typesHaptiques(),
        isNot(
          anyElement(
            anyOf(
              'HapticFeedbackType.successNotification',
              'HapticFeedbackType.errorNotification',
            ),
          ),
        ),
      );
    });

    test('taper et choisir ne font AUCUN bruit', () async {
      final _ServiceObserve retours = service();
      retours
        ..tap()
        ..choix();
      await pumpEventQueue();

      expect(retours.sonsJoues, isEmpty);
      expect(canal, hasLength(2));
    });

    test('les trois autres portent leur fichier', () async {
      final _ServiceObserve retours = service();
      retours
        ..etape()
        ..succes()
        ..echec()
        ..rappel();
      await pumpEventQueue();

      expect(retours.sonsJoues, <String>[
        'assets/sounds/etape.wav',
        'assets/sounds/succes.wav',
        'assets/sounds/echec.wav',
        'assets/sounds/rappel.wav',
      ]);
    });
  });

  group('réglages', () {
    test(
      'vibrations coupées : le canal est muet, le son part quand même',
      () async {
        final _ServiceObserve retours = service()
          ..appliquerReglages(haptiques: false, sons: true);

        retours
          ..tap()
          ..succes();
        await pumpEventQueue();

        expect(canal, isEmpty);
        expect(retours.sonsJoues, <String>['assets/sounds/succes.wav']);
      },
    );

    test('sons coupés : la vibration reste', () async {
      final _ServiceObserve retours = service()
        ..appliquerReglages(haptiques: true, sons: false);

      retours.succes();
      await pumpEventQueue();

      expect(typesHaptiques(), <String?>['HapticFeedbackType.mediumImpact']);
      expect(retours.sonsJoues, isEmpty);
    });

    test('les deux coupés : rien ne part', () async {
      final _ServiceObserve retours = service()
        ..appliquerReglages(haptiques: false, sons: false);

      retours.rappel();
      await pumpEventQueue();

      expect(canal, isEmpty);
      expect(retours.sonsJoues, isEmpty);
    });
  });

  group('mode sonnerie', () {
    test('silencieux : aucun son, la vibration reste', () async {
      final _ServiceObserve retours = service(
        sonnerie: AndroidRingerMode.silent,
      );

      retours.succes();
      await pumpEventQueue();

      expect(retours.sonsJoues, isEmpty);
      expect(typesHaptiques(), <String?>['HapticFeedbackType.mediumImpact']);
    });

    test('vibreur : aucun son non plus', () async {
      final _ServiceObserve retours = service(
        sonnerie: AndroidRingerMode.vibrate,
      );

      retours.rappel();
      await pumpEventQueue();

      expect(retours.sonsJoues, isEmpty);
      expect(canal, hasLength(1));
    });

    test('sonnerie normale : le son part', () async {
      final _ServiceObserve retours = service();

      retours.rappel();
      await pumpEventQueue();

      expect(retours.sonsJoues, <String>['assets/sounds/rappel.wav']);
    });

    test('le mode n\'est relu qu\'une fois par rafale', () async {
      // Deux secondes de cache : un écran qui enchaîne trois retours ne fait
      // pas trois allers-retours de canal.
      final _ServiceObserve retours = service();

      retours.succes();
      await pumpEventQueue();
      retours
        ..echec()
        ..etape();
      await pumpEventQueue();

      expect(retours.lecturesSonnerie, 1);
      expect(retours.sonsJoues, hasLength(3));
    });
  });
}

/// Le service réel avec deux fenêtres : le mode sonnerie qu'on lui donne, et
/// les sons qu'il aurait joués.
class _ServiceObserve extends CpiFeedbackService {
  factory _ServiceObserve(AndroidRingerMode mode) =>
      _ServiceObserve._(_Sonnerie(mode));

  _ServiceObserve._(_Sonnerie sonnerie)
    : _sonnerie = sonnerie,
      super(lireLaSonnerie: sonnerie.lire);

  final _Sonnerie _sonnerie;
  final List<String> sonsJoues = <String>[];

  int get lecturesSonnerie => _sonnerie.lectures;

  @override
  Future<void> jouerLeSon(CpiFeedback retour, String asset) async {
    sonsJoues.add(asset);
  }
}

class _Sonnerie {
  _Sonnerie(this.mode);

  final AndroidRingerMode mode;
  int lectures = 0;

  Future<AndroidRingerMode> lire() async {
    lectures += 1;
    return mode;
  }
}
