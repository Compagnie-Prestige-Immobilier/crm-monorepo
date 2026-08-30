import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:get_it/get_it.dart';
import 'package:hive_ce_flutter/hive_ce_flutter.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../data/services/app_space.dart';
import '../data/services/database_service.dart';
import '../data/services/seed_data_service.dart';
import '../data/services/storage_service.dart';
import '../core/config/app_environment.dart';
import '../core/di/dependency_injection.dart';

/// Bootstrapper for the Gnawalma Application.
///
/// Handles all initialization logic before the UI is shown.
/// This includes:
/// - Framework binding
/// - Localization
/// - Database (Hive + Isar)
/// - Core Services (Storage, Auth, Preferences)
class AppBootstrapper {
  /// Static reference to the Riverpod container for legacy bridge support
  static late final ProviderContainer container;

  /// The space the app starts in, resolved before the first frame.
  ///
  /// The accent is derived from this, so it has to be known synchronously. Read
  /// asynchronously instead, the first frames render with no value and the
  /// whole app falls back to the other space's hue — and any later refresh of
  /// that read flips it again mid-session.
  ///
  /// Null until a space has been chosen, which is the onboarding case.
  static AppSpace? initialSpace;

  /// Initializes everything and returns the root widget or void.
  static Future<void> init() async {
    debugPrint('🚀 [Bootstrapper] Init started');
    // 1. Framework & UI
    WidgetsFlutterBinding.ensureInitialized();

    // Set preferred orientations
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);

    // Android 15 enforces edge-to-edge; declaring it here makes the behaviour
    // identical on older releases instead of only appearing on new devices.
    // Every screen already reads its insets from MediaQuery, so drawing behind
    // the system bars costs nothing and removes the grey nav-bar band.
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarDividerColor: Colors.transparent,
      ),
    );

    // 2. Localization
    await initializeDateFormatting('fr_FR', null);

    // 3. Local Databases
    debugPrint('🚀 [Bootstrapper] Init Hive & Database');
    await Hive.initFlutter();
    await DatabaseService.instance.initialize();

    // 4. Dependency Injection (Service Layer)
    debugPrint('🚀 [Bootstrapper] Setup Dependencies');
    await setupDependencies();

    // 5. Seed Data. See AppEnvironment.seedData — off in release, and
    // overridable with --dart-define=SEED_DATA=1|0.
    if (AppEnvironment.seedData) {
      try {
        final seedService = GetIt.I<SeedDataService>();
        await seedService.seedIfNeeded();
      } catch (e) {
        debugPrint('Error seeding data: $e');
      }
    }
    // 6. Active space, so the first frame is already painted in the right
    // accent rather than correcting itself once a read resolves.
    initialSpace = await StorageService().activeSpace;

    debugPrint('🚀 [Bootstrapper] Init finished');
  }
}
