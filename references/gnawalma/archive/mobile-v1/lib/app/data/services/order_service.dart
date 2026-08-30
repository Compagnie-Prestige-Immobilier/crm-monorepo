import 'dart:convert';
import 'package:isar_plus/isar_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../shared/utils/app_logger.dart';
import '../../domain/repositories/i_order_repository.dart';
import '../../domain/repositories/i_client_repository.dart';
import '../../domain/repositories/i_project_repository.dart';
import '../models/order_model.dart';
import '../models/project_model.dart';
import '../models/client_model.dart';
import '../models/beneficiary_model.dart';
import 'project_service.dart';
import '../repositories/order_repository.dart';
import '../repositories/client_repository.dart';
import '../repositories/project_repository.dart';
import 'database_service.dart';
import '../models/order_status_mapping.dart';

part 'order_service.g.dart';

@Riverpod(keepAlive: true)
Future<OrderService> orderService(Ref ref) async {
  final orderRepo = await ref.watch(orderRepositoryProvider.future);
  final clientRepo = await ref.watch(clientRepositoryProvider.future);
  final projectRepo = await ref.watch(projectRepositoryProvider.future);
  final projectService = await ref.watch(projectServiceProvider.future);
  final isar = await ref.watch(databaseProvider.future);
  return OrderService(orderRepo, clientRepo, projectRepo, projectService, isar);
}

/// Service responsible for Order business logic and orchestration.
///
/// Handles order creation, payment recording, and synchronizing client statistics.
class OrderService {
  final IOrderRepository _orderRepo;
  final IClientRepository _clientRepo;
  final IProjectRepository _projectRepo;
  final ProjectService _projectService;
  final Isar _isar;

  OrderService(
    this._orderRepo,
    this._clientRepo,
    this._projectRepo,
    this._projectService,
    this._isar,
  );

  /// Creates a new order and all its articles atomically
  Future<int> createOrderWithArticles(
    OrderModel order,
    List<ProjectModel> articles,
  ) async {
    // 1. Generate order number
    if (order.orderNumber.isEmpty) {
      order.orderNumber = await _orderRepo.generateOrderNumber();
    }

    return await _isar.writeAsync((isar) {
      final projectIds = <int>[];

      // Create projects
      for (var project in articles) {
        project.expectedDeliveryDate = order.expectedDeliveryDate;
        project.createdAt = DateTime.now();
        project.calculateProgress();

        if (project.id == 0) {
          project.id = isar.projectModels.autoIncrement();
        }

        isar.projectModels.put(project);
        projectIds.add(project.id);

        // --- PERSIST MEASUREMENTS TO CLIENT/BENEFICIARY ---
        if (project.measurementsSnapshot != null &&
            project.measurementsSnapshot!.isNotEmpty) {
          try {
            final decoded = jsonDecode(project.measurementsSnapshot!);
            if (decoded is Map) {
              final mMap = Map<String, double>.from(
                decoded.map(
                  (k, v) => MapEntry(k.toString(), (v as num).toDouble()),
                ),
              );

              if (mMap.isNotEmpty) {
                AppLogger.i(
                  'OrderService: Persisting measurements for project "${project.name}"',
                );
                if (project.beneficiaryId != null) {
                  final beneficiary = isar.beneficiaryModels.get(
                    project.beneficiaryId!,
                  );
                  if (beneficiary != null) {
                    beneficiary.setMeasurementsFromMap(mMap);
                    isar.beneficiaryModels.put(beneficiary);
                    AppLogger.i(
                      'OrderService: Updated beneficiary ID: ${beneficiary.id}',
                    );
                  }
                } else if (project.clientId != null) {
                  final client = isar.clientModels.get(project.clientId!);
                  if (client != null) {
                    client.addMeasurement(MeasurementRecord.fromMap(mMap));
                    isar.clientModels.put(client);
                    AppLogger.i(
                      'OrderService: Added measurement to client ID: ${client.id}',
                    );
                  }
                }
              }
            }
          } catch (e) {
            AppLogger.e('OrderService: Error persisting measurements', e);
          }
        }
      }

      order.projectIds = projectIds;
      order.calculateRemainingBalance();
      order.updatePaymentStatus();

      if (order.depositPaid > 0) {
        order.paymentHistory.add(
          PaymentRecord()
            ..amount = order.depositPaid
            ..paymentDate = DateTime.now()
            ..paymentMethod = 'Acompte'
            ..notes = 'Dépôt initial',
        );
      }

      if (order.id == 0) {
        order.id = isar.orderModels.autoIncrement();
      }
      isar.orderModels.put(order);

      // Update projects with orderId back-reference
      for (var pid in projectIds) {
        final p = isar.projectModels.get(pid);
        if (p != null) {
          p.orderId = order.id;
          isar.projectModels.put(p);
        }
      }

      return order.id;
    });
  }

