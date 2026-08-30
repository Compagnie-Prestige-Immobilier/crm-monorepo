// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'business_profile_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(businessProfile)
final businessProfileProvider = BusinessProfileProvider._();

final class BusinessProfileProvider
    extends
        $FunctionalProvider<
          AsyncValue<BusinessProfileService>,
          BusinessProfileService,
          FutureOr<BusinessProfileService>
        >
    with
        $FutureModifier<BusinessProfileService>,
        $FutureProvider<BusinessProfileService> {
  BusinessProfileProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'businessProfileProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$businessProfileHash();

  @$internal
  @override
  $FutureProviderElement<BusinessProfileService> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<BusinessProfileService> create(Ref ref) {
    return businessProfile(ref);
  }
}

String _$businessProfileHash() => r'5e62b7b9a073fcd5e2bbd38483622f5ea8722f86';
