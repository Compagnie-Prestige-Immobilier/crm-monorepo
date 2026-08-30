import '../../data/models/project_model.dart';

/// Repository interface for Project operations
///
/// Defines all CRUD operations and queries for projects
/// Implementations handle the actual data access logic
abstract class IProjectRepository {
  // ===== CRUD Operations =====

  /// Get all projects
  Future<List<ProjectModel>> getAllProjects();

  /// Get a project by ID
  Future<ProjectModel?> getProjectById(int id);

  /// Create a new project
  /// Returns the ID of the created project
  Future<int> createProject(ProjectModel project);

  /// Update an existing project
  Future<void> updateProject(ProjectModel project);

  /// Delete a project by ID
  Future<void> deleteProject(int id);

  // ===== Queries and Filters =====

  /// Get projects filtered by status
  Future<List<ProjectModel>> getProjectsByStatus(ProjectStatus status);

  /// Get all projects for a specific client
  Future<List<ProjectModel>> getProjectsByClient(int clientId);

  /// Search projects by name or garment type
  Future<List<ProjectModel>> searchProjects(String query);

  /// Get projects that are overdue (past expectedDeliveryDate)
  Future<List<ProjectModel>> getOverdueProjects();

  /// Get recently created projects (limit: n)
  Future<List<ProjectModel>> getRecentProjects({int limit = 10});

  /// Get projects linked to a specific set of orders
  Future<List<ProjectModel>> getProjectsForOrders(List<int> orderIds);

  // ===== Updates =====

  /// Update a project's status
  Future<void> updateProjectStatus(int id, ProjectStatus status);

  /// Update a project's progress percentage
  Future<void> updateProjectProgress(int id, double progressPercentage);

  /// Toggle a step's completion status
  Future<void> toggleProjectStep(int id, String step);

  // ===== Statistics =====

  /// Get count of projects by status
  Future<Map<ProjectStatus, int>> getProjectCountByStatus();

  /// Get total number of projects
  Future<int> getTotalProjectCount();

  /// Get count of active projects (TODO or IN_PROGRESS)
  Future<int> getActiveProjectCount();

  /// Get count of completed projects (COMPLETED or DELIVERED)
  Future<int> getCompletedProjectCount();

  // ===== Real-time Updates =====

  /// Watch for changes to all projects
  /// Returns a stream that emits whenever projects are added, updated, or deleted
  Stream<List<ProjectModel>> watchProjects();

  /// Watch for changes to projects with a specific status
  Stream<List<ProjectModel>> watchProjectsByStatus(ProjectStatus status);

  /// Watch a specific project by ID
  Stream<ProjectModel?> watchProject(int id);

  /// Get the number of projects within a specific date range (expectedDeliveryDate)
  Future<int> getProjectCountInDateRange(DateTime start, DateTime end);
}
