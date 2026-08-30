import 'package:isar_plus/isar_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../domain/repositories/i_client_repository.dart';
import '../models/client_model.dart';
import '../services/database_service.dart';
import '../../shared/utils/app_logger.dart';
import 'base_isar_repository.dart';

part 'client_repository.g.dart';

@Riverpod(keepAlive: true)
Future<ClientRepository> clientRepository(Ref ref) async {
  final isar = await ref.watch(databaseProvider.future);
  return ClientRepository(isar);
}

/// Implementation of IClientRepository using Isar
class ClientRepository extends BaseIsarRepository<ClientModel>
    implements IClientRepository {
  ClientRepository(super.isar);

  @override
  IsarCollection<int, ClientModel> getCollection(Isar isar) =>
      isar.clientModels;

  @override
  IsarCollection<int, ClientModel> get collection => isar.clientModels;

  IsarCollection<int, ClientModel> get _clients => isar.clientModels;

  @override
  Future<List<ClientModel>> getAllClients() => getAll();

  @override
  Future<ClientModel?> getClientById(int id) => getById(id);

  @override
  Future<void> put(ClientModel item) async {
    final localIsar = isar;
    AppLogger.i('ClientRepository: Saving client "${item.displayName}"');
    try {
      item.updateFullName(); // INDEX GUARD: Always refresh before storage
      await localIsar.writeAsync((isarInstance) {
        isarInstance.clientModels.put(item);
      });
    } catch (e, stack) {
      AppLogger.e('ClientRepository: Error putting client', e, stack);
      rethrow;
    }
  }

  @override
  Future<void> putAll(List<ClientModel> items) async {
    final localIsar = isar;
    AppLogger.i('ClientRepository: Saving ${items.length} clients');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.clientModels.putAll(items);
      });
    } catch (e, stack) {
      AppLogger.e('ClientRepository: Error putting multiple clients', e, stack);
      rethrow;
    }
  }

  @override
  Future<void> delete(int id) async {
    final localIsar = isar;
    AppLogger.i('ClientRepository: Deleting client ID: $id');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.clientModels.delete(id);
      });
    } catch (e, stack) {
      AppLogger.e('ClientRepository: Error deleting client', e, stack);
      rethrow;
    }
  }

  @override
  Future<int> createClient(ClientModel client) async {
    AppLogger.i('ClientRepository: Creating client "${client.fullName}"');
    client.createdAt = DateTime.now();
    client.updateFullName();

    if (client.id == 0) {
      client.id = _clients.autoIncrement();
    }

    await put(client);
    return client.id;
  }

  @override
  Future<void> updateClient(ClientModel client) async {
    AppLogger.i(
      'ClientRepository: Updating client "${client.fullName}" (ID: ${client.id})',
    );
    client.updateFullName();
    await put(client);
  }

  @override
  Future<void> deleteClient(int id) async {
    await delete(id);
  }

  @override
  Future<List<ClientModel>> searchClients(String query) async {
    if (query.isEmpty) return _clients.where().findAllAsync();
    final lowercaseQuery = query.toLowerCase();
    return _clients
        .where()
        .fullNameContains(lowercaseQuery, caseSensitive: false)
        .or()
        .firstNameContains(lowercaseQuery, caseSensitive: false)
        .or()
        .lastNameContains(lowercaseQuery, caseSensitive: false)
        .or()
        .phoneContains(query, caseSensitive: false)
        .or()
        .emailContains(lowercaseQuery, caseSensitive: false)
        .findAllAsync();
  }

  @override
  Future<ClientModel?> findClientByPhone(String phone) async {
    if (phone.isEmpty) return null;
    // Normalize phone number for comparison (remove spaces, dashes, etc.)
    final normalizedPhone = phone.replaceAll(RegExp(r'[\s\-\(\)]'), '');
    final clients = await _clients.where().findAllAsync();
    try {
      return clients.firstWhere(
        (c) =>
            c.phone != null &&
            c.phone!.replaceAll(RegExp(r'[\s\-\(\)]'), '') == normalizedPhone,
      );
    } catch (e) {
      return null;
    }
  }

  @override
  Future<List<ClientModel>> getClientsSortedByName() async =>
      _clients.where().sortByFullName().findAllAsync();
  @override
  Future<List<ClientModel>> getClientsSortedByLastOrder() async =>
      _clients.where().sortByLastOrderDateDesc().findAllAsync();
  @override
  Future<List<ClientModel>> getClientsSortedBySpending() async =>
      _clients.where().sortByTotalSpentDesc().findAllAsync();

  @override
  Future<List<ClientModel>> getActiveClients({int daysThreshold = 90}) async {
    final cutoffDate = DateTime.now().subtract(Duration(days: daysThreshold));
    return _clients
        .where()
        .lastOrderDateIsNotNull()
        .and()
        .lastOrderDateGreaterThan(cutoffDate)
        .findAllAsync();
  }

  @override
  Future<List<ClientModel>> getTopClients({int limit = 10}) async =>
      _clients.where().sortByTotalSpentDesc().findAllAsync(limit: limit);

  @override
  Future<void> addMeasurement(
    int clientId,
    MeasurementRecord measurement,
  ) async {
    final client = await getClientById(clientId);
    if (client == null) throw Exception('Client not found');
    client.addMeasurement(measurement);
    await updateClient(client);
  }

  @override
  Future<List<MeasurementRecord>> getMeasurements(int clientId) async {
    final client = await getClientById(clientId);
    return client?.measurements ?? [];
  }

  @override
  Future<MeasurementRecord?> getLatestMeasurement(int clientId) async {
    final client = await getClientById(clientId);
    return client?.latestMeasurement;
  }

  @override
  Future<void> deleteMeasurement(int clientId, DateTime measurementDate) async {
    final client = await getClientById(clientId);
    if (client == null) throw Exception('Client not found');
    client.measurements.removeWhere(
      (m) => m.recordedDate.isAtSameMomentAs(measurementDate),
    );
    await updateClient(client);
  }

  @override
  Future<void> addOrderToClient(int clientId, int orderId) async {
    final client = await getClientById(clientId);
    if (client == null) throw Exception('Client not found');
    if (!client.orderIds.contains(orderId)) {
      client.orderIds.add(orderId);
      await updateClient(client);
    }
  }

  @override
  Future<void> removeOrderFromClient(int clientId, int orderId) async {
    final client = await getClientById(clientId);
    if (client == null) throw Exception('Client not found');
    client.orderIds.remove(orderId);
    await updateClient(client);
  }

  @override
  Future<void> updateClientStatistics(
    int clientId, {
    int? totalOrders,
    double? totalSpent,
    DateTime? lastOrderDate,
  }) async {
    final client = await getClientById(clientId);
    if (client == null) throw Exception('Client not found');
    if (totalOrders != null) client.totalOrders = totalOrders;
    if (totalSpent != null) client.totalSpent = totalSpent;
    if (lastOrderDate != null) client.lastOrderDate = lastOrderDate;
    await updateClient(client);
  }

  @override
  Future<int> getTotalClientCount() async => _clients.count();
  @override
  Future<int> getActiveClientCount({int daysThreshold = 90}) async {
    final cutoffDate = DateTime.now().subtract(Duration(days: daysThreshold));
    return _clients
        .where()
        .lastOrderDateIsNotNull()
        .and()
        .lastOrderDateGreaterThan(cutoffDate)
        .countAsync();
  }

  @override
  Future<double> getTotalRevenue() async {
    final clients = await getAllClients();
    return clients.fold<double>(0.0, (sum, client) => sum + client.totalSpent);
  }

  @override
  Future<double> getAverageSpendingPerClient() async {
    final totalRevenue = await getTotalRevenue();
    final totalClients = await getTotalClientCount();
    return totalClients == 0 ? 0.0 : totalRevenue / totalClients;
  }

  @override
  Stream<List<ClientModel>> watchClients() => watch(fireImmediately: true);
  @override
  Stream<ClientModel?> watchClient(int id) =>
      _clients.watchObject(id, fireImmediately: true);
  @override
  Stream<List<ClientModel>> watchTopClients({int limit = 10}) => _clients
      .where()
      .sortByTotalSpentDesc()
      .watch(fireImmediately: true, limit: limit);
}
