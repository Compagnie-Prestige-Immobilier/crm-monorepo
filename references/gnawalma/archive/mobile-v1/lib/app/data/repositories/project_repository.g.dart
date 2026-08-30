// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'project_repository.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(projectRepository)
final projectRepositoryProvider = ProjectRepositoryProvider._();

final class ProjectRepositoryProvider
    extends
        $FunctionalProvider<
          AsyncValue<ProjectRepository>,
          ProjectRepository,
          FutureOr<ProjectRepository>
        >
    with
        $FutureModifier<ProjectRepository>,
        $FutureProvider<ProjectRepository> {
  ProjectRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'projectRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$projectRepositoryHash();

  @$internal
  @override
  $FutureProviderElement<ProjectRepository> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<ProjectRepository> create(Ref ref) {
    return projectRepository(ref);
  }
}

String _$projectRepositoryHash() => r'7308218c76d382d2c1fa3ad944028ae7bb989f94';
