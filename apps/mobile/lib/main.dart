import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/background/background_sync.dart';
import 'core/providers/app_providers.dart';
import 'data/local/connection.dart';
import 'data/local/database.dart';
import 'data/repositories/draft_repository.dart';

/// Point d'entrée.
///
/// La base, les préférences et le numéro de build sont résolus **avant** le
/// premier cadre, et injectés par surcharge de providers. L'alternative — un
/// `FutureProvider` que l'arbre attend — ferait démarrer l'app sur un écran de
/// chargement à chaque lancement, et empêcherait de restaurer la dernière route
/// dès le premier cadre.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // En debug seulement : matérialise l'arbre de sémantique. Sans lui, l'app est
  // un rectangle opaque pour `uiautomator` et aucun test d'interface piloté
  // depuis l'extérieur n'est possible. En release, c'est le lecteur d'écran qui
  // décide — on ne paie pas l'arbre si personne ne le lit.
  if (kDebugMode) {
    SemanticsBinding.instance.ensureSemantics();
  }

  // Portrait uniquement : toute la saisie est verticale, et le paysage sur un
  // formulaire à quatre champs ne montre plus que deux champs et un clavier.
  await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );

  final AppDatabase database = openAppDatabase();
  final SharedPreferences preferences = await SharedPreferences.getInstance();
  final PackageInfo packageInfo = await PackageInfo.fromPlatform();

  // Purge des brouillons périmés au démarrage, jamais à l'ouverture d'un
  // formulaire : le faire à l'ouverture ajouterait une écriture sur le chemin le
  // plus sensible à la latence de toute l'app.
  unawaited(DraftRepository(database).purgeStale());

  // La programmation des tâches de fond ne bloque pas le premier cadre : elle
  // touche un canal de plateforme, et l'attendre retarde l'affichage sur un
  // appareil lent pour un bénéfice nul.
  unawaited(_initBackground());

  runApp(
    ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(database),
        sharedPreferencesProvider.overrideWithValue(preferences),
        buildNumberProvider.overrideWithValue(packageInfo.buildNumber),
      ],
      child: const CpiGoApp(),
    ),
  );
}

Future<void> _initBackground() async {
  try {
    await BackgroundSync.initialize();
  } on Object catch (e) {
    // Une ROM qui refuse WorkManager ne doit pas empêcher l'app de démarrer :
    // le chemin premier plan reste le chemin principal.
    debugPrint('Synchronisation de fond indisponible : $e');
  }
}
