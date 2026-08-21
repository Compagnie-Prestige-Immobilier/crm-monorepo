import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/route_paths.dart';
import '../../data/local/database.dart';

abstract final class CampagnesRoutes {
  static const String liste = '/campagnes';
  static const String file = '/campagnes/:id';
  static const String idParam = 'id';

  static String fileFor(String campaignId) =>
      '$liste/${Uri.encodeComponent(campaignId)}';

  /// Le parcours d'appel existant, ouvert sur le numéro de la fiche.
  static String appelPour(String phoneE164) => Uri(
    path: Routes.phase2,
    queryParameters: <String, String>{Routes.prefillPhoneParam: phoneE164},
  ).toString();
}

final StreamProvider<List<CampaignsWithOpenWorkResult>> campagnesProvider =
    StreamProvider<List<CampaignsWithOpenWorkResult>>((Ref ref) {
      return ref.watch(appDatabaseProvider).campaignsWithOpenWork().watch();
    });

/// L'en-tête d'une campagne, absent tant que sa page de pull n'est pas
/// descendue : la file, elle, s'affiche quand même.
final campagneProvider = StreamProvider.family<CallCampaign?, String>((
  Ref ref,
  String campaignId,
) {
  final AppDatabase db = ref.watch(appDatabaseProvider);
  return (db.select(
    db.callCampaigns,
  )..where((CallCampaigns t) => t.id.equals(campaignId))).watchSingleOrNull();
});

final fileDeCampagneProvider =
    StreamProvider.family<List<CampaignQueueResult>, String>((
      Ref ref,
      String campaignId,
    ) {
      return ref
          .watch(appDatabaseProvider)
          .campaignQueue(campaignId: campaignId)
          .watch();
    });
