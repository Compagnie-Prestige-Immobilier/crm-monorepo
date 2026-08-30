// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backup_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(backup)
final backupProvider = BackupProvider._();

final class BackupProvider
    extends $FunctionalProvider<BackupService, BackupService, BackupService>
    with $Provider<BackupService> {
  BackupProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'backupProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$backupHash();

  @$internal
  @override
  $ProviderElement<BackupService> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  BackupService create(Ref ref) {
    return backup(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(BackupService value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<BackupService>(value),
    );
  }
}

String _$backupHash() => r'4e123a3e4a066ea6f3d211834d9de12bcfeca44e';
