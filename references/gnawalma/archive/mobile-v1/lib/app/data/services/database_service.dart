import 'package:isar_plus/isar_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../shared/utils/app_logger.dart';

import '../models/beneficiary_model.dart';
import '../models/business_profile_model.dart';
import '../models/client_model.dart';
import '../models/favorite_workshop_model.dart';
import '../models/order_model.dart';
import '../models/pattern_model.dart';
import '../models/project_model.dart';

part 'database_service.g.dart';

@Riverpod(keepAlive: true)
Future<Isar> database(Ref ref) async {
  if (!DatabaseService.instance.isInitialized) {
    await DatabaseService.instance.initialize();
  }

  final isar = DatabaseService.instance.isar;

  // No ref.onDispose(() => isar.close()) here because DatabaseService handles the lifecycle
  // and we want the database to persist across provider invalidations if needed,
  // or at least be managed centrally.

  return isar;
}

/// Singleton service that manages the Isar database instance
///
/// This service is responsible for:
/// - Initializing the Isar database
/// - Providing access to the database instance
/// - Managing the database lifecycle
class DatabaseService {
  static DatabaseService? _instance;
  static Isar? _isar;

  // Private constructor for singleton pattern
  DatabaseService._();

  /// Get the singleton instance of DatabaseService
  static DatabaseService get instance {
    _instance ??= DatabaseService._();
    return _instance!;
  }

  /// Get the Isar database instance
  /// Throws an exception if the database hasn't been initialized
  Isar get isar {
    if (_isar == null) {
      throw Exception(
        'Database not initialized. Call DatabaseService.instance.initialize() first.',
      );
    }
    return _isar!;
  }

  /// Check if the database is initialized
  bool get isInitialized => _isar != null;

  /// Initialize the Isar database
  ///
  /// This method should be called once at app startup, before the app runs.
  /// It will:
  /// 1. Get the app's documents directory
  /// 2. Open the Isar database with all schemas
  /// 3. Store the database instance for future use
  ///
  /// Note: The schemas list will be populated after running build_runner
  Future<void> initialize() async {
    if (_isar != null) {
      return; // Already initialized in this service
    }

    // Get the application documents directory
    final dir = await getApplicationDocumentsDirectory();

    // Open Isar database with all schemas
    _isar = Isar.open(
      schemas: [
        ProjectModelSchema,
        ClientModelSchema,
        OrderModelSchema,
        PatternModelSchema,
        BusinessProfileModelSchema,
        BeneficiaryModelSchema,
        FavoriteWorkshopModelSchema,
      ],
      directory: dir.path,
      name: 'gnawalma_db',
    );
    AppLogger.i('✅ IsarDB Initialized at: ${dir.path}');
  }

  /// Close the database connection
  ///
  /// This should typically only be called when the app is shutting down
  Future<void> close() async {
    // Isar close is synchronous in v4 if I recall, but let's check or keep it async if needed.
    // Actually Isar.open is synchronous in v4.
    // Let's check docs again.
    // "final isar = Isar.open(schemas: ...)" - It is synchronous!
    // But verify.
    // "void main() async { ... final isar = Isar.open(...) }" - it doesn't show await.

    // For close: "isar.close()" -> returns bool.

    _isar?.close();
    _isar = null;
  }

  /// Clear all data from the database
  ///
  /// WARNING: This will delete all data! Use with caution.
  /// Useful for testing or implementing a "reset app" feature
  Future<void> clearDatabase() async {
    if (_isar == null) return;

    await _isar!.writeAsync((isar) {
      isar.clear();
    });
  }
}
