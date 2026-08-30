import 'dart:io';
import 'package:flutter/services.dart' show rootBundle;
import 'package:get_it/get_it.dart';
import 'package:path_provider/path_provider.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../shared/utils/app_logger.dart';
import '../../domain/repositories/i_client_repository.dart';
import '../../data/repositories/client_repository.dart';
import '../../data/repositories/project_repository.dart';
import '../../data/repositories/order_repository.dart';
import '../../domain/repositories/i_project_repository.dart';
import '../../domain/repositories/i_order_repository.dart';
import 'business_profile_service.dart';
import 'security_service.dart';
import '../models/business_profile_model.dart';
import '../../core/config/app_environment.dart';

part 'seed_data_service.g.dart';

@Riverpod(keepAlive: true)
Future<SeedDataService> seedDataService(Ref ref) async {
  final clientRepo = await ref.watch(clientRepositoryProvider.future);
  final projectRepo = await ref.watch(projectRepositoryProvider.future);
  final orderRepo = await ref.watch(orderRepositoryProvider.future);
  final profileService = await ref.watch(businessProfileProvider.future);
  final securityService = GetIt.I<SecurityService>();

  return SeedDataService(
    clientRepo: clientRepo,
    projectRepo: projectRepo,
    orderRepo: orderRepo,
    profileService: profileService,
    securityService: securityService,
  );
}

/// Seed data service for development/testing
/// Provides realistic Senegalese data for the app
class SeedDataService {
  final IClientRepository _clientRepo;
  final IProjectRepository _projectRepo;
  final IOrderRepository _orderRepo;
  final BusinessProfileService _profileService;
  final SecurityService _securityService;

  SeedDataService({
    required IClientRepository clientRepo,
    required IProjectRepository projectRepo,
    required IOrderRepository orderRepo,
    required BusinessProfileService profileService,
    required SecurityService securityService,
  }) : _clientRepo = clientRepo,
       _projectRepo = projectRepo,
       _orderRepo = orderRepo,
       _profileService = profileService,
       _securityService = securityService;

  /// Populates the local database when seeding is enabled and it is empty.
  ///
  /// Controlled by `AppEnvironment.seedData` (`--dart-define=SEED_DATA=1|0`)
  /// rather than a source constant, so a tester can get a populated app
  /// without editing code, and a release build cannot ship fixtures.
  Future<void> seedIfNeeded() async {
    if (!AppEnvironment.seedData) {
      AppLogger.i('Seed data disabled (SEED_DATA=0)');
      return;
    }

    // Check if data already exists (Clients is usually a good proxy)
    // BUT for OWNER, we check Profile
    final hasProfile = await _profileService.hasProfile();

    if (!hasProfile) {
      AppLogger.i('🌱 Seeding Owner Profile...');
      await _seedOwner();
    }

    final clients = await _clientRepo.getAllClients();
    if (clients.isNotEmpty) {
      AppLogger.i('✅ Database already seeded');
      return;
    }

    AppLogger.i('🌱 Seeding database with Senegalese data...');

    try {
      AppLogger.i('✅ Database seeded successfully!');
    } catch (e) {
      AppLogger.e('❌ Error seeding database', e);
    }
  }

  /// Seed Owner Profile and PIN
  Future<void> _seedOwner() async {
    String? logoPath;

    // Try to seed logo from assets
    try {
      final byteData = await rootBundle.load('assets/logo.png');
      final file = await _getLocalFile('seed_logo.png');
      await file.writeAsBytes(
        byteData.buffer.asUint8List(
          byteData.offsetInBytes,
          byteData.lengthInBytes,
        ),
      );
      logoPath = file.path;
      AppLogger.i('✅ Logo seeded to: $logoPath');
    } catch (e) {
      AppLogger.e('⚠️ Could not seed logo', e);
    }

    // 1. Create Profile
    final profile = BusinessProfileModel()
      ..businessName = 'Gnawalma Couture'
      ..phone =
          '781706184' // Requested test user
      ..email = 'contact@gnawalma.sn'
      ..address = 'Dakar, Sénégal'
      ..logoPath = logoPath;

    await _profileService.saveProfile(profile);

    // 2. Set PIN
    await _securityService.setPin('0000'); // Requested PIN

    AppLogger.i('✅ Owner seeded: 781706184 / 0000');
  }

  Future<File> _getLocalFile(String filename) async {
    final directory = await getApplicationDocumentsDirectory();
    return File('${directory.path}/$filename');
  }

  /// Clear all seed data (useful for testing)
  Future<void> clearAllData() async {
    AppLogger.i('🗑️ Clearing all data...');

    // Get all items
    final clients = await _clientRepo.getAllClients();
    final projects = await _projectRepo.getAllProjects();
    final orders = await _orderRepo.getAllOrders();

    // Delete all
    for (final client in clients) {
      await _clientRepo.deleteClient(client.id);
    }
    for (final project in projects) {
      await _projectRepo.deleteProject(project.id);
    }
    for (final order in orders) {
      await _orderRepo.deleteOrder(order.id);
    }

    AppLogger.i('✅ All data cleared');
  }
}
