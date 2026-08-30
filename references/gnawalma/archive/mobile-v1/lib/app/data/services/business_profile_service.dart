import 'package:get_it/get_it.dart';
import 'package:isar_plus/isar_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../models/business_profile_model.dart';
import 'database_service.dart';

part 'business_profile_service.g.dart';

@Riverpod(keepAlive: true)
Future<BusinessProfileService> businessProfile(Ref ref) async {
  final isar = await ref.watch(databaseProvider.future);
  return BusinessProfileService(isar);
}

class BusinessProfileService {
  late Isar _isar;

  BusinessProfileService([Isar? isar]) {
    if (isar != null) _isar = isar;
  }

  Future<BusinessProfileService> init() async {
    _isar = GetIt.I<DatabaseService>().isar;
    return this;
  }

  Future<BusinessProfileModel?> getProfile() async {
    return _isar.businessProfileModels.get(0);
  }

  Future<void> saveProfile(BusinessProfileModel profile) async {
    profile.id = 0; // Ensure singleton
    await _isar.writeAsync((isar) {
      isar.businessProfileModels.put(profile);
    });
  }

  Future<bool> hasProfile() async {
    // Isar synchronous operations might be restricted or deprecated.
    // Using async count() is safer.
    return _isar.businessProfileModels.count() > 0;
  }
}
