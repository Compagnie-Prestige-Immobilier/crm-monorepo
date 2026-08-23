import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:drift/drift.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/route_paths.dart';
import '../../data/local/database.dart';

abstract final class CampagnesRoutes {
  static const String liste = '/campagnes';
  static const String file = '/campagnes/:id';
  static const String grandPublicListe = '/grand-public/campagnes';
  static const String grandPublicFile = '/grand-public/campagnes/:id';
  static const String grandPublicConsole = '/grand-public/console';
  static const String idParam = 'id';

  static String fileFor(String campaignId) =>
      '$liste/${Uri.encodeComponent(campaignId)}';

  static String grandPublicFileFor(String campaignId) =>
      '$grandPublicListe/${Uri.encodeComponent(campaignId)}';

  /// Le parcours d'appel existant, ouvert sur le numéro de la fiche.
  static String appelPour(String phoneE164) => Uri(
    path: Routes.phase2,
    queryParameters: <String, String>{Routes.prefillPhoneParam: phoneE164},
  ).toString();

  static String appelGrandPublicPour(String phoneE164) => Uri(
    path: grandPublicConsole,
    queryParameters: <String, String>{Routes.prefillPhoneParam: phoneE164},
  ).toString();
}

final StreamProvider<List<CampaignsWithOpenWorkResult>> campagnesProvider =
    StreamProvider<List<CampaignsWithOpenWorkResult>>((Ref ref) {
      return ref.watch(appDatabaseProvider).campaignsWithOpenWork().watch();
    });

final StreamProvider<List<CampaignsWithOpenWorkResult>>
grandPublicCampagnesProvider =
    StreamProvider<List<CampaignsWithOpenWorkResult>>((Ref ref) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      return db
          .customSelect(
            'SELECT c.*, COUNT(t.id) AS ouvertes '
            'FROM call_campaigns c '
            'JOIN call_tasks t ON t.campaign_id = c.id AND t.status = \'OPEN\' '
            'JOIN prospects p ON p.id = t.prospect_id '
            '  AND p.deleted_at IS NULL AND p.projet = \'GRAND_PUBLIC\' '
            'GROUP BY c.id ORDER BY c.updated_at DESC',
            readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
              db.callCampaigns,
              db.callTasks,
              db.prospects,
            },
          )
          .map(
            (QueryRow row) => CampaignsWithOpenWorkResult(
              id: row.read<String>('id'),
              name: row.read<String>('name'),
              status: row.read<String>('status'),
              spreadDays: row.read<int>('spread_days'),
              closedAt: row.read<DateTime?>('closed_at'),
              updatedAt: row.read<DateTime>('updated_at'),
              ouvertes: row.read<int>('ouvertes'),
            ),
          )
          .watch();
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

final grandPublicFileDeCampagneProvider =
    StreamProvider.family<List<CampaignQueueResult>, String>((
      Ref ref,
      String campaignId,
    ) {
      final AppDatabase db = ref.watch(appDatabaseProvider);
      return db
          .customSelect(
            'SELECT t.*, p.nom, p.prenom, p.phone_e164 '
            'FROM call_tasks t JOIN prospects p ON p.id = t.prospect_id '
            'WHERE t.campaign_id = ?1 AND t.status = \'OPEN\' '
            '  AND p.deleted_at IS NULL AND p.projet = \'GRAND_PUBLIC\' '
            'ORDER BY t.day_index ASC, t.position ASC',
            variables: <Variable<Object>>[Variable<String>(campaignId)],
            readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
              db.callTasks,
              db.prospects,
            },
          )
          .map(
            (QueryRow row) => CampaignQueueResult(
              id: row.read<String>('id'),
              campaignId: row.read<String>('campaign_id'),
              prospectId: row.read<String>('prospect_id'),
              position: row.read<int>('position'),
              dayIndex: row.read<int>('day_index'),
              status: row.read<String>('status'),
              updatedAt: row.read<DateTime>('updated_at'),
              nom: row.read<String>('nom'),
              prenom: row.read<String>('prenom'),
              phoneE164: row.read<String>('phone_e164'),
            ),
          )
          .watch();
    });
