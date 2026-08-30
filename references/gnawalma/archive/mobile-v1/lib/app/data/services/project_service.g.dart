// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'project_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(projectService)
final projectServiceProvider = ProjectServiceProvider._();

final class ProjectServiceProvider
    extends
        $FunctionalProvider<
          AsyncValue<ProjectService>,
          ProjectService,
          FutureOr<ProjectService>
        >
    with $FutureModifier<ProjectService>, $FutureProvider<ProjectService> {
  ProjectServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'projectServiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$projectServiceHash();

  @$internal
  @override
  $FutureProviderElement<ProjectService> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<ProjectService> create(Ref ref) {
    return projectService(ref);
  }
}

String _$projectServiceHash() => r'48d2146cb26131c8218f971dd72173fa4d4b821b';
