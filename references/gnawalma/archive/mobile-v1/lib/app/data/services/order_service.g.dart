// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(orderService)
final orderServiceProvider = OrderServiceProvider._();

final class OrderServiceProvider
    extends
        $FunctionalProvider<
          AsyncValue<OrderService>,
          OrderService,
          FutureOr<OrderService>
        >
    with $FutureModifier<OrderService>, $FutureProvider<OrderService> {
  OrderServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'orderServiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$orderServiceHash();

  @$internal
  @override
  $FutureProviderElement<OrderService> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<OrderService> create(Ref ref) {
    return orderService(ref);
  }
}

String _$orderServiceHash() => r'0836b330024f336ef8ae153b4d51612547e2e906';
