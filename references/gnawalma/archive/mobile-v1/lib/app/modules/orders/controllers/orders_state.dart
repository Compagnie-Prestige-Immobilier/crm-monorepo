import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../data/models/order_model.dart';

part 'orders_state.freezed.dart';

@freezed
abstract class OrdersState with _$OrdersState {
  const factory OrdersState({
    @Default([]) List<OrderModel> orders,
    @Default([]) List<OrderModel> filteredOrders,
    @Default('') String searchQuery,
    @Default(true) bool isLoading,

    /// Set when the underlying stream failed. Distinguishes "load failed"
    /// from "you have nothing yet" — rendering the second for the first tells
    /// a tailor their order book is empty.
    @Default(false) bool hasError,
    @Default(null) PaymentStatus? selectedPaymentStatus,
    @Default(null) OrderStatus? selectedOrderStatus,
    DateTime? startDate,
    DateTime? endDate,
    @Default('all') String filterStatus, // Keep for compatibility if needed
  }) = _OrdersState;
}
