import 'package:isar_plus/isar_plus.dart';
import 'package:intl/intl.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../domain/repositories/i_order_repository.dart';
import '../models/order_model.dart';
import '../services/database_service.dart';
import '../../shared/utils/app_logger.dart';
import 'base_isar_repository.dart';

part 'order_repository.g.dart';

@Riverpod(keepAlive: true)
Future<OrderRepository> orderRepository(Ref ref) async {
  final isar = await ref.watch(databaseProvider.future);
  return OrderRepository(isar);
}

/// Implementation of IOrderRepository using Isar
class OrderRepository extends BaseIsarRepository<OrderModel>
    implements IOrderRepository {
  OrderRepository(super.isar);

  @override
  IsarCollection<int, OrderModel> getCollection(Isar isar) => isar.orderModels;

  @override
  IsarCollection<int, OrderModel> get collection => isar.orderModels;

  IsarCollection<int, OrderModel> get _orders => isar.orderModels;

  @override
  Future<void> put(OrderModel item) async {
    final localIsar = isar;
    AppLogger.i('OrderRepository: Saving order "${item.orderNumber}"');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.orderModels.put(item);
      });
    } catch (e, stack) {
      AppLogger.e('OrderRepository: Error putting order', e, stack);
      rethrow;
    }
  }

  @override
  Future<void> putAll(List<OrderModel> items) async {
    final localIsar = isar;
    AppLogger.i('OrderRepository: Saving ${items.length} orders');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.orderModels.putAll(items);
      });
    } catch (e, stack) {
      AppLogger.e('OrderRepository: Error putting multiple orders', e, stack);
      rethrow;
    }
  }

  @override
  Future<void> delete(int id) async {
    final localIsar = isar;
    AppLogger.i('OrderRepository: Deleting order ID: $id');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.orderModels.delete(id);
      });
    } catch (e, stack) {
      AppLogger.e('OrderRepository: Error deleting order', e, stack);
      rethrow;
    }
  }

  @override
  Future<List<OrderModel>> getAllOrders() async =>
      _orders.where().isArchivedEqualTo(false).findAllAsync();

  @override
  Future<OrderModel?> getOrderById(int id) => getById(id);

  @override
  Future<int> createOrder(OrderModel order) async {
    AppLogger.i('OrderRepository: Creating order "${order.orderNumber}"');
    order.createdAt = DateTime.now();

    if (order.id == 0) {
      order.id = _orders.autoIncrement();
    }

    await put(order);
    return order.id;
  }

  @override
  Future<void> updateOrder(OrderModel order) async {
    AppLogger.i(
      'OrderRepository: Updating order "${order.orderNumber}" (ID: ${order.id})',
    );
    order.updatedAt = DateTime.now();
    order.calculateRemainingBalance();
    order.updatePaymentStatus();
    await put(order);
  }

  @override
  Future<void> deleteOrder(int id) async => delete(id);

  @override
  Future<String> generateOrderNumber() async {
    final now = DateTime.now();
    final datePrefix = DateFormat('yyyyMMdd').format(now);
    final startOfDay = DateTime(now.year, now.month, now.day);
    final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59);
    final todayOrderCount = await _orders
        .where()
        .createdAtBetween(startOfDay, endOfDay)
        .countAsync();
    final sequentialNumber = (todayOrderCount + 1).toString().padLeft(3, '0');
    return 'ORD-$datePrefix-$sequentialNumber';
  }

  @override
  Future<List<OrderModel>> getOrdersByStatus(OrderStatus status) async =>
      _orders
          .where()
          .statusEqualTo(status)
          .and()
          .isArchivedEqualTo(false)
          .findAllAsync();
  @override
  Future<List<OrderModel>> getOrdersByClient(int clientId) async => _orders
      .where()
      .clientIdEqualTo(clientId)
      .and()
      .isArchivedEqualTo(false)
      .findAllAsync();
  @override
  Future<List<OrderModel>> getOrdersByPaymentStatus(
    PaymentStatus status,
  ) async => _orders
      .where()
      .paymentStatusEqualTo(status)
      .and()
      .isArchivedEqualTo(false)
      .findAllAsync();

  @override
  Future<List<OrderModel>> getOverdueOrders() async {
    final now = DateTime.now();
    return _orders
        .where()
        .group(
          (q) => q
              .statusEqualTo(OrderStatus.pending)
              .or()
              .statusEqualTo(OrderStatus.inProgress)
              .or()
              .statusEqualTo(OrderStatus.completed),
        )
        .and()
        .isArchivedEqualTo(false)
        .and()
        .expectedDeliveryDateIsNotNull()
        .and()
        .expectedDeliveryDateLessThan(now)
        .findAllAsync();
  }

  @override
  Future<List<OrderModel>> getOrdersDueSoon({int days = 7}) async {
    final now = DateTime.now();
    final futureDate = now.add(Duration(days: days));
    return _orders
        .where()
        .group(
          (q) => q
              .statusEqualTo(OrderStatus.pending)
              .or()
              .statusEqualTo(OrderStatus.inProgress)
              .or()
              .statusEqualTo(OrderStatus.completed),
        )
        .and()
        .isArchivedEqualTo(false)
        .and()
        .expectedDeliveryDateIsNotNull()
        .and()
        .expectedDeliveryDateBetween(now, futureDate)
        .findAllAsync();
  }

  @override
  Future<List<OrderModel>> getRecentOrders({int limit = 10}) async => _orders
      .where()
      .isArchivedEqualTo(false)
      .sortByCreatedAtDesc()
      .findAllAsync(limit: limit);

  @override
  Future<List<OrderModel>> getActiveDashboardOrders() async {
    return _orders
        .where()
        .isArchivedEqualTo(false)
        .group(
          (q) => q
              .statusEqualTo(OrderStatus.pending)
              .or()
              .statusEqualTo(OrderStatus.inProgress)
              .or()
              .statusEqualTo(OrderStatus.completed)
              .or()
              .group(
                (q2) => q2
                    .statusEqualTo(OrderStatus.delivered)
                    .and()
                    .paymentStatusLessThan(PaymentStatus.paid),
              ),
        )
        .findAllAsync();
  }

  @override
  Future<List<OrderModel>> searchOrders(String query) async => _orders
      .where()
      .isArchivedEqualTo(false)
      .and()
      .orderNumberContains(query, caseSensitive: false)
      .findAllAsync();

  @override
  Future<void> recordPayment(int orderId, double amount) async {
    final order = await getOrderById(orderId);
    if (order == null) throw Exception('Order not found');
    order.recordPayment(amount);
    await updateOrder(order);
  }

  @override
  Future<void> updatePaymentStatus(int orderId, PaymentStatus status) async {
    final order = await getOrderById(orderId);
    if (order == null) throw Exception('Order not found');
    order.paymentStatus = status;
    await updateOrder(order);
  }

  @override
  Future<List<OrderModel>> getUnpaidOrders() async =>
      getOrdersByPaymentStatus(PaymentStatus.unpaid);
  @override
  Future<List<OrderModel>> getPartiallyPaidOrders() async =>
      getOrdersByPaymentStatus(PaymentStatus.partial);

  @override
  Future<void> addProjectToOrder(int orderId, int projectId) async {
    final order = await getOrderById(orderId);
    if (order == null) throw Exception('Order not found');
    if (!order.projectIds.contains(projectId)) {
      order.projectIds.add(projectId);
      await updateOrder(order);
    }
  }

  @override
  Future<void> removeProjectFromOrder(int orderId, int projectId) async {
    final order = await getOrderById(orderId);
    if (order == null) throw Exception('Order not found');
    order.projectIds.remove(projectId);
    await updateOrder(order);
  }

  @override
  Future<List<int>> getOrderProjects(int orderId) async {
    final order = await getOrderById(orderId);
    return order?.projectIds ?? [];
  }

  @override
  Future<void> updateOrderStatus(int orderId, OrderStatus status) async {
    final order = await getOrderById(orderId);
    if (order == null) throw Exception('Order not found');
    order.status = status;
    await updateOrder(order);
  }

  @override
  Future<void> markAsDelivered(int orderId) async {
    final order = await getOrderById(orderId);
    if (order == null) throw Exception('Order not found');
    order.status = OrderStatus.delivered;
    order.actualDeliveryDate = DateTime.now();
    await updateOrder(order);
  }

  @override
  Future<void> cancelOrder(int orderId) async {
    final order = await getOrderById(orderId);
    if (order == null) throw Exception('Order not found');
    order.status = OrderStatus.cancelled;
    await updateOrder(order);
  }

  /// Automatically archives orders delivered more than 30 days ago
  Future<int> archiveOldOrders() async {
    final thirtyDaysAgo = DateTime.now().subtract(const Duration(days: 30));

    final toArchive = await _orders
        .where()
        .statusEqualTo(OrderStatus.delivered)
        .and()
        .isArchivedEqualTo(false)
        .and()
        .actualDeliveryDateLessThan(thirtyDaysAgo)
        .findAllAsync();

    if (toArchive.isEmpty) return 0;

    for (var order in toArchive) {
      order.isArchived = true;
      await updateOrder(order);
    }

    return toArchive.length;
  }

  @override
  Future<Map<OrderStatus, int>> getOrderCountByStatus() async {
    final map = <OrderStatus, int>{};
    for (final status in OrderStatus.values) {
      map[status] = await _orders
          .where()
          .statusEqualTo(status)
          .and()
          .isArchivedEqualTo(false)
          .countAsync();
    }
    return map;
  }

  @override
  Future<Map<PaymentStatus, int>> getOrderCountByPaymentStatus() async {
    final map = <PaymentStatus, int>{};
    for (final status in PaymentStatus.values) {
      map[status] = await _orders
          .where()
          .paymentStatusEqualTo(status)
          .and()
          .isArchivedEqualTo(false)
          .countAsync();
    }
    return map;
  }

  @override
  Future<int> getTotalOrderCount() async =>
      _orders.where().isArchivedEqualTo(false).countAsync();
  @override
  Future<double> getTotalRevenue() async {
    final orders = await getAllOrders();
    return orders.fold<double>(0.0, (sum, order) => sum + order.totalAmount);
  }

  @override
  Future<double> getRevenueForDateRange(DateTime start, DateTime end) async {
    final orders = await _orders
        .where()
        .orderDateBetween(start, end)
        .and()
        .isArchivedEqualTo(false)
        .findAllAsync();
    return orders.fold<double>(0.0, (sum, order) => sum + order.totalAmount);
  }

  @override
  Future<Map<int, double>> getMonthlyRevenue() async {
    final now = DateTime.now();
    final map = <int, double>{};
    for (int month = 1; month <= 12; month++) {
      map[month] = 0.0;
    }
    final orders = await _orders
        .where()
        .isArchivedEqualTo(false)
        .and()
        .orderDateBetween(
          DateTime(now.year, 1, 1),
          DateTime(now.year, 12, 31, 23, 59, 59),
        )
        .findAllAsync();
    for (final order in orders) {
      map[order.orderDate.month] =
          (map[order.orderDate.month] ?? 0.0) + order.totalAmount;
    }
    return map;
  }

  @override
  Future<double> getTotalOutstandingBalance() async {
    final orders = await _orders
        .where()
        .isArchivedEqualTo(false)
        .group(
          (q) => q
              .paymentStatusEqualTo(PaymentStatus.unpaid)
              .or()
              .paymentStatusEqualTo(PaymentStatus.partial),
        )
        .findAllAsync();
    return orders.fold<double>(
      0.0,
      (sum, order) => sum + order.remainingBalance,
    );
  }

  @override
  Future<int> getOrdersCountForWeek(DateTime date) async {
    final start = DateTime(
      date.year,
      date.month,
      date.day,
    ).subtract(Duration(days: date.weekday - 1));
    final end = start.add(
      const Duration(days: 6, hours: 23, minutes: 59, seconds: 59),
    );
    return _orders
        .where()
        .isArchivedEqualTo(false)
        .and()
        .createdAtBetween(start, end)
        .and()
        .group(
          (q) => q
              .statusEqualTo(OrderStatus.pending)
              .or()
              .statusEqualTo(OrderStatus.inProgress)
              .or()
              .statusEqualTo(OrderStatus.completed),
        )
        .countAsync();
  }

  @override
  Stream<List<OrderModel>> watchOrders() => watch(fireImmediately: true);
  @override
  Stream<List<OrderModel>> watchOrdersByStatus(OrderStatus status) => _orders
      .where()
      .statusEqualTo(status)
      .and()
      .isArchivedEqualTo(false)
      .watch(fireImmediately: true);
  @override
  Stream<OrderModel?> watchOrder(int id) =>
      _orders.watchObject(id, fireImmediately: true);
  @override
  Stream<List<OrderModel>> watchClientOrders(int clientId) => _orders
      .where()
      .clientIdEqualTo(clientId)
      .and()
      .isArchivedEqualTo(false)
      .watch(fireImmediately: true);
}
