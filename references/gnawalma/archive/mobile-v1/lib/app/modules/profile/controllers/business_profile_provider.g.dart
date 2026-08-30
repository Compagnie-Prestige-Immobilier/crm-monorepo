// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'business_profile_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(BusinessProfile)
final businessProfileProvider = BusinessProfileProvider._();

final class BusinessProfileProvider
    extends $NotifierProvider<BusinessProfile, BusinessProfileState> {
  BusinessProfileProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'businessProfileProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$businessProfileHash();

  @$internal
  @override
  BusinessProfile create() => BusinessProfile();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(BusinessProfileState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<BusinessProfileState>(value),
    );
  }
}

String _$businessProfileHash() => r'728443068d469411634a821bc3e1f0917af9ae1e';

abstract class _$BusinessProfile extends $Notifier<BusinessProfileState> {
  BusinessProfileState build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<BusinessProfileState, BusinessProfileState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<BusinessProfileState, BusinessProfileState>,
              BusinessProfileState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
