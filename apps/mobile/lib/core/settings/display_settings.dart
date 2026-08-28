import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show ThemeMode;
import 'package:flutter/painting.dart' show TextScaler;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../feedback/feedback.dart';
import '../providers/app_providers.dart';

/// Les noms sont PERSISTÉS (`display.textScale`) : les renommer effacerait le
/// choix déjà enregistré sur les téléphones du parc.
enum CpiTextScale {
  tresPetit('Très petit', 0.85),
  petit('Petit', 0.92),
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

@immutable
class DisplaySettings {
  const DisplaySettings({
    this.textScale = CpiTextScale.normal,
    this.reduceMotion = false,
    this.themeMode = ThemeMode.system,
    this.haptiques = true,
    this.sons = true,
  });

  final CpiTextScale textScale;

  final bool reduceMotion;

  final ThemeMode themeMode;

  final bool haptiques;

  final bool sons;

  DisplaySettings copyWith({
    CpiTextScale? textScale,
    bool? reduceMotion,
    ThemeMode? themeMode,
    bool? haptiques,
    bool? sons,
  }) {
    return DisplaySettings(
      textScale: textScale ?? this.textScale,
      reduceMotion: reduceMotion ?? this.reduceMotion,
      themeMode: themeMode ?? this.themeMode,
      haptiques: haptiques ?? this.haptiques,
      sons: sons ?? this.sons,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is DisplaySettings &&
      other.textScale == textScale &&
      other.reduceMotion == reduceMotion &&
      other.themeMode == themeMode &&
      other.haptiques == haptiques &&
      other.sons == sons;

  @override
  int get hashCode =>
      Object.hash(textScale, reduceMotion, themeMode, haptiques, sons);
}

/// Plancher de la part SYSTÈME : un Android réglé plus petit que 1,0 ne rétrécit
/// pas l'app, seul le choix explicite de l'utilisateur le fait.
const double kCpiMinTextScale = 1.0;
const double kCpiMaxTextScale = 1.8;

const double kCpiMaxSystemTextScale = 1.3;

class DisplaySettingsController extends Notifier<DisplaySettings> {
  static const String _scaleKey = 'display.textScale';
  static const String _motionKey = 'display.reduceMotion';
  static const String _themeModeKey = 'display.themeMode';
  static const String _haptiquesKey = 'display.haptiques';
  static const String _sonsKey = 'display.sons';

  @override
  DisplaySettings build() {
    final SharedPreferences prefs = ref.watch(sharedPreferencesProvider);
    final DisplaySettings settings = DisplaySettings(
      textScale: CpiTextScale.fromName(prefs.getString(_scaleKey)),
      reduceMotion: _bool(prefs, _motionKey, defaut: false),
      themeMode: _themeModeFromName(prefs.getString(_themeModeKey)),
      haptiques: _bool(prefs, _haptiquesKey, defaut: true),
      sons: _bool(prefs, _sonsKey, defaut: true),
    );
    _pousserAuService(settings);
    return settings;
  }

  Future<void> setTextScale(CpiTextScale value) async {
    state = state.copyWith(textScale: value);
    await ref.read(sharedPreferencesProvider).setString(_scaleKey, value.name);
  }

  Future<void> setReduceMotion({required bool value}) async {
    state = state.copyWith(reduceMotion: value);
    await ref.read(sharedPreferencesProvider).setBool(_motionKey, value);
  }

  Future<void> setHaptiques({required bool value}) async {
    state = state.copyWith(haptiques: value);
    _pousserAuService(state);
    await ref.read(sharedPreferencesProvider).setBool(_haptiquesKey, value);
  }

  Future<void> setSons({required bool value}) async {
    state = state.copyWith(sons: value);
    _pousserAuService(state);
    await ref.read(sharedPreferencesProvider).setBool(_sonsKey, value);
  }

  /// Le kit est Material pur : il lit le service statique, pas ce provider.
  static void _pousserAuService(DisplaySettings settings) {
    CpiFeedbackService.instance.appliquerReglages(
      haptiques: settings.haptiques,
      sons: settings.sons,
    );
  }

  Future<void> setThemeMode(ThemeMode value) async {
    state = state.copyWith(themeMode: value);
    await ref
        .read(sharedPreferencesProvider)
        .setString(_themeModeKey, value.name);
  }

  /// `getBool` LÈVE si la clé porte autre chose qu'un booléen — un fichier de
  /// préférences restauré d'une autre version ouvrirait l'app sur un écran
  /// blanc, au démarrage, sans recours.
  static bool _bool(
    SharedPreferences prefs,
    String key, {
    required bool defaut,
  }) {
    final Object? value = prefs.get(key);
    return value is bool ? value : defaut;
  }

  static ThemeMode _themeModeFromName(String? raw) {
    return ThemeMode.values.firstWhere(
      (ThemeMode v) => v.name == raw,
      orElse: () => ThemeMode.system,
    );
  }
}

final NotifierProvider<DisplaySettingsController, DisplaySettings>
displaySettingsProvider =
    NotifierProvider<DisplaySettingsController, DisplaySettings>(
      DisplaySettingsController.new,
    );

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
    CpiTextScale.tresPetit.factor,
    kCpiMaxTextScale,
  );
}
