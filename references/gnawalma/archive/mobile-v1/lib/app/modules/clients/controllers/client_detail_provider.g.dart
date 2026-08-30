// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'client_detail_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(ClientDetail)
final clientDetailProvider = ClientDetailFamily._();

final class ClientDetailProvider
    extends $NotifierProvider<ClientDetail, ClientDetailState> {
  ClientDetailProvider._({
    required ClientDetailFamily super.from,
    required (int, {bool isPreviewMode}) super.argument,
  }) : super(
         retry: null,
         name: r'clientDetailProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$clientDetailHash();

  @override
  String toString() {
    return r'clientDetailProvider'
        ''
        '$argument';
  }

  @$internal
  @override
  ClientDetail create() => ClientDetail();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(ClientDetailState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<ClientDetailState>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is ClientDetailProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$clientDetailHash() => r'28c806ff9ee0b1b319e2981cb358fc463de5dcda';

final class ClientDetailFamily extends $Family
    with
        $ClassFamilyOverride<
          ClientDetail,
          ClientDetailState,
          ClientDetailState,
          ClientDetailState,
          (int, {bool isPreviewMode})
        > {
  ClientDetailFamily._()
    : super(
        retry: null,
        name: r'clientDetailProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  ClientDetailProvider call(int clientId, {bool isPreviewMode = false}) =>
      ClientDetailProvider._(
        argument: (clientId, isPreviewMode: isPreviewMode),
        from: this,
      );

  @override
  String toString() => r'clientDetailProvider';
}

abstract class _$ClientDetail extends $Notifier<ClientDetailState> {
  late final _$args = ref.$arg as (int, {bool isPreviewMode});
  int get clientId => _$args.$1;
  bool get isPreviewMode => _$args.isPreviewMode;

  ClientDetailState build(int clientId, {bool isPreviewMode = false});
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<ClientDetailState, ClientDetailState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<ClientDetailState, ClientDetailState>,
              ClientDetailState,
              Object?,
              Object?
            >;
    element.handleCreate(
      ref,
      () => build(_$args.$1, isPreviewMode: _$args.isPreviewMode),
    );
  }
}