  /// Synchronizes the status of an order based on the statuses of its projects.
  /// If all projects are delivered, order is marked as delivered.
  /// If all projects are completed (or better), order is marked as completed.
  Future<void> syncOrderStatusFromProject(int projectId) async {
    final project = await _projectRepo.getProjectById(projectId);
    if (project == null || project.orderId == null) return;

    final parentOrder = await _orderRepo.getOrderById(project.orderId!);
    if (parentOrder == null) return;

    // Skip if order is already cancelled
    if (parentOrder.status == OrderStatus.cancelled) return;

    bool allCompleted = true;
    bool allDelivered = true;

    for (final pid in parentOrder.projectIds) {
      final p = await _projectRepo.getProjectById(pid);
      if (p != null) {
        // Check if all are at least completed
        if (p.status != ProjectStatus.completed &&
            p.status != ProjectStatus.delivered) {
          allCompleted = false;
          allDelivered = false;
          break;
        }
        // Check if all are delivered
        if (p.status != ProjectStatus.delivered) {
          allDelivered = false;
        }
      }
    }

    // Update order status based on project statuses
    if (allDelivered && parentOrder.status != OrderStatus.delivered) {
      // FINANCIAL GUARD: Only auto-mark as delivered if fully paid
      if (parentOrder.remainingBalance <= 0) {
        await _orderRepo.markAsDelivered(parentOrder.id);
      } else {
        // Just mark as completed, wait for manual delivery/payment override
        await _orderRepo.updateOrderStatus(
          parentOrder.id,
          OrderStatus.completed,
        );
      }
    } else if (allCompleted &&
        parentOrder.status != OrderStatus.completed &&
        parentOrder.status != OrderStatus.delivered) {
      // All projects at least completed -> mark order as completed
      await _orderRepo.updateOrderStatus(parentOrder.id, OrderStatus.completed);
    }
  }

  /// Updates the status of an order and all its associated projects.
  ///
  /// Throws [StateError] when the move is not one the server would accept.
  /// Nothing was enforced here, while the API answers 409 on an illegal
  /// transition — so an order could be walked from delivered back to pending
  /// on the device and only be rejected at sync time, after the atelier had
  /// already acted on the state it could see.
  Future<void> updateOrderAndProjectsStatus(
    int orderId,
    OrderStatus newStatus,
  ) async {
    final order = await _orderRepo.getOrderById(orderId);
    if (order == null) return;

    if (order.status == newStatus) return;
    if (!order.status.canMoveTo(newStatus)) {
      throw StateError(
        'Transition refusée : ${order.status.label} vers ${newStatus.label}.',
      );
    }

    // 1. Map OrderStatus to ProjectStatus
    ProjectStatus projectStatus;
    switch (newStatus) {
      case OrderStatus.pending:
        projectStatus = ProjectStatus.todo;
        break;
      case OrderStatus.inProgress:
        projectStatus = ProjectStatus.inProgress;
        break;
      case OrderStatus.completed:
        projectStatus = ProjectStatus.completed;
        break;
      case OrderStatus.delivered:
        projectStatus = ProjectStatus.delivered;
        break;
      default:
        projectStatus = ProjectStatus.todo;
    }

    // 2. Update all projects
    for (var projectId in order.projectIds) {
      await _projectRepo.updateProjectStatus(projectId, projectStatus);
    }

    // 3. Update the order status
    if (newStatus == OrderStatus.delivered) {
      await _orderRepo.markAsDelivered(orderId);
    } else {
      await _orderRepo.updateOrderStatus(orderId, newStatus);
    }
  }

  /// Creates a new order with business logic orchestration
  Future<int> createOrder(OrderModel order) async {
    // 1. Generate order number if not set
    if (order.orderNumber.isEmpty) {
      order.orderNumber = await _orderRepo.generateOrderNumber();
    }

    // 2. Initialize payment history if there is a deposit
    if (order.depositPaid > 0 && order.paymentHistory.isEmpty) {
      order.paymentHistory.add(
        PaymentRecord()
          ..amount = order.depositPaid
          ..paymentDate = DateTime.now()
          ..paymentMethod = 'Acompte'
          ..notes = 'Dépôt initial',
      );
    }

    // 3. Ensure calculations are up to date
    order.calculateRemainingBalance();
    order.updatePaymentStatus();

    // 4. Save to repository
    final id = await _orderRepo.createOrder(order);

    // 5. Sync deposit with projects
    if (order.depositPaid > 0) {
      await _distributePaymentToProjects(order, order.depositPaid);
    }

    // 6. Update client statistics
    if (order.clientId != null) {
      await _updateClientStats(order.clientId!, newOrder: true);
    }

    return id;
  }

