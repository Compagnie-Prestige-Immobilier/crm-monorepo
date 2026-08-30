// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'project_detail_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(ProjectDetail)
final projectDetailProvider = ProjectDetailFamily._();

final class ProjectDetailProvider
    extends $NotifierProvider<ProjectDetail, ProjectDetailState> {
  ProjectDetailProvider._({
    required ProjectDetailFamily super.from,
    required (int, {bool isPreviewMode}) super.argument,
  }) : super(
         retry: null,
         name: r'projectDetailProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$projectDetailHash();

  @override
  String toString() {
    return r'projectDetailProvider'
        ''
        '$argument';
  }

  @$internal
  @override
  ProjectDetail create() => ProjectDetail();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(ProjectDetailState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<ProjectDetailState>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is ProjectDetailProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$projectDetailHash() => r'183ee555a1a4e35d73e07c7da377b6b0174fce2e';

final class ProjectDetailFamily extends $Family
    with
        $ClassFamilyOverride<
          ProjectDetail,
          ProjectDetailState,
          ProjectDetailState,
          ProjectDetailState,
          (int, {bool isPreviewMode})
        > {
  ProjectDetailFamily._()
    : super(
        retry: null,
        name: r'projectDetailProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  ProjectDetailProvider call(int projectId, {bool isPreviewMode = false}) =>
      ProjectDetailProvider._(
        argument: (projectId, isPreviewMode: isPreviewMode),
        from: this,
      );

  @override
  String toString() => r'projectDetailProvider';
}

abstract class _$ProjectDetail extends $Notifier<ProjectDetailState> {
  late final _$args = ref.$arg as (int, {bool isPreviewMode});
  int get projectId => _$args.$1;
  bool get isPreviewMode => _$args.isPreviewMode;

  ProjectDetailState build(int projectId, {bool isPreviewMode = false});
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<ProjectDetailState, ProjectDetailState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<ProjectDetailState, ProjectDetailState>,
              ProjectDetailState,
              Object?,
              Object?
            >;
    element.handleCreate(
      ref,
      () => build(_$args.$1, isPreviewMode: _$args.isPreviewMode),
    );
  }
}
