import 'dart:async';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

/// Ce qui vient de se passer, jamais le canal : l'appelant ne choisit ni la
/// vibration ni le son.
enum CpiFeedback {
  tap,
  choix,
  etape,
  succes,
  echec,
  rappel;

  /// `null` quand le geste est muet : un bip à chaque ligne touchée serait
  /// intenable sur une journée de saisie.
  String? get asset => switch (this) {
    CpiFeedback.tap || CpiFeedback.choix => null,
    _ => 'assets/sounds/$name.wav',
  };
}

/// Retours haptiques et sonores de l'interface.
///
/// Instance statique parce que le kit (`lib/ui/widgets/cpi_kit.dart`) est
/// Material pur et n'a pas de `Ref` ; [feedbackProvider] rend la MÊME instance
/// aux écrans, et les tests remplacent l'une ou l'autre.
class CpiFeedbackService {
  CpiFeedbackService({Future<AndroidRingerMode> Function()? lireLaSonnerie})
    : _lireLaSonnerie = lireLaSonnerie ?? _sonnerieDuTelephone;

  /// Remplaçable par les tests du kit, qui n'ont pas de conteneur Riverpod.
  static CpiFeedbackService instance = CpiFeedbackService();

  /// Le mode sonnerie ne change qu'à la main, dans un volet système qui met
  /// l'app en pause : deux secondes suffisent à le rattraper sans interroger
  /// le canal à chaque geste.
  static const Duration _fraicheurSonnerie = Duration(seconds: 2);

  final Future<AndroidRingerMode> Function() _lireLaSonnerie;
  final Map<CpiFeedback, Future<AudioPlayer>> _lecteurs =
      <CpiFeedback, Future<AudioPlayer>>{};

  bool _haptiques = true;
  bool _sons = true;
  AndroidRingerMode? _sonnerie;
  DateTime _sonnerieLue = DateTime.fromMillisecondsSinceEpoch(0);

  /// Poussés par `DisplaySettingsController` à chaque écriture : le kit lit le
  /// service, pas les préférences.
  void appliquerReglages({required bool haptiques, required bool sons}) {
    _haptiques = haptiques;
    _sons = sons;
  }

  void tap() => jouer(CpiFeedback.tap);

  void choix() => jouer(CpiFeedback.choix);

  void etape() => jouer(CpiFeedback.etape);

  void succes() => jouer(CpiFeedback.succes);

  void echec() => jouer(CpiFeedback.echec);

  void rappel() => jouer(CpiFeedback.rappel);

  /// Point de passage unique : une fausse implémentation n'a que ça à
  /// redéfinir.
  void jouer(CpiFeedback retour) {
    if (_haptiques) _haptique(retour).ignore();
    final String? asset = retour.asset;
    if (!_sons || asset == null) return;
    unawaited(_siLeTelephoneSonne(retour, asset));
  }

  /// Le premier `setAsset` coûte une centaine de millisecondes : il se paie
  /// après l'authentification, pas sur le geste qui déclenche le son.
  Future<void> preparer() async {
    for (final CpiFeedback retour in CpiFeedback.values) {
      final String? asset = retour.asset;
      if (asset == null) continue;
      try {
        await _lecteur(retour, asset);
      } on Object {
        _oublierLeLecteur(retour);
      }
    }
  }

  Future<void> _haptique(CpiFeedback retour) => switch (retour) {
    // Ni `successNotification` ni `errorNotification` : API 30, et le parc
    // descend à 24.
    CpiFeedback.tap || CpiFeedback.choix => HapticFeedback.selectionClick(),
    CpiFeedback.etape => HapticFeedback.lightImpact(),
    CpiFeedback.succes => HapticFeedback.mediumImpact(),
    CpiFeedback.echec => HapticFeedback.heavyImpact(),
    CpiFeedback.rappel => HapticFeedback.vibrate(),
  };

  Future<void> _siLeTelephoneSonne(CpiFeedback retour, String asset) async {
    try {
      if (await _sonnerieActuelle() != AndroidRingerMode.normal) return;
      await jouerLeSon(retour, asset);
    } on Object {
      // Un son raté ne casse pas le geste ; le lecteur sera reconstruit.
      _oublierLeLecteur(retour);
    }
  }

  void _oublierLeLecteur(CpiFeedback retour) {
    _lecteurs.remove(retour)?.then((AudioPlayer l) => l.dispose()).ignore();
  }

  /// Séparé de [jouer] pour que les tests observent le son sans pile audio :
  /// les garde-fous (réglages, sons muets, mode sonnerie) restent au-dessus.
  @visibleForTesting
  Future<void> jouerLeSon(CpiFeedback retour, String asset) async {
    final AudioPlayer lecteur = await _lecteur(retour, asset);
    await lecteur.seek(Duration.zero);
    lecteur.play().ignore();
  }

  Future<AudioPlayer> _lecteur(CpiFeedback retour, String asset) =>
      _lecteurs.putIfAbsent(retour, () async {
        // `handleAudioSessionActivation: false` et pas d'attributs venus de la
        // session : la note vocale (`call_audio_recorder.dart`) partage la
        // session audio du processus, un bip d'interface ne doit ni l'activer
        // ni la reconfigurer.
        final AudioPlayer lecteur = AudioPlayer(
          handleAudioSessionActivation: false,
          androidApplyAudioAttributes: false,
          handleInterruptions: false,
        );
        await lecteur.setAndroidAudioAttributes(
          const AndroidAudioAttributes(
            contentType: AndroidAudioContentType.sonification,
            usage: AndroidAudioUsage.assistanceSonification,
          ),
        );
        await lecteur.setAsset(asset);
        return lecteur;
      });

  Future<AndroidRingerMode> _sonnerieActuelle() async {
    final AndroidRingerMode? connue = _sonnerie;
    if (connue != null &&
        DateTime.now().difference(_sonnerieLue) < _fraicheurSonnerie) {
      return connue;
    }
    try {
      _sonnerie = await _lireLaSonnerie();
    } on Object {
      _sonnerie = AndroidRingerMode.normal;
    }
    _sonnerieLue = DateTime.now();
    return _sonnerie!;
  }

  static Future<AndroidRingerMode> _sonnerieDuTelephone() =>
      AndroidAudioManager().getRingerMode();
}

final Provider<CpiFeedbackService> feedbackProvider =
    Provider<CpiFeedbackService>((Ref ref) => CpiFeedbackService.instance);
