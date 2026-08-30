// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'new_order_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(NewOrder)
final newOrderProvider = NewOrderProvider._();

final class NewOrderProvider
    extends $NotifierProvider<NewOrder, NewOrderState> {
  NewOrderProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'newOrderProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$newOrderHash();

  @$internal
  @override
  NewOrder create() => NewOrder();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(NewOrderState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<NewOrderState>(value),
    );
  }
}

String _$newOrderHash() => r'b527f661d7633e28ab37e9eed29ef700b1c762da';

abstract class _$NewOrder extends $Notifier<NewOrderState> {
  NewOrderState build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<NewOrderState, NewOrderState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<NewOrderState, NewOrderState>,
              NewOrderState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
