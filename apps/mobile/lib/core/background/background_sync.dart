import 'dart:async';
import 'dart:developer' as developer;
import 'dart:ui';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';

import '../../data/local/connection.dart';
import '../../data/local/database.dart';
import '../../data/local/refresh_mutex_db.dart';
import '../../data/secure/secure_token_store.dart';
import '../network/dio_factory.dart';
import '../sync/dio_api.dart';
import '../sync/sync_engine.dart';
import '../sync/sync_engine_factory.dart';

/// Point d'entrée de l'isolat WorkManager.
///
/// **Les deux premières lignes ne sont pas décoratives.**
///
/// `WidgetsFlutterBinding.ensureInitialized()` crée le binding : sans lui, tout
/// appel de canal de plateforme lève. `DartPluginRegistrant.ensureInitialized()`
/// enregistre les plugins **dans cet isolat** : un isolat de fond démarre sans
/// aucun plugin enregistré, donc sans `flutter_secure_storage` (pas de jeton,
/// donc pas d'authentification), sans `path_provider` (pas de chemin de base,
/// donc pas de base de données) et sans `shared_preferences`. Les oublier ne
/// produit pas une erreur claire mais un `MissingPluginException` au milieu du
/// travail, dans un isolat dont personne ne lit les journaux.
///
/// `@pragma('vm:entry-point')` empêche l'arbre-secoueur AOT de supprimer la
/// fonction : elle n'est appelée depuis aucun code Dart, seulement depuis Java.
/// Sans l'annotation, l'app fonctionne parfaitement en debug et la
/// synchronisation de fond ne part jamais en release.
@pragma('vm:entry-point')
void callbackDispatcher() {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();

  Workmanager().executeTask((String task, Map<String, dynamic>? input) async {
    AppDatabase? database;
    try {
      final SecureTokenStore tokens = SecureTokenStore();
      if (await tokens.readRefreshToken() == null) {
        // Pas de session : rien à faire, et surtout pas de réessai : le worker
        // reviendrait toutes les 15 minutes pour ne rien faire.
        return true;
      }

      database = openAppDatabase();
      final SyncEngine engine = buildSyncEngine(
        database: database,
        // Le MÊME assemblage que l'isolat UI, par la même fabrique. Deux
        // constructions séparées divergeraient au premier paramètre ajouté, et
        // la divergence ne se verrait qu'en production, sur un appareil hors
        // ligne, chez un commercial.
        api: DioApi(
          ApiClientFactory.build(
            tokens: tokens,
            // Le MÊME verrou que l'isolat UI, adossé au même fichier de base.
            // C'est ce qui empêche ce worker et l'app ouverte de présenter le
            // même jeton de renouvellement en même temps : ce que le serveur
            // lit comme un rejeu, et qui coûte la session au commercial.
            mutex: DatabaseRefreshMutex(database),
          ).client,
        ),
        tokens: tokens,
      );
      final SyncOutcome outcome = await engine.runOnce();
      await _stampLastBackgroundRun();
      developer.log(
        'Tâche de fond $task : ${outcome.status.name} '
        '(${outcome.pushed} envoyées, ${outcome.pulled} reçues)',
        name: 'cpi.bg',
      );
      // `false` demande à WorkManager de réessayer avec SA propre politique de
      // back-off. On ne le fait que pour un échec transitoire : sur une session
      // morte, insister ne sert à rien.
      return !outcome.shouldRetry;
    } on Object catch (e, stack) {
      developer.log(
        'Tâche de fond $task en échec',
        name: 'cpi.bg',
        error: e,
        stackTrace: stack,
      );
      return false;
    } finally {
      // La connexion doit être refermée : l'isolat meurt juste après, mais un
      // fichier WAL laissé ouvert par un isolat tué se solde par un checkpoint
      // au démarrage suivant, donc par un lancement plus lent.
      await database?.close();
    }
  });
}

Future<void> _stampLastBackgroundRun() async {
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  await prefs.setInt(
    BackgroundSync.lastRunKey,
    DateTime.now().toUtc().millisecondsSinceEpoch,
  );
}

/// Programmation des tâches de fond.
///
/// **Aucune promesse de délai dans l'interface.** On n'écrit jamais « synchronisé
/// sous 15 minutes » : WorkManager ne le garantit pas sur AOSP, et le garantit
/// encore moins sur Transsion ou Xiaomi. L'app dit « Sera envoyé dès que
/// possible » avec un compteur explicite, ce qui est vrai.
///
/// `FOREGROUND_SERVICE_DATA_SYNC` est volontairement absent : Android 15 le
/// plafonne à 6 h par 24 h, il exige une notification permanente, et Google
/// Play demande une justification à la publication. Pour envoyer quelques
/// kilo-octets de texte, le coût est disproportionné.
abstract final class BackgroundSync {
  static const String periodicName = 'cpi.sync.periodic';
  static const String catchUpName = 'cpi.sync.catchup';
  static const String taskName = 'cpi-sync';
  static const String lastRunKey = 'sync.lastBackgroundRunAt';

  static Future<void> initialize() async {
    await Workmanager().initialize(callbackDispatcher);
    await Workmanager().registerPeriodicTask(
      periodicName,
      taskName,
      frequency: const Duration(minutes: 15),
      constraints: Constraints(
        networkType: NetworkType.connected,
        // Sans cette contrainte, un worker de synchronisation qui se réveille à
        // 4 % de batterie coûte à l'utilisateur les dernières minutes dont il a
        // besoin pour appeler. Les données attendront.
        requiresBatteryNotLow: true,
      ),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
    );
  }

  /// Rattrapage ponctuel, enfilé quand l'app passe en arrière-plan avec une file
  /// non vide.
  static Future<void> enqueueCatchUp() async {
    await Workmanager().registerOneOffTask(
      catchUpName,
      taskName,
      constraints: Constraints(
        networkType: NetworkType.connected,
        requiresBatteryNotLow: true,
      ),
      existingWorkPolicy: ExistingWorkPolicy.replace,
      backoffPolicy: BackoffPolicy.exponential,
      backoffPolicyDelay: const Duration(seconds: 30),
    );
  }

  /// Date du dernier passage réussi en arrière-plan, ou `null`.
  ///
  /// Alimente l'heuristique « la dernière synchronisation de fond date de N
  /// jours » qui fait remonter l'écran « Autorisations & batterie » : c'est le
  /// seul signal observable qu'une ROM constructeur tue nos tâches.
  static Future<DateTime?> lastRunAt() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final int? stamp = prefs.getInt(lastRunKey);
    if (stamp == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(stamp, isUtc: true);
  }
}
