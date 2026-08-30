import 'package:isar_plus/isar_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../domain/repositories/i_project_repository.dart';
import '../models/project_model.dart';
import '../services/database_service.dart';
import '../../shared/utils/app_logger.dart';
import 'base_isar_repository.dart';

part 'project_repository.g.dart';

@Riverpod(keepAlive: true)
Future<ProjectRepository> projectRepository(Ref ref) async {
  final isar = await ref.watch(databaseProvider.future);
  return ProjectRepository(isar);
}

/// Implementation of IProjectRepository using Isar
class ProjectRepository extends BaseIsarRepository<ProjectModel>
    implements IProjectRepository {
  ProjectRepository(super.isar);

  @override
  IsarCollection<int, ProjectModel> getCollection(Isar isar) =>
      isar.projectModels;

  @override
  IsarCollection<int, ProjectModel> get collection => isar.projectModels;

  IsarCollection<int, ProjectModel> get _projects => isar.projectModels;

  @override
  Future<void> put(ProjectModel item) async {
    final localIsar = isar;
    AppLogger.i('ProjectRepository: Saving project "${item.name}"');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.projectModels.put(item);
      });
    } catch (e, stack) {
      AppLogger.e('ProjectRepository: Error putting project', e, stack);
      rethrow;
    }
  }

  @override
  Future<void> putAll(List<ProjectModel> items) async {
    final localIsar = isar;
    AppLogger.i('ProjectRepository: Saving ${items.length} projects');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.projectModels.putAll(items);
      });
    } catch (e, stack) {
      AppLogger.e(
        'ProjectRepository: Error putting multiple projects',
        e,
        stack,
      );
      rethrow;
    }
  }

  @override
  Future<void> delete(int id) async {
    final localIsar = isar;
    AppLogger.i('ProjectRepository: Deleting project ID: $id');
    try {
      await localIsar.writeAsync((isarInstance) {
        isarInstance.projectModels.delete(id);
      });
    } catch (e, stack) {
      AppLogger.e('ProjectRepository: Error deleting project', e, stack);
      rethrow;
    }
  }

  @override
  Future<List<ProjectModel>> getAllProjects() =>
      _projects.where().isArchivedEqualTo(false).findAllAsync();

  @override
  Future<List<ProjectModel>> getProjectsForOrders(List<int> orderIds) async {
    if (orderIds.isEmpty) return [];
    return _projects
        .where()
        .anyOf(orderIds, (q, int id) => q.orderIdEqualTo(id))
        .and()
        .isArchivedEqualTo(false)
        .findAllAsync();
  }

  @override
  Future<ProjectModel?> getProjectById(int id) => getById(id);

  @override
  Future<int> createProject(ProjectModel project) async {
    AppLogger.i('ProjectRepository: Creating project "${project.name}"');
    project.createdAt = DateTime.now();
    project.calculateProgress();

    // VALIDATION: Warn if expectedDeliveryDate is null (helps catch future bugs)
    if (project.expectedDeliveryDate == null) {
      AppLogger.w(
        'WARNING: Creating project without expectedDeliveryDate: ${project.name}',
      );
    }

    if (project.id == 0) {
      project.id = _projects.autoIncrement();
    }

    await put(project);
    return project.id;
  }

  @override
  Future<void> updateProject(ProjectModel project) async {
    AppLogger.i(
      'ProjectRepository: Updating project "${project.name}" (ID: ${project.id})',
    );
    project.calculateProgress();
    await put(project);
  }

  @override
  Future<void> deleteProject(int id) async {
    await delete(id);
  }

  @override
  Future<List<ProjectModel>> getProjectsByStatus(ProjectStatus status) async {
    return _projects.where().statusEqualTo(status).findAllAsync();
  }

  @override
  Future<List<ProjectModel>> getProjectsByClient(int clientId) async {
    return _projects.where().clientIdEqualTo(clientId).findAllAsync();
  }

  @override
  Future<List<ProjectModel>> searchProjects(String query) async {
    final lowercaseQuery = query.toLowerCase();
    return _projects
        .where()
        .group(
          (q) => q
              .nameContains(lowercaseQuery, caseSensitive: false)
              .or()
              .garmentTypeContains(lowercaseQuery, caseSensitive: false),
        )
        .findAllAsync();
  }

  @override
  Future<List<ProjectModel>> getOverdueProjects() async {
    final now = DateTime.now();
    return _projects
        .where()
        .group(
          (q) => q
              .statusEqualTo(ProjectStatus.todo)
              .or()
              .statusEqualTo(ProjectStatus.inProgress),
        )
        .and()
        .expectedDeliveryDateIsNotNull()
        .and()
        .expectedDeliveryDateLessThan(now)
        .findAllAsync();
  }

  @override
  Future<List<ProjectModel>> getRecentProjects({int limit = 10}) async {
    return _projects.where().sortByCreatedAtDesc().findAllAsync(limit: limit);
  }

  @override
  Future<void> updateProjectStatus(int id, ProjectStatus status) async {
    AppLogger.i(
      'ProjectRepository: Updating project ID: $id status to $status',
    );
    final project = await getProjectById(id);
    if (project == null) return;
    project.status = status;
    if (status == ProjectStatus.delivered &&
        project.actualDeliveryDate == null) {
      project.actualDeliveryDate = DateTime.now();
    }
    await updateProject(project);
  }

  @override
  Future<void> updateProjectProgress(int id, double progressPercentage) async {
    AppLogger.i(
      'ProjectRepository: Updating project ID: $id progress to $progressPercentage',
    );
    final project = await getProjectById(id);
    if (project == null) return;
    project.progressPercentage = progressPercentage.clamp(0.0, 100.0);
    await updateProject(project);
  }

  @override
  Future<void> toggleProjectStep(int id, String step) async {
    AppLogger.i('ProjectRepository: Toggling step "$step" for project ID: $id');
    final project = await getProjectById(id);
    if (project == null) return;
    project.toggleStep(step);
    await updateProject(project);
  }

  @override
  Future<Map<ProjectStatus, int>> getProjectCountByStatus() async {
    final map = <ProjectStatus, int>{};
    for (final status in ProjectStatus.values) {
      final count = await _projects.where().statusEqualTo(status).countAsync();
      map[status] = count;
    }
    return map;
  }

  @override
  Future<int> getTotalProjectCount() async => _projects.count();

  @override
  Future<int> getActiveProjectCount() async {
    return _projects
        .where()
        .group(
          (q) => q
              .statusEqualTo(ProjectStatus.todo)
              .or()
              .statusEqualTo(ProjectStatus.inProgress),
        )
        .countAsync();
  }

  @override
  Future<int> getCompletedProjectCount() async {
    return _projects
        .where()
        .group(
          (q) => q
              .statusEqualTo(ProjectStatus.completed)
              .or()
              .statusEqualTo(ProjectStatus.delivered),
        )
        .countAsync();
  }

  @override
  Stream<List<ProjectModel>> watchProjects() =>
      _projects.where().isArchivedEqualTo(false).watch(fireImmediately: true);

  @override
  Stream<List<ProjectModel>> watchProjectsByStatus(ProjectStatus status) {
    return _projects.where().statusEqualTo(status).watch(fireImmediately: true);
  }

  @override
  Stream<ProjectModel?> watchProject(int id) {
    return _projects.watchObject(id, fireImmediately: true);
  }

  @override
  Future<int> getProjectCountInDateRange(DateTime start, DateTime end) async {
    return _projects
        .where()
        .expectedDeliveryDateBetween(start, end)
        .countAsync();
  }
}
