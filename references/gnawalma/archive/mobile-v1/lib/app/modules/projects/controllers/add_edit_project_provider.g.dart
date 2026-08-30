// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'add_edit_project_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(AddEditProject)
final addEditProjectProvider = AddEditProjectFamily._();

final class AddEditProjectProvider
    extends $NotifierProvider<AddEditProject, AddEditProjectState> {
  AddEditProjectProvider._({
    required AddEditProjectFamily super.from,
    required ProjectModel? super.argument,
  }) : super(
         retry: null,
         name: r'addEditProjectProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$addEditProjectHash();

  @override
  String toString() {
    return r'addEditProjectProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  AddEditProject create() => AddEditProject();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AddEditProjectState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AddEditProjectState>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is AddEditProjectProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$addEditProjectHash() => r'8fd3d1c90dcce25f714ea99c464f43c01e4008a0';

final class AddEditProjectFamily extends $Family
    with
        $ClassFamilyOverride<
          AddEditProject,
          AddEditProjectState,
          AddEditProjectState,
          AddEditProjectState,
          ProjectModel?
        > {
  AddEditProjectFamily._()
    : super(
        retry: null,
        name: r'addEditProjectProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  AddEditProjectProvider call({ProjectModel? project}) =>
      AddEditProjectProvider._(argument: project, from: this);

  @override
  String toString() => r'addEditProjectProvider';
}

abstract class _$AddEditProject extends $Notifier<AddEditProjectState> {
  late final _$args = ref.$arg as ProjectModel?;
  ProjectModel? get project => _$args;

  AddEditProjectState build({ProjectModel? project});
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<AddEditProjectState, AddEditProjectState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AddEditProjectState, AddEditProjectState>,
              AddEditProjectState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, () => build(project: _$args));
  }
}
