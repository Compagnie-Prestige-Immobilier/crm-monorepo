import 'package:get_it/get_it.dart';
import '../../shared/utils/app_logger.dart';
import '../../data/services/database_service.dart';
import '../../data/services/storage_service.dart';
import '../../data/services/business_profile_service.dart';
import '../../data/services/invoice_service.dart';
import '../../data/services/security_service.dart';
import '../../data/services/notification_service.dart';
import '../../data/services/template_service.dart';
import '../../data/services/audio_recorder_service.dart';
import '../../data/services/project_service.dart';
import '../../data/services/order_service.dart';
import '../../data/services/client_service.dart';
import '../../data/services/seed_data_service.dart';
import '../../data/services/backup_service.dart';

import '../../data/repositories/client_repository.dart';
import '../../data/repositories/pattern_repository.dart';
import '../../data/repositories/project_repository.dart';
import '../../data/repositories/order_repository.dart';
import '../../data/repositories/beneficiary_repository.dart';
// import '../../modules/auth/repositories/local_auth_repository.dart'; // File doesn't exist
// import '../../domain/repositories/i_auth_repository.dart'; // Not used

import '../../domain/repositories/i_client_repository.dart';
import '../../domain/repositories/i_pattern_repository.dart';
import '../../domain/repositories/i_project_repository.dart';
import '../../domain/repositories/i_order_repository.dart';

// Helper for GetIt.I replacement
T inject<T extends Object>() => GetIt.I<T>();

Future<void> setupDependencies() async {
  AppLogger.i('🛠️ [DI] Starting dependency setup...');
  final getIt = GetIt.I;

  // --- 1. Core Services ---
  // Database
  AppLogger.i('🛠️ [DI] Registering DatabaseService...');
  getIt.registerSingleton<DatabaseService>(DatabaseService.instance);

  // Storage
  AppLogger.i('🛠️ [DI] Initializing StorageService...');
  final storageService = StorageService();
  await storageService.init();
  getIt.registerSingleton<StorageService>(storageService);

  // Business Profile
  AppLogger.i('🛠️ [DI] Initializing BusinessProfileService...');
  final businessProfileService = BusinessProfileService();
  await businessProfileService.init();
  getIt.registerSingleton<BusinessProfileService>(businessProfileService);

  // Invoice
  getIt.registerSingleton<InvoiceService>(InvoiceService());

  // Security
  getIt.registerSingleton<SecurityService>(SecurityService());

  // Notification
  getIt.registerSingleton<NotificationService>(NotificationService());

  // Template
  getIt.registerSingleton<TemplateService>(TemplateService());

  // Audio Recorder
  getIt.registerSingleton<AudioRecorderService>(AudioRecorderService());

  // Backup Service
  getIt.registerSingleton<BackupService>(BackupService());

  // --- 2. Repositories ---
  AppLogger.i('🛠️ [DI] Registering Repositories...');
  final db = getIt<DatabaseService>();

  getIt.registerLazySingleton<IClientRepository>(
    () => ClientRepository(db.isar),
  );
  getIt.registerLazySingleton<IPatternRepository>(
    () => PatternRepository(db.isar),
  );
  getIt.registerLazySingleton<IProjectRepository>(
    () => ProjectRepository(db.isar),
  );
  getIt.registerLazySingleton<IOrderRepository>(() => OrderRepository(db.isar));
  getIt.registerLazySingleton<BeneficiaryRepository>(
    () => BeneficiaryRepository(db.isar),
  );
  // Auth repository not implemented yet
  // getIt.registerLazySingleton<IAuthRepository>(() => LocalAuthRepository(
  //     getIt<SecurityService>(), getIt<BusinessProfileService>()));

  // --- 3. Domain Services ---
  getIt.registerLazySingleton<ClientService>(
    () => ClientService(
      getIt<IClientRepository>(),
      getIt<IOrderRepository>(),
      getIt<OrderService>(),
    ),
  );
  getIt.registerLazySingleton<ProjectService>(
    () => ProjectService(getIt<IProjectRepository>()),
  );
  getIt.registerLazySingleton<OrderService>(
    () => OrderService(
      getIt<IOrderRepository>(),
      getIt<IClientRepository>(),
      getIt<IProjectRepository>(),
      getIt<ProjectService>(),
      getIt<DatabaseService>().isar,
    ),
  );

  getIt.registerLazySingleton<SeedDataService>(
    () => SeedDataService(
      clientRepo: getIt<IClientRepository>(),
      projectRepo: getIt<IProjectRepository>(),
      orderRepo: getIt<IOrderRepository>(),
      profileService: getIt<BusinessProfileService>(),
      securityService: getIt<SecurityService>(),
    ),
  );

  // --- 4. Initialization Complete ---
  AppLogger.i('🛠️ [DI] Dependency setup complete.');
}
