import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

/// Guidage vocal (§2.5) : l'application lit à voix haute ce qui est à l'écran.
///
/// Prévu pour les personnes qui ne lisent pas bien. Ce n'est pas un lecteur
/// d'écran — TalkBack et VoiceOver font ce travail, mieux, pour qui les active.
/// C'est l'inverse : un bouton unique et visible qui dit la phrase importante
/// d'un écran, pour quelqu'un qui n'a jamais activé de service d'accessibilité
/// et ne sait pas qu'ils existent.
class VoiceGuideService {
  VoiceGuideService({FlutterTts? tts}) : _tts = tts ?? FlutterTts();

  final FlutterTts _tts;
  bool _configured = false;

  /// Français : langue par défaut du produit (D-005).
  static const language = 'fr-FR';

  /// Un peu plus lent que la valeur par défaut.
  ///
  /// Le débit natif d'Android est nettement trop rapide pour une phrase que
  /// l'auditeur entend une seule fois, sans pouvoir la relire.
  static const _rate = 0.45;

  Future<void> _configure() async {
    if (_configured) return;
    _configured = true;
    try {
      await _tts.setLanguage(language);
      await _tts.setSpeechRate(_rate);
      await _tts.setVolume(1);
      await _tts.setPitch(1);
      await _tts.awaitSpeakCompletion(true);
    } catch (error) {
      _log('configuration impossible ($error)');
    }
  }

  /// Lit [text]. Une lecture en cours est interrompue : l'utilisateur qui
  /// appuie une seconde fois veut la nouvelle phrase, pas les deux mêlées.
  Future<void> speak(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    await _configure();
    try {
      await _tts.stop();
      await _tts.speak(trimmed);
    } catch (error) {
      _log('lecture impossible ($error)');
    }
  }

  Future<void> stop() async {
    try {
      await _tts.stop();
    } catch (_) {
      // Rien à faire : l'arrêt d'une lecture qui n'a pas commencé n'est pas un
      // échec dont l'utilisateur doive être informé.
    }
  }

  static void _log(String message) {
    if (kDebugMode) debugPrint('[VoiceGuide] $message');
  }
}
