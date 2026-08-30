import '../../data/models/order_model.dart';

/// Repository interface for Order operations
///
/// Handles order management including:
/// - CRUD operations
/// - Payment tracking
/// - Project associations
/// - Search and filtering
abstract class IOrderRepository {
  // ===== CRUD Operations =====

  /// Get all orders
  Future<List<OrderModel>> getAllOrders();

  /// Get an order by ID
  Future<OrderModel?> getOrderById(int id);

  /// Create a new order
  /// Returns the ID of the created order
  Future<int> createOrder(OrderModel order);

  /// Update an existing order
  Future<void> updateOrder(OrderModel order);

  /// Delete an order by ID
  Future<void> deleteOrder(int id);

  // ===== Order Number Generation =====

  /// Generate a unique order number
  /// Format: "ORD-YYYYMMDD-XXX" where XXX is a sequential number for that day
  Future<String> generateOrderNumber();

  // ===== Queries and Filters =====

  /// Get orders filtered by status
  Future<List<OrderModel>> getOrdersByStatus(OrderStatus status);

  /// Get all orders for a specific client
  Future<List<OrderModel>> getOrdersByClient(int clientId);

  /// Get orders filtered by payment status
  Future<List<OrderModel>> getOrdersByPaymentStatus(PaymentStatus status);

  /// Get overdue orders (past expectedDeliveryDate and not delivered/cancelled)
  Future<List<OrderModel>> getOverdueOrders();

  /// Get orders due soon (within next N days)
  Future<List<OrderModel>> getOrdersDueSoon({int days = 7});

  /// Get recent orders (limit: n)
  Future<List<OrderModel>> getRecentOrders({int limit = 10});

  /// Get only active orders for the dashboard queue
  Future<List<OrderModel>> getActiveDashboardOrders();

  /// Search orders by order number or client name
  Future<List<OrderModel>> searchOrders(String query);

  // ===== Payment Operations =====

  /// Record a payment for an order
  /// Automatically updates payment status based on total paid
  Future<void> recordPayment(int orderId, double amount);

  /// Update payment status manually
  Future<void> updatePaymentStatus(int orderId, PaymentStatus status);

  /// Get unpaid orders (payment status: UNPAID)
  Future<List<OrderModel>> getUnpaidOrders();

  /// Get partially paid orders (payment status: PARTIAL)
  Future<List<OrderModel>> getPartiallyPaidOrders();

  // ===== Project Association =====

  /// Add a project ID to an order
  Future<void> addProjectToOrder(int orderId, int projectId);

  /// Remove a project ID from an order
  Future<void> removeProjectFromOrder(int orderId, int projectId);

  /// Get all projects for an order
  Future<List<int>> getOrderProjects(int orderId);

  // ===== Status Updates =====

  /// Update an order's status
  Future<void> updateOrderStatus(int orderId, OrderStatus status);

  /// Mark an order as delivered
  /// Sets status to DELIVERED and actualDeliveryDate to now
  Future<void> markAsDelivered(int orderId);

  /// Cancel an order
  /// Sets status to CANCELLED
  Future<void> cancelOrder(int orderId);

  // ===== Statistics =====

  /// Get count of orders by status
  Future<Map<OrderStatus, int>> getOrderCountByStatus();

  /// Get count of orders by payment status
  Future<Map<PaymentStatus, int>> getOrderCountByPaymentStatus();

  /// Get total number of orders
  Future<int> getTotalOrderCount();

  /// Get total revenue (sum of all order totalAmounts)
  Future<double> getTotalRevenue();

  /// Get revenue for a specific date range
  Future<double> getRevenueForDateRange(DateTime start, DateTime end);

  /// Get monthly revenue for the current year
  Future<Map<int, double>> getMonthlyRevenue();

  /// Get total outstanding balance (sum of all remainingBalance)
  Future<double> getTotalOutstandingBalance();

  /// Get count of orders created in the week of the given date
  Future<int> getOrdersCountForWeek(DateTime date);

  // ===== Real-time Updates =====

  /// Watch for changes to all orders
  Stream<List<OrderModel>> watchOrders();

  /// Watch for changes to orders with a specific status
  Stream<List<OrderModel>> watchOrdersByStatus(OrderStatus status);

  /// Watch a specific order by ID
  Stream<OrderModel?> watchOrder(int id);

  /// Watch for changes to a client's orders
  Stream<List<OrderModel>> watchClientOrders(int clientId);
}
