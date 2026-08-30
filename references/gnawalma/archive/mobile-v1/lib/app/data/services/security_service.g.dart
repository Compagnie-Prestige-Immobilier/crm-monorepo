// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'security_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Riverpod provider for SecurityService

@ProviderFor(securityService)
final securityServiceProvider = SecurityServiceProvider._();

/// Riverpod provider for SecurityService

final class SecurityServiceProvider
    extends
        $FunctionalProvider<
          AsyncValue<SecurityService>,
          SecurityService,
          FutureOr<SecurityService>
        >
    with $FutureModifier<SecurityService>, $FutureProvider<SecurityService> {
  /// Riverpod provider for SecurityService
  SecurityServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'securityServiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$securityServiceHash();

  @$internal
  @override
  $FutureProviderElement<SecurityService> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<SecurityService> create(Ref ref) {
    return securityService(ref);
  }
}

String _$securityServiceHash() => r'629c571243b8d0209208031c350899fbc8623585';

@ProviderFor(Security)
final securityProvider = SecurityProvider._();

final class SecurityProvider
    extends $AsyncNotifierProvider<Security, SecurityState> {
  SecurityProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'securityProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$securityHash();

  @$internal
  @override
  Security create() => Security();
}

String _$securityHash() => r'3336ec4f4a47e12340357b523552b40e29cf73a1';

abstract class _$Security extends $AsyncNotifier<SecurityState> {
  FutureOr<SecurityState> build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<AsyncValue<SecurityState>, SecurityState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<SecurityState>, SecurityState>,
              AsyncValue<SecurityState>,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
