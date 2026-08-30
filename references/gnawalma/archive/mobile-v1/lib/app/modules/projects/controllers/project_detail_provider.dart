import 'package:gnawalma/app/data/services/order_service.dart';
import 'dart:async';
import 'dart:ui' as ui;
import 'dart:typed_data';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/project_model.dart';
import '../../../data/models/order_model.dart';
import '../../../data/services/project_service.dart';
import '../../../data/repositories/order_repository.dart';
import '../../../data/repositories/project_repository.dart';
import '../../../data/repositories/client_repository.dart';
import '../../../data/repositories/pattern_repository.dart';
import '../../../shared/services/feedback_service.dart';
import '../../../shared/utils/app_logger.dart';
import '../../../routes/app_routes.dart';
import 'project_detail_state.dart';

import '../../../shared/utils/async_action_mixin.dart';

part 'project_detail_provider.g.dart';

@riverpod
class ProjectDetail extends _$ProjectDetail with AsyncActionMixin {
  StreamSubscription<ProjectModel?>? _projectSubscription;
  StreamSubscription<OrderModel?>? _orderSubscription;

  @override
  ProjectDetailState build(int projectId, {bool isPreviewMode = false}) {
    ref.onDispose(() {
      _projectSubscription?.cancel();
      _orderSubscription?.cancel();
    });

    Future.microtask(() => _watchProject(projectId));
    return ProjectDetailState(isPreviewMode: isPreviewMode);
  }

  void _watchProject(int projectId) {
    final serviceAsync = ref.read(projectServiceProvider);

    serviceAsync.when(
      data: (service) {
        _projectSubscription = service
            .watchProject(projectId)
            .listen(
              (projectData) {
                final oldOrderId = state.project?.orderId;
                state = state.copyWith(project: projectData, isLoading: false);
                if (projectData != null) {
                  _loadRelatedData(projectData);
                  // If orderId changed or first load, watch the order
                  if (projectData.orderId != null &&
                      projectData.orderId != oldOrderId) {
                    _watchOrder(projectData.orderId!);
                  }
                }
              },
              onError: (e) {
                AppLogger.e('Error watching project', e);
                state = state.copyWith(isLoading: false);
                ref
                    .read(feedbackServiceProvider.notifier)
                    .showError('Erreur lors du chargement du projet');
              },
            );
      },
      loading: () {},
      error: (e, stack) {
        AppLogger.e('Error getting project service', e, stack);
        state = state.copyWith(isLoading: false);
      },
    );
  }

  void _watchOrder(int orderId) {
    _orderSubscription?.cancel();
    final repoAsync = ref.read(orderRepositoryProvider);

    repoAsync.when(
      data: (repo) {
        _orderSubscription = repo.watchOrder(orderId).listen((orderData) {
          state = state.copyWith(order: orderData);
          if (orderData != null) {
            _loadOrderArticles(orderData.projectIds);
          }
        }, onError: (e) => AppLogger.e('Error watching parent order', e));
      },
      loading: () {},
      error: (e, stack) => AppLogger.e('Error getting order repo', e, stack),
    );
  }

  Future<void> _loadOrderArticles(List<int> ids) async {
    try {
      final repo = await ref.read(projectRepositoryProvider.future);
      final projects = <ProjectModel>[];
      for (final id in ids) {
        final p = await repo.getProjectById(id);
        if (p != null) projects.add(p);
      }
      state = state.copyWith(orderArticles: projects);
    } catch (e) {
      AppLogger.e('Error loading order articles', e);
    }
  }

  Future<void> _loadRelatedData(ProjectModel projectData) async {
    // Load client if linked
    final clientId = projectData.clientId;
    if (clientId != null) {
      try {
        final repo = await ref.read(clientRepositoryProvider.future);
        final client = await repo.getClientById(clientId);
        state = state.copyWith(client: client);
      } catch (e) {
        AppLogger.e('Error loading client', e);
      }
    }

    // Load pattern if linked
    final patternId = projectData.patternId;
    if (patternId != null) {
      try {
        final repo = await ref.read(patternRepositoryProvider.future);
        final pattern = await repo.getPatternById(patternId);
        state = state.copyWith(pattern: pattern);
      } catch (e) {
        AppLogger.e('Error loading pattern', e);
      }
    }
  }

  Future<void> updateStatus(ProjectStatus newStatus) async {
    final project = state.project;
    if (project == null) return;

    await handleAsyncAction(
      () async {
        final service = await ref.read(projectServiceProvider.future);
        await service.updateStatus(project.id, newStatus);

        // Sync Order Status via OrderService
        final orderService = await ref.read(orderServiceProvider.future);
        await orderService.syncOrderStatusFromProject(project.id);
      },
      successTitle: 'Statut mis à jour',
      successMessage: 'Le statut de la commande a été changé',
      errorMessage: 'Erreur lors de la mise à jour',
      showToastOnSuccess: true,
      feedbackNotifier: ref.read(feedbackServiceProvider.notifier),
    );
  }

