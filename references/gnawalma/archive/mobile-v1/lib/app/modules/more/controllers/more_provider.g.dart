// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'more_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(More)
final moreProvider = MoreProvider._();

final class MoreProvider extends $NotifierProvider<More, MoreState> {
  MoreProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'moreProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$moreHash();

  @$internal
  @override
  More create() => More();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(MoreState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<MoreState>(value),
    );
  }
}

String _$moreHash() => r'8e1fec65af679730c34e930efd68e56df62bce6b';

abstract class _$More extends $Notifier<MoreState> {
  MoreState build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<MoreState, MoreState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<MoreState, MoreState>,
              MoreState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