  /// Records a new payment for an order and updates client statistics
  Future<void> recordPayment(
    int orderId,
    double amount, {
    int? targetProjectId,
    String? method,
    String? notes,
  }) async {
    final order = await _orderRepo.getOrderById(orderId);
    if (order == null) throw Exception('Order not found');

    // recordPayment on model/repo adds to history
    // If we have custom method/notes, we might need a more flexible repo method or manual update
    if (method != null || notes != null) {
      order.depositPaid += amount;
      order.paymentHistory.add(
        PaymentRecord()
          ..amount = amount
          ..paymentDate = DateTime.now()
          ..paymentMethod = method ?? 'Espèces'
          ..notes = notes
          ..projectId = targetProjectId,
      );
      order.calculateRemainingBalance();
      order.updatePaymentStatus();
      await _orderRepo.updateOrder(order);
    } else {
      // Record payment via repo then update with projectId if needed
      await _orderRepo.recordPayment(orderId, amount);
      final updatedOrder = await _orderRepo.getOrderById(orderId);
      if (updatedOrder != null && targetProjectId != null) {
        if (updatedOrder.paymentHistory.isNotEmpty) {
          updatedOrder.paymentHistory.last.projectId = targetProjectId;
          await _orderRepo.updateOrder(updatedOrder);
        }
      }
    }

    // Sync with projects ONLY if the payment wasn't already recorded on a specific project
    if (targetProjectId == null) {
      await _distributePaymentToProjects(order, amount);
    }

    if (order.clientId != null) {
      await _updateClientStats(order.clientId!, paymentAmount: amount);
    }

    // Always sync order status after a payment
    if (targetProjectId != null) {
      await syncOrderStatusFromProject(targetProjectId);
    } else if (order.projectIds.isNotEmpty) {
      await syncOrderStatusFromProject(order.projectIds.first);
    }
  }

  /// Distributes a payment amount among projects linked to an order
  Future<void> _distributePaymentToProjects(
    OrderModel order,
    double amount,
  ) async {
    if (amount <= 0 || order.projectIds.isEmpty) return;

    final projects = <ProjectModel>[];
    for (final pid in order.projectIds) {
      final p = await _projectRepo.getProjectById(pid);
      if (p != null) projects.add(p);
    }

    if (projects.isEmpty) return;

    // Filter projects that still have a balance
    final unpaidProjects = projects
        .where((p) => p.remainingAmount > 0)
        .toList();
    if (unpaidProjects.isEmpty) return;

    double remainingToDistribute = amount;
    double totalRemaining = unpaidProjects.fold(
      0,
      (sum, p) => sum + p.remainingAmount,
    );

    for (int i = 0; i < unpaidProjects.length; i++) {
      final p = unpaidProjects[i];
      double share;

      if (i == unpaidProjects.length - 1) {
        // Last one gets the rest to avoid rounding issues
        share = remainingToDistribute;
      } else {
        // Proportional share
        if (totalRemaining > 0) {
          share = amount * (p.remainingAmount / totalRemaining);
        } else {
          share = remainingToDistribute / unpaidProjects.length;
        }

        // Cap it at remaining amount to avoid overpaying
        if (share > p.remainingAmount) share = p.remainingAmount;
      }

      p.advancePayment = (p.advancePayment ?? 0) + share;
      await _projectRepo.updateProject(p);

      remainingToDistribute -= share;
      if (remainingToDistribute <= 0) break;
    }
  }

  /// Updates an existing order
  Future<void> updateOrder(OrderModel order) async {
    await _orderRepo.updateOrder(order);

    if (order.clientId != null) {
      await _updateClientStats(order.clientId!);
    }
  }

  /// Deletes an order and all its associated projects
  Future<void> deleteOrder(int orderId) async {
    final order = await _orderRepo.getOrderById(orderId);
    if (order == null) return;

    // 1. Delete all associated projects (this also handles stock restoration)
    for (var projectId in order.projectIds) {
      await _projectService.deleteProject(projectId);
    }

    // 2. Delete the order itself
    await _orderRepo.deleteOrder(orderId);

    // 3. Update client stats (decrement order count)
    if (order.clientId != null) {
      final client = await _clientRepo.getClientById(order.clientId!);
      if (client != null) {
        await _clientRepo.updateClientStatistics(
          order.clientId!,
          totalOrders: (client.totalOrders - 1).clamp(0, 999999),
          totalSpent: (client.totalSpent - order.depositPaid).clamp(
            0,
            999999999,
          ),
        );
      }
    }
  }

  /// Internal helper to update client statistics
  Future<void> _updateClientStats(
    int clientId, {
    bool newOrder = false,
    double paymentAmount = 0.0,
  }) async {
    try {
      final client = await _clientRepo.getClientById(clientId);
      if (client != null) {
        final newTotalOrders = newOrder
            ? (client.totalOrders + 1)
            : client.totalOrders;
        final newTotalSpent = client.totalSpent + paymentAmount;
        final newLastOrderDate = newOrder
            ? DateTime.now()
            : client.lastOrderDate;

        await _clientRepo.updateClientStatistics(
          clientId,
          totalOrders: newTotalOrders,
          totalSpent: newTotalSpent,
          lastOrderDate: newLastOrderDate,
        );
      }
    } catch (e) {
      // Logic for stats is non-blocking for the main flow
      // but should be logged or handled
    }
  }

  // Delegation methods for simple repository calls
  Future<OrderModel?> getOrderById(int id) => _orderRepo.getOrderById(id);
  Future<List<OrderModel>> getAllOrders() => _orderRepo.getAllOrders();
  Stream<List<OrderModel>> watchOrders() => _orderRepo.watchOrders();
}