  Future<void> archiveProject() async {
    final project = state.project;
    if (project == null) return;

    await handleAsyncAction(
      () async {
        final service = await ref.read(projectServiceProvider.future);
        final updated = project..isArchived = true;
        await service.updateProject(updated);
      },
      successTitle: 'Projet archivé',
      successMessage: 'Le projet a été déplacé vers les archives',
      errorMessage: 'Erreur lors de l\'archivage',
      showToastOnSuccess: true,
      feedbackNotifier: ref.read(feedbackServiceProvider.notifier),
    );
  }

  Future<bool> deleteProject() async {
    final result = await handleAsyncAction<bool>(
      () async {
        final service = await ref.read(projectServiceProvider.future);
        await service.deleteProject(projectId);
        return true;
      },
      successMessage: 'La commande a été supprimée avec succès',
      errorMessage: 'Erreur lors de la suppression',
      showToastOnSuccess: true,
      feedbackNotifier: ref.read(feedbackServiceProvider.notifier),
    );

    return result ?? false;
  }

  String getStatusLabel(ProjectStatus status) => status.label;

  Color getStatusColor(ProjectStatus status) => status.color;

  /// Capture and Share Digital Ticket
  Future<void> shareTicket(GlobalKey ticketKey) async {
    final currentProject = state.project;
    if (currentProject == null) return;

    try {
      final RenderRepaintBoundary? boundary =
          ticketKey.currentContext?.findRenderObject()
              as RenderRepaintBoundary?;

      if (boundary == null) {
        ref
            .read(feedbackServiceProvider.notifier)
            .showError("Impossible de capturer le ticket image.");
        return;
      }

      // Convert layout to image
      final ui.Image image = await boundary.toImage(pixelRatio: 3.0);
      final ByteData? byteData = await image.toByteData(
        format: ui.ImageByteFormat.png,
      );
      if (byteData == null) {
        ref
            .read(feedbackServiceProvider.notifier)
            .showError("Erreur de conversion de l'image");
        return;
      }
      final Uint8List pngBytes = byteData.buffer.asUint8List();

      // Write to temp file
      final directory = await getApplicationDocumentsDirectory();
      final String fileName =
          'Ticket_Gnawalma_${currentProject.name.replaceAll(' ', '_')}.png';
      final File imgFile = File('${directory.path}/$fileName');
      await imgFile.writeAsBytes(pngBytes);

      // Share
      final xFile = XFile(imgFile.path);
      // ignore: deprecated_member_use
      await Share.shareXFiles(
        [xFile],
        text:
            'Voici votre ticket numérique pour ${currentProject.name} - Créé avec l\'application Gnawalma',
      );
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError("Erreur lors du partage : $e");
    }
  }

  void navigateToEdit() {
    if (state.project != null) {
      AppNavigator.to(AppRoutes.addEditProject, arguments: state.project);
    }
  }

  void navigateToEditOrder() {
    if (state.order != null) {
      AppNavigator.to(AppRoutes.addEditOrder, arguments: state.order);
    }
  }

  Future<void> addPayment(double amount) async {
    final project = state.project;
    if (project == null || amount <= 0) return;

    // Validate amount doesn't exceed remaining balance
    final remaining = project.remainingAmount;
    final finalAmount = amount > remaining ? remaining : amount;

    await handleAsyncAction(
      () async {
        // 1. Update Project Advance (Local)
        final projectService = await ref.read(projectServiceProvider.future);
        final currentAdvance = project.advancePayment ?? 0.0;
        await projectService.updateProject(
          project..advancePayment = currentAdvance + finalAmount,
        );

        // 2. Find Parent Order and Record REAL payment for Daily Cash
        final orderRepo = await ref.read(orderRepositoryProvider.future);
        final orderService = await ref.read(orderServiceProvider.future);

        final parentOrder = project.orderId != null
            ? await orderRepo.getOrderById(project.orderId!)
            : null;

        if (parentOrder != null) {
          // recordPayment in OrderService creates a PaymentRecord which is used by Dashboard for dailyCash
          // We pass targetProjectId to avoid double-counting during sync
          await orderService.recordPayment(
            parentOrder.id,
            finalAmount,
            targetProjectId: project.id,
          );
        }

        // 3. Sync everything
        await orderService.syncOrderStatusFromProject(project.id);
      },
      successTitle: 'Paiement enregistré',
      successMessage:
          'L\'encaissement de ${finalAmount.toInt()} F a été effectué.',
      errorMessage: 'Erreur lors du paiement',
      showToastOnSuccess: true,
      feedbackNotifier: ref.read(feedbackServiceProvider.notifier),
    );
  }
}
