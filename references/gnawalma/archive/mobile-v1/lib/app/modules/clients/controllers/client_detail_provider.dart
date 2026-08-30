import 'dart:async';
import 'package:url_launcher/url_launcher.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/models/client_model.dart';
import '../../../data/models/project_model.dart';
import '../../../data/services/client_service.dart';
import '../../../data/repositories/client_repository.dart';
import '../../../data/repositories/project_repository.dart';
import '../../../core/navigation/app_navigator.dart';
import '../../../core/sync/sync_models.dart';
import '../../../core/sync/sync_providers.dart';
import '../../operations/controllers/operations_providers.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/services/feedback_service.dart';
import '../../../shared/utils/app_logger.dart';
import 'client_detail_state.dart';

part 'client_detail_provider.g.dart';

@riverpod
class ClientDetail extends _$ClientDetail {
  StreamSubscription<ClientModel?>? _clientSubscription;
  StreamSubscription<List<ProjectModel>>? _projectsSubscription;

  @override
  ClientDetailState build(int clientId, {bool isPreviewMode = false}) {
    ref.onDispose(() {
      _clientSubscription?.cancel();
      _projectsSubscription?.cancel();
    });

    Future.microtask(() {
      _watchClient(clientId);
      _watchClientProjects(clientId);
    });
    return ClientDetailState(isPreviewMode: isPreviewMode);
  }

  void _watchClient(int clientId) {
    final repositoryAsync = ref.read(clientRepositoryProvider);

    repositoryAsync.when(
      data: (repo) {
        _clientSubscription = repo
            .watchClient(clientId)
            .listen(
              (clientData) {
                state = state.copyWith(client: clientData, isLoading: false);
              },
              onError: (e) {
                AppLogger.e('Error watching client', e);
                state = state.copyWith(isLoading: false);
              },
            );
      },
      loading: () {},
      error: (e, stack) {
        AppLogger.e('Error getting client repository', e, stack);
        state = state.copyWith(isLoading: false);
      },
    );
  }

  void _watchClientProjects(int clientId) {
    final repositoryAsync = ref.read(projectRepositoryProvider);

    repositoryAsync.when(
      data: (repo) {
        _projectsSubscription = repo.watchProjects().listen(
          (projects) {
            final clientProjects = projects
                .where((p) => p.clientId == clientId)
                .toList();
            state = state.copyWith(
              clientProjects: clientProjects,
              isLoadingProjects: false,
            );
          },
          onError: (e) {
            AppLogger.e('Error watching client projects', e);
            state = state.copyWith(isLoadingProjects: false);
          },
        );
      },
      loading: () {},
      error: (e, stack) {
        AppLogger.e('Error getting project repository', e, stack);
        state = state.copyWith(isLoadingProjects: false);
      },
    );
  }

  Future<void> refresh() async {
    // Watched streams handle refresh automatically, but we can re-trigger if needed
    _watchClient(clientId);
    _watchClientProjects(clientId);
  }

  Future<void> deleteClient(int clientId) async {
    try {
      final client = state.client;
      final service = await ref.read(clientServiceProvider.future);
      await service.deleteClient(clientId);
      if (client != null) await _queueRemoteDeletion(client);
      ref
          .read(feedbackServiceProvider.notifier)
          .showSuccess(
            'Client supprimé',
            'Le client et tout son historique ont été supprimés',
          );
    } catch (e) {
      AppLogger.e('Error deleting client', e);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de la suppression');
    }
  }

  Future<void> _queueRemoteDeletion(ClientModel client) async {
    try {
      final atelier = await ref.read(primaryRemoteAtelierProvider.future);
      if (atelier == null) return;
      final coordinator = await ref.read(syncCoordinatorProvider.future);
      await coordinator.enqueueClient(
        atelierId: atelier.id,
        localId: client.id.toString(),
        fullName: client.displayName,
        phone: client.phone,
        email: client.email,
        notes: client.notes,
        mutation: SyncMutation.delete,
      );
      ref.invalidate(primarySyncSnapshotProvider);
      unawaited(coordinator.synchronize(atelier.id));
    } catch (error, stackTrace) {
      AppLogger.e(
        'Client deleted locally but remote deletion could not be queued',
        error,
        stackTrace,
      );
    }
  }

  Future<void> callClient(String phone) async {
    final Uri launchUri = Uri(scheme: 'tel', path: phone.replaceAll(' ', ''));

    try {
      if (await canLaunchUrl(launchUri)) {
        await launchUrl(launchUri);
      } else {
        ref
            .read(feedbackServiceProvider.notifier)
            .showError('Impossible de lancer l\'appel');
      }
    } catch (e) {
      AppLogger.e('Error calling client', e);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de l\'appel');
    }
  }

  Future<void> emailClient(String email) async {
    final Uri launchUri = Uri(scheme: 'mailto', path: email);

    try {
      if (await canLaunchUrl(launchUri)) {
        await launchUrl(launchUri);
      } else {
        ref
            .read(feedbackServiceProvider.notifier)
            .showError('Impossible d\'ouvrir l\'application email');
      }
    } catch (e) {
      AppLogger.e('Error emailing client', e);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de l\'ouverture de l\'email');
    }
  }

  Future<void> navigateToEdit() async {
    if (state.client != null) {
      final result = await AppNavigator.to(
        AppRoutes.addEditClient,
        arguments: state.client,
      );
      if (result != null) {
        refresh();
      }
    }
  }

  Future<void> navigateToAddMeasurement() async {
    if (state.client != null) {
      final result = await AppNavigator.to(
        AppRoutes.addEditMeasurement,
        arguments: state.client,
      );
      if (result != null) {
        refresh();
      }
    }
  }

  void navigateToProject(ProjectModel project) {
    AppNavigator.to('${AppRoutes.projectDetail}/${project.id}');
  }

  Future<void> navigateToNewOrder() async {
    if (state.client != null) {
      final result = await AppNavigator.to(
        AppRoutes.newOrder,
        arguments: state.client,
      );
      if (result != null) {
        refresh();
      }
    }
  }
}
