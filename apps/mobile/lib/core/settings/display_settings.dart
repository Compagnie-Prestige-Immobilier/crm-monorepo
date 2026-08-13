import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart' show TextScaler;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../providers/app_providers.dart';

/// Taille de texte choisie dans l'app.
///
/// Trois paliers et non un curseur continu : un curseur oblige à viser une
/// valeur, et rien ne dit à l'utilisateur laquelle est la bonne. Trois choix se
/// comparent d'un coup d'œil.
///
/// Les facteurs se **multiplient** au réglage système : quelqu'un qui a déjà
/// grossi le texte d'Android ne doit pas voir son choix annulé par l'app.
enum CpiTextScale {
  normal('Normal', 1.0),
  large('Grand', 1.15),
  extraLarge('Très grand', 1.35);

  const CpiTextScale(this.label, this.factor);

  final String label;
  final double factor;

  static CpiTextScale fromName(String? raw) {
    return CpiTextScale.values.firstWhere(
      (CpiTextScale v) => v.name == raw,
      orElse: () => CpiTextScale.normal,
    );
  }
}

/// Réglages d'affichage persistés.
@immutable
class DisplaySettings {
  const DisplaySettings({
    this.textScale = CpiTextScale.normal,
    this.reduceMotion = false,
  });

  final CpiTextScale textScale;

  /// Miroir applicatif de `MediaQuery.disableAnimations`.
  ///
  /// Un même chemin de code pour les deux : `CpiMotion.of` lit
  /// `MediaQuery.maybeDisableAnimationsOf`, et la racine y injecte ce booléen.
  /// Aucun widget n'a donc à connaître le réglage.
  final bool reduceMotion;

  DisplaySettings copyWith({CpiTextScale? textScale, bool? reduceMotion}) {
    return DisplaySettings(
      textScale: textScale ?? this.textScale,
      reduceMotion: reduceMotion ?? this.reduceMotion,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is DisplaySettings &&
      other.textScale == textScale &&
      other.reduceMotion == reduceMotion;

  @override
  int get hashCode => Object.hash(textScale, reduceMotion);
}

/// Bornes de la mise à l'échelle du texte, réglage de l'app **compris**.
///
/// Le plancher est 1,0 : en dessous, le texte devient illisible. Le plafond
/// monte de 1,3 à 1,8 pour laisser passer « Très grand » (1,35) même quand
/// Android impose déjà 1,3. Chaque écran a été vérifié à ce plafond.
const double kCpiMinTextScale = 1.0;
const double kCpiMaxTextScale = 1.8;

/// Borne du seul réglage **système**, avant multiplication par le choix de
/// l'app. Sans elle, un téléphone réglé à 2,0 ferait déborder les cartes.
const double kCpiMaxSystemTextScale = 1.3;

class DisplaySettingsController extends Notifier<DisplaySettings> {
  static const String _scaleKey = 'display.textScale';
  static const String _motionKey = 'display.reduceMotion';

  @override
  DisplaySettings build() {
    final SharedPreferences prefs = ref.watch(sharedPreferencesProvider);
    return DisplaySettings(
      textScale: CpiTextScale.fromName(prefs.getString(_scaleKey)),
      reduceMotion: prefs.getBool(_motionKey) ?? false,
    );
  }

  Future<void> setTextScale(CpiTextScale value) async {
    state = state.copyWith(textScale: value);
    await ref.read(sharedPreferencesProvider).setString(_scaleKey, value.name);
  }

  Future<void> setReduceMotion({required bool value}) async {
    state = state.copyWith(reduceMotion: value);
    await ref.read(sharedPreferencesProvider).setBool(_motionKey, value);
  }
}

final NotifierProvider<DisplaySettingsController, DisplaySettings>
displaySettingsProvider =
    NotifierProvider<DisplaySettingsController, DisplaySettings>(
      DisplaySettingsController.new,
    );

/// Facteur final appliqué à la racine.
///
/// `TextScaler` ne se compose pas : il n'existe pas d'API pour enchaîner deux
/// échelles. On mesure donc l'échelle système sur une taille de référence, on la
/// borne, on la multiplie par le choix de l'app, et on reborne le tout.
double resolveTextScaleFactor({
  required TextScaler system,
  required CpiTextScale choice,
}) {
  const double probe = 16;
  final double systemFactor = (system.scale(probe) / probe).clamp(
    kCpiMinTextScale,
    kCpiMaxSystemTextScale,
  );
  return (systemFactor * choice.factor).clamp(
    kCpiMinTextScale,
    kCpiMaxTextScale,
  );
}
