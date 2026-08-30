import 'package:isar_plus/isar_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../models/beneficiary_model.dart';
import '../services/database_service.dart';
import '../../shared/utils/app_logger.dart';
import 'base_isar_repository.dart';

part 'beneficiary_repository.g.dart';

@Riverpod(keepAlive: true)
Future<BeneficiaryRepository> beneficiaryRepository(Ref ref) async {
  final isar = await ref.watch(databaseProvider.future);
  return BeneficiaryRepository(isar);
}

/// Repository for managing beneficiaries (family members linked to clients)
///
/// A beneficiary represents someone other than the client for whom
/// garments are being made (e.g., spouse, children, relatives)
class BeneficiaryRepository extends BaseIsarRepository<BeneficiaryModel> {
  BeneficiaryRepository(super.isar);

  @override
  IsarCollection<int, BeneficiaryModel> getCollection(Isar isar) =>
      isar.beneficiaryModels;

  @override
  IsarCollection<int, BeneficiaryModel> get collection =>
      isar.beneficiaryModels;

  /// Get the beneficiaries collection
  IsarCollection<int, BeneficiaryModel> get _beneficiaries =>
      isar.beneficiaryModels;

  @override
  Future<void> put(BeneficiaryModel item) async {
    final localIsar = isar;
    AppLogger.i('BeneficiaryRepository: Saving beneficiary "${item.label}"');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.beneficiaryModels.put(item);
      });
    } catch (e, stack) {
      AppLogger.e('BeneficiaryRepository: Error putting beneficiary', e, stack);
      rethrow;
    }
  }

  @override
  Future<void> putAll(List<BeneficiaryModel> items) async {
    final localIsar = isar;
    AppLogger.i('BeneficiaryRepository: Saving ${items.length} beneficiaries');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.beneficiaryModels.putAll(items);
      });
    } catch (e, stack) {
      AppLogger.e(
        'BeneficiaryRepository: Error putting multiple beneficiaries',
        e,
        stack,
      );
      rethrow;
    }
  }

  @override
  Future<void> delete(int id) async {
    final localIsar = isar;
    AppLogger.i('BeneficiaryRepository: Deleting beneficiary ID: $id');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.beneficiaryModels.delete(id);
      });
    } catch (e, stack) {
      AppLogger.e(
        'BeneficiaryRepository: Error deleting beneficiary',
        e,
        stack,
      );
      rethrow;
    }
  }

  // ===== CRUD Operations =====

  /// Get all beneficiaries for a specific client
  Future<List<BeneficiaryModel>> getBeneficiariesForClient(int clientId) async {
    return _beneficiaries.where().clientIdEqualTo(clientId).findAllAsync();
  }

  /// Get a beneficiary by ID
  Future<BeneficiaryModel?> getBeneficiaryById(int id) async {
    return getById(id);
  }

  /// Create a new beneficiary
  Future<int> createBeneficiary(BeneficiaryModel beneficiary) async {
    AppLogger.i(
      'BeneficiaryRepository: Creating beneficiary "${beneficiary.label}"',
    );
    beneficiary.createdAt = DateTime.now();
    if (beneficiary.id == 0) {
      beneficiary.id = _beneficiaries.autoIncrement();
    }
    await put(beneficiary);
    return beneficiary.id;
  }

  /// Update an existing beneficiary
  Future<void> updateBeneficiary(BeneficiaryModel beneficiary) async {
    await put(beneficiary);
  }

  /// Delete a beneficiary
  Future<void> deleteBeneficiary(int id) async {
    await delete(id);
  }

  // ===== Quick Access =====

  /// Get count of beneficiaries for a client
  Future<int> getBeneficiaryCountForClient(int clientId) async {
    return _beneficiaries.where().clientIdEqualTo(clientId).countAsync();
  }

  /// Check if a label already exists for a client
  Future<bool> labelExistsForClient(int clientId, String label) async {
    final beneficiaries = await getBeneficiariesForClient(clientId);
    return beneficiaries.any(
      (b) => b.label.toLowerCase() == label.toLowerCase(),
    );
  }

  // ===== Measurements =====

  /// Update measurements for a beneficiary
  Future<void> updateMeasurements(
    int beneficiaryId,
    Map<String, double> measurements,
  ) async {
    final beneficiary = await getBeneficiaryById(beneficiaryId);
    if (beneficiary == null) {
      throw Exception('Beneficiary not found');
    }

    beneficiary.setMeasurementsFromMap(measurements);
    await updateBeneficiary(beneficiary);
  }

  // ===== Real-time Updates =====

  /// Watch all beneficiaries for a client
  Stream<List<BeneficiaryModel>> watchBeneficiariesForClient(int clientId) {
    return _beneficiaries
        .where()
        .clientIdEqualTo(clientId)
        .watch(fireImmediately: true);
  }
}
