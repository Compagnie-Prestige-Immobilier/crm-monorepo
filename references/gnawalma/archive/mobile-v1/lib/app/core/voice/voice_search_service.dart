import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// Dictée de la recherche (§2.5).
///
/// Le cahier des charges présente les fonctions vocales comme « centrales pour
/// permettre l'usage de l'application par des personnes analphabètes ou peu à
/// l'aise avec l'écrit ». Une barre de recherche qui n'accepte que du texte tapé
/// exclut précisément le public que ce produit vise.
///
/// Reconnaissance sur l'appareil quand la plateforme le permet — c'est plus
/// rapide, cela fonctionne sans réseau, et cela évite d'envoyer la voix d'un
/// utilisateur à un service tiers pour une recherche de couturier.
class VoiceSearchService {
  VoiceSearchService({SpeechToText? speech})
    : _speech = speech ?? SpeechToText();

  final SpeechToText _speech;
  bool _available = false;
  bool _initialised = false;

  /// Le français est la langue par défaut du produit (D-005). Le wolof n'est pas
  /// proposé ici tant qu'il n'est pas validé par des locuteurs natifs, et la
  /// reconnaissance wolof n'existe de toute façon sur aucune des deux
  /// plateformes.
  static const localeId = 'fr_FR';

  bool get isListening => _speech.isListening;

  /// Prépare la reconnaissance et dit si l'appareil peut l'assurer.
  ///
  /// Renvoie `false` plutôt que de lever : un appareil sans moteur de dictée,
  /// ou un utilisateur qui refuse le micro, doit garder une application qui
  /// fonctionne — le champ texte reste là.
  Future<bool> prepare() async {
    if (_initialised) return _available;
    _initialised = true;
    try {
      _available = await _speech.initialize(
        onError: (error) => _log('erreur ${error.errorMsg}'),
        onStatus: _log,
      );
    } catch (error) {
      _available = false;
      _log('initialisation impossible ($error)');
    }
    return _available;
  }

  /// Écoute et rend le texte reconnu.
  ///
  /// [onPartial] reçoit les résultats intermédiaires : voir les mots s'inscrire
  /// pendant qu'on parle est ce qui rend la dictée compréhensible pour
  /// quelqu'un qui ne lit pas bien — l'écran confirme qu'il a entendu.
  Future<void> listen({
    required ValueChanged<String> onPartial,
    required ValueChanged<String> onFinal,
  }) async {
    if (!await prepare()) return;
    await _speech.listen(
      listenOptions: SpeechListenOptions(
        localeId: localeId,
        partialResults: true,
        // Une recherche est courte ; couper tôt évite de laisser le micro
        // ouvert dans la poche de quelqu'un.
        listenMode: ListenMode.search,
        cancelOnError: true,
        // Trois secondes de silence closent la phrase ; vingt secondes bornent
        // l'écoute même si le téléphone reste dans un endroit bruyant.
        pauseFor: const Duration(seconds: 3),
        listenFor: const Duration(seconds: 20),
      ),
      onResult: (result) {
        if (result.finalResult) {
          onFinal(result.recognizedWords.trim());
        } else {
          onPartial(result.recognizedWords.trim());
        }
      },
    );
  }

  Future<void> stop() => _speech.stop();

  Future<void> cancel() => _speech.cancel();

  static void _log(String message) {
    if (kDebugMode) debugPrint('[VoiceSearch] $message');
  }
}
