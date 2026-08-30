// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'seed_data_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(seedDataService)
final seedDataServiceProvider = SeedDataServiceProvider._();

final class SeedDataServiceProvider
    extends
        $FunctionalProvider<
          AsyncValue<SeedDataService>,
          SeedDataService,
          FutureOr<SeedDataService>
        >
    with $FutureModifier<SeedDataService>, $FutureProvider<SeedDataService> {
  SeedDataServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'seedDataServiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$seedDataServiceHash();

  @$internal
  @override
  $FutureProviderElement<SeedDataService> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<SeedDataService> create(Ref ref) {
    return seedDataService(ref);
  }
}

String _$seedDataServiceHash() => r'2643de7ccb6603d98febcf0a3f0d92a84e13fa8d';
