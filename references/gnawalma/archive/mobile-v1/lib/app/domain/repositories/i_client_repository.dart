import '../../data/models/client_model.dart';

/// Repository interface for Client operations
///
/// Handles client management including:
/// - CRUD operations
/// - Measurements tracking
/// - Search and filtering
/// - Statistics
abstract class IClientRepository {
  // ===== CRUD Operations =====

  /// Get all clients
  Future<List<ClientModel>> getAllClients();

  /// Get a client by ID
  Future<ClientModel?> getClientById(int id);

  /// Create a new client
  /// Returns the ID of the created client
  Future<int> createClient(ClientModel client);

  /// Update an existing client
  Future<void> updateClient(ClientModel client);

  /// Delete a client by ID
  Future<void> deleteClient(int id);

  // ===== Search and Filtering =====

  /// Search clients by name, phone, or email
  Future<List<ClientModel>> searchClients(String query);

  /// Find a client by phone number (normalized comparison)
  /// Returns the client if found, null otherwise
  Future<ClientModel?> findClientByPhone(String phone);

  /// Get clients sorted alphabetically by full name
  Future<List<ClientModel>> getClientsSortedByName();

  /// Get clients sorted by last order date (most recent first)
  Future<List<ClientModel>> getClientsSortedByLastOrder();

  /// Get clients sorted by total spent (highest first)
  Future<List<ClientModel>> getClientsSortedBySpending();

  /// Get active clients (ordered recently)
  Future<List<ClientModel>> getActiveClients({int daysThreshold = 90});

  /// Get top clients by total spending
  Future<List<ClientModel>> getTopClients({int limit = 10});

  // ===== Measurements =====

  /// Add a measurement record to a client
  Future<void> addMeasurement(int clientId, MeasurementRecord measurement);

  /// Get all measurement records for a client
  Future<List<MeasurementRecord>> getMeasurements(int clientId);

  /// Get the latest measurement record for a client
  Future<MeasurementRecord?> getLatestMeasurement(int clientId);

  /// Delete a measurement record
  /// (Requires knowing the client and the measurement date)
  Future<void> deleteMeasurement(int clientId, DateTime measurementDate);

  // ===== Order Association =====

  /// Add an order ID to a client's order history
  Future<void> addOrderToClient(int clientId, int orderId);

  /// Remove an order ID from a client's order history
  Future<void> removeOrderFromClient(int clientId, int orderId);

  /// Update client statistics (total orders, total spent)
  Future<void> updateClientStatistics(
    int clientId, {
    int? totalOrders,
    double? totalSpent,
    DateTime? lastOrderDate,
  });

  // ===== Statistics =====

  /// Get total number of clients
  Future<int> getTotalClientCount();

  /// Get count of active clients
  Future<int> getActiveClientCount({int daysThreshold = 90});

  /// Get total revenue from all clients
  Future<double> getTotalRevenue();

  /// Get average spending per client
  Future<double> getAverageSpendingPerClient();

  // ===== Real-time Updates =====

  /// Watch for changes to all clients
  Stream<List<ClientModel>> watchClients();

  /// Watch a specific client by ID
  Stream<ClientModel?> watchClient(int id);

  /// Watch for changes to top clients
  Stream<List<ClientModel>> watchTopClients({int limit = 10});
}
