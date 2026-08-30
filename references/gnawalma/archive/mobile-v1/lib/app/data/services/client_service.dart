import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../domain/repositories/i_client_repository.dart';
import '../../domain/repositories/i_order_repository.dart';
import '../models/client_model.dart';
import '../repositories/client_repository.dart';
import '../repositories/order_repository.dart';
import 'order_service.dart';
import '../../core/errors/exceptions.dart';

part 'client_service.g.dart';

@Riverpod(keepAlive: true)
Future<ClientService> clientService(Ref ref) async {
  final repository = await ref.watch(clientRepositoryProvider.future);
  final orderRepo = await ref.watch(orderRepositoryProvider.future);
  final orderService = await ref.watch(orderServiceProvider.future);
  return ClientService(repository, orderRepo, orderService);
}

/// Service for client-related business logic and orchestration.
class ClientService {
  final IClientRepository _repository;
  final IOrderRepository _orderRepo;
  final OrderService _orderService;

  ClientService(this._repository, this._orderRepo, this._orderService);

  /// Adds a new measurement record to a client
  Future<void> addMeasurement(
    int clientId,
    MeasurementRecord measurement,
  ) async {
    final client = await _repository.getClientById(clientId);
    if (client == null) throw ClientNotFoundException();

    client.addMeasurement(measurement);
    await _repository.updateClient(client);
  }

  /// Deletes a measurement record from a client based on date
  Future<void> deleteMeasurement(int clientId, DateTime measurementDate) async {
    final client = await _repository.getClientById(clientId);
    if (client == null) throw ClientNotFoundException();

    client.measurements.removeWhere(
      (m) =>
          m.recordedDate.year == measurementDate.year &&
          m.recordedDate.month == measurementDate.month &&
          m.recordedDate.day == measurementDate.day,
    );

    await _repository.updateClient(client);
  }

  /// Updates client statistics (total orders, spent, etc.)
  Future<void> updateStatistics(
    int clientId, {
    int? totalOrders,
    double? totalSpent,
    DateTime? lastOrderDate,
  }) async {
    final client = await _repository.getClientById(clientId);
    if (client == null) throw ClientNotFoundException();

    if (totalOrders != null) client.totalOrders = totalOrders;
    if (totalSpent != null) client.totalSpent = totalSpent;
    if (lastOrderDate != null) client.lastOrderDate = lastOrderDate;

    await _repository.updateClient(client);
  }

  /// Associates an order with a client
  Future<void> addOrder(int clientId, int orderId) async {
    final client = await _repository.getClientById(clientId);
    if (client == null) throw ClientNotFoundException();

    if (!client.orderIds.contains(orderId)) {
      client.orderIds.add(orderId);
      await _repository.updateClient(client);
    }
  }

  /// Removes an order association from a client
  Future<void> removeOrder(int clientId, int orderId) async {
    final client = await _repository.getClientById(clientId);
    if (client == null) throw ClientNotFoundException();

    client.orderIds.remove(orderId);
    await _repository.updateClient(client);
  }

  /// Deletes a client and all their associated orders and projects
  Future<void> deleteClient(int clientId) async {
    // 1. Get all orders for this client
    final orders = await _orderRepo.getOrdersByClient(clientId);

    // 2. Use OrderService to delete each order (cascading projects and stock)
    for (var order in orders) {
      await _orderService.deleteOrder(order.id);
    }

    // 3. Delete the client record
    await _repository.deleteClient(clientId);
  }

  /// Search clients by name or phone
  Future<List<ClientModel>> searchClients(String query) async {
    final allClients = await getAllClients();
    final lowerQuery = query.toLowerCase();
    return allClients.where((client) {
      return client.displayName.toLowerCase().contains(lowerQuery) ||
          (client.phone?.contains(lowerQuery) ?? false);
    }).toList();
  }

  // Delegation methods
  Future<ClientModel?> getClientById(int id) => _repository.getClientById(id);
  Future<List<ClientModel>> getAllClients() => _repository.getAllClients();
  Stream<List<ClientModel>> watchClients() => _repository.watchClients();
  Future<void> deleteClientRecord(int id) => _repository.deleteClient(id);
}
