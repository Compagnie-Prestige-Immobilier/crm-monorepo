import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart' show TextScaler;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../providers/app_providers.dart';

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

@immutable
class DisplaySettings {
  const DisplaySettings({
    this.textScale = CpiTextScale.normal,
    this.reduceMotion = false,
  });

  final CpiTextScale textScale;

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

const double kCpiMinTextScale = 1.0;
const double kCpiMaxTextScale = 1.8;

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
displaySettingsProvider = NotifierProvider<DisplaySettingsController, DisplaySettings>(
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
  return (systemFactor * choice.factor).clamp(kCpiMinTextScale, kCpiMaxTextScale);
}
