import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../shared/utils/app_logger.dart';
import '../models/project_model.dart';
import 'package:intl/intl.dart';
import '../../domain/repositories/i_project_repository.dart';
import '../repositories/project_repository.dart';

part 'project_service.g.dart';

@Riverpod(keepAlive: true)
Future<ProjectService> projectService(Ref ref) async {
  final repository = await ref.watch(projectRepositoryProvider.future);
  return ProjectService(repository);
}

/// Service responsible for Project business logic and data access.
class ProjectService {
  final IProjectRepository _repository;

  ProjectService(this._repository);

  /// Get all projects
  Future<List<ProjectModel>> getAllProjects() async {
    return _repository.getAllProjects();
  }

  /// Get project by ID
  Future<ProjectModel?> getProjectById(int id) async {
    return _repository.getProjectById(id);
  }

  Future<int> createProject(ProjectModel project) async {
    return _repository.createProject(project);
  }

  Future<void> updateProject(ProjectModel project) async {
    await _repository.updateProject(project);
  }

  Future<void> deleteProject(int id) async {
    await _repository.deleteProject(id);
  }

  /// Watch a specific project (Real-time updates)
  Stream<ProjectModel?> watchProject(int id) {
    return _repository.watchProject(id);
  }

  /// Update Project Status
  Future<void> updateStatus(int id, ProjectStatus status) async {
    await _repository.updateProjectStatus(id, status);
  }

  /// Search projects by name only
  /// Note: To search by client name, search clients first then get their projects
  Future<List<ProjectModel>> searchProjects(String query) async {
    final allProjects = await getAllProjects();
    final lowerQuery = query.toLowerCase();
    return allProjects.where((project) {
      return project.name.toLowerCase().contains(lowerQuery);
    }).toList();
  }

  /// Checks if the workload capacity for a specific week has been reached.
  Future<bool> checkWorkloadCapacity(
    DateTime targetDate, {
    int maxPerWeek = 10,
  }) async {
    try {
      final targetWeek = _getIsoWeekNumber(targetDate);
      final allProjects = await getAllProjects();

      final activeProjectsInWeek = allProjects.where((p) {
        if (p.expectedDeliveryDate == null) return false;
        if (p.status == ProjectStatus.completed ||
            p.status == ProjectStatus.delivered) {
          return false;
        }

        return _getIsoWeekNumber(p.expectedDeliveryDate!) == targetWeek &&
            p.expectedDeliveryDate!.year == targetDate.year;
      }).length;

      return activeProjectsInWeek >= maxPerWeek;
    } catch (e) {
      AppLogger.e('Error checking workload', e);
      return false;
    }
  }

  int _getIsoWeekNumber(DateTime date) {
    int dayOfYear = int.parse(DateFormat("D").format(date));
    int woy = ((dayOfYear - date.weekday + 10) / 7).floor();
    if (woy < 1) {
      woy = _getNumWeeks(date.year - 1);
    } else if (woy > _getNumWeeks(date.year)) {
      woy = 1;
    }
    return woy;
  }

  int _getNumWeeks(int year) {
    DateTime p = DateTime(year, 12, 28);
    int dayOfYear = int.parse(DateFormat("D").format(p));
    return ((dayOfYear - p.weekday + 10) / 7).floor();
  }
}
