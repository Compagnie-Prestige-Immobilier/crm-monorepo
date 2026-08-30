// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'beneficiary_repository.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(beneficiaryRepository)
final beneficiaryRepositoryProvider = BeneficiaryRepositoryProvider._();

final class BeneficiaryRepositoryProvider
    extends
        $FunctionalProvider<
          AsyncValue<BeneficiaryRepository>,
          BeneficiaryRepository,
          FutureOr<BeneficiaryRepository>
        >
    with
        $FutureModifier<BeneficiaryRepository>,
        $FutureProvider<BeneficiaryRepository> {
  BeneficiaryRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'beneficiaryRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$beneficiaryRepositoryHash();

  @$internal
  @override
  $FutureProviderElement<BeneficiaryRepository> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<BeneficiaryRepository> create(Ref ref) {
    return beneficiaryRepository(ref);
  }
}

String _$beneficiaryRepositoryHash() =>
    r'53ef53513d3f64b003c8c2ba6c8392df7ba9c7ba';
