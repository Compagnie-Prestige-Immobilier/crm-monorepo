import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/models/order_model.dart';
import '../../../data/repositories/order_repository.dart';
import 'orders_state.dart';

part 'orders_provider.g.dart';

@riverpod
Stream<List<OrderModel>> ordersStream(Ref ref) async* {
  final repository = await ref.watch(orderRepositoryProvider.future);

  // Initial data fetch
  final initialOrders = await repository.getAllOrders();
  yield initialOrders;

  // Subsequent updates
  yield* repository.watchOrders();
}

@Riverpod(keepAlive: true)
class Orders extends _$Orders {
  @override
  OrdersState build() {
    final ordersAsync = ref.watch(ordersStreamProvider);

    return ordersAsync.maybeWhen(
      data: (orders) {
        final initialState = OrdersState(
          orders: orders,
          isLoading: false,
          searchQuery: stateOrNull?.searchQuery ?? '',
          selectedOrderStatus: stateOrNull?.selectedOrderStatus,
          selectedPaymentStatus: stateOrNull?.selectedPaymentStatus,
        );
        return _applyFiltersInternal(initialState);
      },
      error: (_, _) => OrdersState(
        isLoading: false,
        hasError: true,
        searchQuery: stateOrNull?.searchQuery ?? '',
        selectedOrderStatus: stateOrNull?.selectedOrderStatus,
        selectedPaymentStatus: stateOrNull?.selectedPaymentStatus,
        orders: stateOrNull?.orders ?? [],
        filteredOrders: stateOrNull?.filteredOrders ?? [],
      ),
      orElse: () => OrdersState(
        isLoading: ordersAsync.isLoading,
        searchQuery: stateOrNull?.searchQuery ?? '',
        selectedOrderStatus: stateOrNull?.selectedOrderStatus,
        selectedPaymentStatus: stateOrNull?.selectedPaymentStatus,
        orders: stateOrNull?.orders ?? [],
        filteredOrders: stateOrNull?.filteredOrders ?? [],
      ),
    );
  }

  void setSearchQuery(String query) {
    state = _applyFiltersInternal(state.copyWith(searchQuery: query));
  }

  void setPaymentStatusFilter(PaymentStatus? status) {
    final newStatus = state.selectedPaymentStatus == status ? null : status;
    state = _applyFiltersInternal(
      state.copyWith(selectedPaymentStatus: newStatus),
    );
  }

  void setOrderStatusFilter(OrderStatus? status) {
    final newStatus = state.selectedOrderStatus == status ? null : status;
    state = _applyFiltersInternal(
      state.copyWith(selectedOrderStatus: newStatus),
    );
  }

  OrdersState _applyFiltersInternal(OrdersState currentState) {
    var result = List<OrderModel>.from(currentState.orders);

    // 1. Order Status (Production)
    if (currentState.selectedOrderStatus != null) {
      result = result
          .where((o) => o.status == currentState.selectedOrderStatus)
          .toList();
    }

    // 2. Payment Status
    if (currentState.selectedPaymentStatus != null) {
      result = result
          .where((o) => o.paymentStatus == currentState.selectedPaymentStatus)
          .toList();
    }

    // 3. Search (Number only for professional speed)
    final query = currentState.searchQuery.toLowerCase().trim();
    if (query.isNotEmpty) {
      result = result
          .where((o) => o.orderNumber.toLowerCase().contains(query))
          .toList();
    }

    // Sort: Newest first
    result.sort((a, b) => b.orderDate.compareTo(a.orderDate));

    return currentState.copyWith(filteredOrders: result);
  }

  Future<void> refresh() async {
    ref.invalidate(ordersStreamProvider);
  }
}
