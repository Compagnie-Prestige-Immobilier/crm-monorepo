import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import 'app_space.dart';

part 'storage_service.g.dart';

@Riverpod(keepAlive: true)
StorageService storage(Ref ref) {
  return StorageService(const FlutterSecureStorage());
}

class StorageService {
  final FlutterSecureStorage _storage;

  StorageService([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  /// Deprecated: Use constructor injection
  Future<StorageService> init() async {
    return this;
  }

  // Keys
  static const String hasSeenOnboardingKey = 'has_seen_onboarding';
  static const String isAppLockedKey = 'is_app_locked';
  static const String activeSpaceKey = 'active_space';

  // Space
  //
  // Typed at the boundary: an unrecognised or absent stored value resolves to
  // null, which the router reads as "no space chosen yet".
  Future<AppSpace?> get activeSpace async =>
      AppSpace.fromStorageKey(await read(activeSpaceKey));
  Future<void> setActiveSpace(AppSpace space) async =>
      write(activeSpaceKey, space.storageKey);

  // Generic Write
  Future<void> write(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  // Generic Read
  Future<String?> read(String key) async {
    return await _storage.read(key: key);
  }

  // Generic Delete
  Future<void> delete(String key) async {
    await _storage.delete(key: key);
  }

  // Specific Methods
  Future<bool> get hasSeenOnboarding async {
    // Renamed getter to avoid conflict if needed, or just use property
    final val = await read(hasSeenOnboardingKey);
    return val == 'true';
  }

  Future<void> setOnboardingComplete() async {
    await write(hasSeenOnboardingKey, 'true');
  }

  Future<bool> get isAppLocked async {
    final val = await read(isAppLockedKey);
    // Default to false if not set
    return val == 'true';
  }

  Future<void> setAppLocked(bool isLocked) async {
    await write(isAppLockedKey, isLocked.toString());
  }

  // Clear method for testing/debugging
  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
