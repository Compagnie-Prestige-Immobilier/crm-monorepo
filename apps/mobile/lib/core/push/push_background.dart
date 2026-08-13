import 'dart:developer' as developer;
import 'dart:ui';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../../data/local/connection.dart';
import '../../data/local/database.dart';
import 'firebase_push_transport.dart';
import 'push_inbox_store.dart';
import 'push_message.dart';

/// Point d'entrée de l'isolat d'arrière-plan de FCM.
///
/// ═══ CE QUE CETTE FONCTION FAIT, ET CE QU'ELLE NE FAIT PAS ═══
///
/// Elle NE fait PAS apparaître la notification. C'est Android qui s'en charge,
/// tout seul, parce que le serveur envoie un bloc `notification` en plus du
/// bloc `data`. La remise visible ne dépend donc d'AUCUN code Dart — et c'est
/// délibéré : un gestionnaire d'arrière-plan qui échoue sur un téléphone
/// exotique ne doit pas faire disparaître la notification elle-même.
///
/// Elle sert uniquement à tenir la boîte de réception locale à jour pendant que
/// l'application est fermée, pour que l'ouverture suivante affiche la liste
/// complète sans attendre le réseau. Tout y est donc au conditionnel : la
/// moindre défaillance est journalisée et avalée.
///
/// `@pragma('vm:entry-point')` empêche l'arbre-secoueur AOT de supprimer la
/// fonction : elle n'est appelée depuis aucun code Dart, seulement depuis le
/// moteur. Sans l'annotation, tout marche en debug et rien ne marche en
/// release — le pire mode de défaillance possible.
///
/// `DartPluginRegistrant.ensureInitialized()` vient de `dart:ui` et enregistre
/// les plugins DANS CET ISOLAT. Un isolat d'arrière-plan démarre sans aucun
/// plugin : sans cet appel, `path_provider` manque, donc la base ne s'ouvre
/// pas, et l'erreur est un `MissingPluginException` au milieu d'un isolat dont
/// personne ne lit les journaux. Même raisonnement que le worker WorkManager,
/// voir `core/background/background_sync.dart`.
///
/// Aucun import `package:flutter/` : la discipline de pureté de
/// `lib/core/sync/` s'applique ici à l'identique, et un test la vérifie.
@pragma('vm:entry-point')
Future<void> cpiPushBackgroundHandler(RemoteMessage message) async {
  DartPluginRegistrant.ensureInitialized();

  AppDatabase? database;
  try {
    await Firebase.initializeApp();

    final PushMessage? push = toPushMessage(message);
    if (push == null) {
      // Message sans `notificationId` : rien à dédupliquer, rien à marquer lu.
      return;
    }

    database = openAppDatabase();
    await PushInboxStore(database).upsert(push);

    developer.log('Notification ${push.id} enregistrée hors premier plan.', name: 'cpi.push');
  } on Object catch (error, stack) {
    developer.log(
      'Gestionnaire push d’arrière-plan en échec (la notification reste '
      'affichée par Android) : $error',
      name: 'cpi.push',
      error: error,
      stackTrace: stack,
    );
  } finally {
    // La connexion DOIT être refermée : un fichier WAL laissé ouvert par un
    // isolat tué se solde par un checkpoint au démarrage suivant.
    await database?.close();
  }
}
