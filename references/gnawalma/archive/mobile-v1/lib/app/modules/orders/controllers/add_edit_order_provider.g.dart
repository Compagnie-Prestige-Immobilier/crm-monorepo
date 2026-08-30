// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'add_edit_order_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(AddEditOrder)
final addEditOrderProvider = AddEditOrderFamily._();

final class AddEditOrderProvider
    extends $NotifierProvider<AddEditOrder, AddEditOrderState> {
  AddEditOrderProvider._({
    required AddEditOrderFamily super.from,
    required ({OrderModel? existingOrder, int? orderId}) super.argument,
  }) : super(
         retry: null,
         name: r'addEditOrderProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$addEditOrderHash();

  @override
  String toString() {
    return r'addEditOrderProvider'
        ''
        '$argument';
  }

  @$internal
  @override
  AddEditOrder create() => AddEditOrder();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AddEditOrderState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AddEditOrderState>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is AddEditOrderProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$addEditOrderHash() => r'66dd6aa060bd802c14db65b09096fb18cad564ce';

final class AddEditOrderFamily extends $Family
    with
        $ClassFamilyOverride<
          AddEditOrder,
          AddEditOrderState,
          AddEditOrderState,
          AddEditOrderState,
          ({OrderModel? existingOrder, int? orderId})
        > {
  AddEditOrderFamily._()
    : super(
        retry: null,
        name: r'addEditOrderProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  AddEditOrderProvider call({OrderModel? existingOrder, int? orderId}) =>
      AddEditOrderProvider._(
        argument: (existingOrder: existingOrder, orderId: orderId),
        from: this,
      );

  @override
  String toString() => r'addEditOrderProvider';
}

abstract class _$AddEditOrder extends $Notifier<AddEditOrderState> {
  late final _$args = ref.$arg as ({OrderModel? existingOrder, int? orderId});
  OrderModel? get existingOrder => _$args.existingOrder;
  int? get orderId => _$args.orderId;

  AddEditOrderState build({OrderModel? existingOrder, int? orderId});
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<AddEditOrderState, AddEditOrderState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AddEditOrderState, AddEditOrderState>,
              AddEditOrderState,
              Object?,
              Object?
            >;
    element.handleCreate(
      ref,
      () => build(existingOrder: _$args.existingOrder, orderId: _$args.orderId),
    );
  }
}
