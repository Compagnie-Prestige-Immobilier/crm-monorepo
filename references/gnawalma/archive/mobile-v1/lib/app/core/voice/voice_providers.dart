import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'voice_guide_service.dart';
import 'voice_search_service.dart';

/// Une instance par application : les deux moteurs tiennent une connexion à un
/// service de la plateforme, et en ouvrir une par écran laisse des micros et
/// des synthèses vocales actifs derrière soi.
final voiceSearchServiceProvider = Provider<VoiceSearchService>((ref) {
  final service = VoiceSearchService();
  ref.onDispose(service.cancel);
  return service;
});

final voiceGuideServiceProvider = Provider<VoiceGuideService>((ref) {
  final service = VoiceGuideService();
  ref.onDispose(service.stop);
  return service;
});
