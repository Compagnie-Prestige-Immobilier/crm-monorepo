// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_detail_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(OrderDetail)
final orderDetailProvider = OrderDetailFamily._();

final class OrderDetailProvider
    extends $NotifierProvider<OrderDetail, OrderDetailState> {
  OrderDetailProvider._({
    required OrderDetailFamily super.from,
    required int super.argument,
  }) : super(
         retry: null,
         name: r'orderDetailProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$orderDetailHash();

  @override
  String toString() {
    return r'orderDetailProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  OrderDetail create() => OrderDetail();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(OrderDetailState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<OrderDetailState>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is OrderDetailProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$orderDetailHash() => r'f5142ef8e9616c831a7c25c80f2a6b0c5f99aee4';

final class OrderDetailFamily extends $Family
    with
        $ClassFamilyOverride<
          OrderDetail,
          OrderDetailState,
          OrderDetailState,
          OrderDetailState,
          int
        > {
  OrderDetailFamily._()
    : super(
        retry: null,
        name: r'orderDetailProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  OrderDetailProvider call(int orderId) =>
      OrderDetailProvider._(argument: orderId, from: this);

  @override
  String toString() => r'orderDetailProvider';
}

abstract class _$OrderDetail extends $Notifier<OrderDetailState> {
  late final _$args = ref.$arg as int;
  int get orderId => _$args;

  OrderDetailState build(int orderId);
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<OrderDetailState, OrderDetailState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<OrderDetailState, OrderDetailState>,
              OrderDetailState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, () => build(_$args));
  }
}
