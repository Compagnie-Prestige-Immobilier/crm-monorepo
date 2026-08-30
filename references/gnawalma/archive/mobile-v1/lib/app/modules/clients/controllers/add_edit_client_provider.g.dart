// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'add_edit_client_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(AddEditClient)
final addEditClientProvider = AddEditClientFamily._();

final class AddEditClientProvider
    extends $NotifierProvider<AddEditClient, AddEditClientState> {
  AddEditClientProvider._({
    required AddEditClientFamily super.from,
    required ClientModel? super.argument,
  }) : super(
         retry: null,
         name: r'addEditClientProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$addEditClientHash();

  @override
  String toString() {
    return r'addEditClientProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  AddEditClient create() => AddEditClient();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AddEditClientState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AddEditClientState>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is AddEditClientProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$addEditClientHash() => r'8a97c0ba32848f7b17bfafcaee620a3463a48f73';

final class AddEditClientFamily extends $Family
    with
        $ClassFamilyOverride<
          AddEditClient,
          AddEditClientState,
          AddEditClientState,
          AddEditClientState,
          ClientModel?
        > {
  AddEditClientFamily._()
    : super(
        retry: null,
        name: r'addEditClientProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  AddEditClientProvider call({ClientModel? client}) =>
      AddEditClientProvider._(argument: client, from: this);

  @override
  String toString() => r'addEditClientProvider';
}

abstract class _$AddEditClient extends $Notifier<AddEditClientState> {
  late final _$args = ref.$arg as ClientModel?;
  ClientModel? get client => _$args;

  AddEditClientState build({ClientModel? client});
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<AddEditClientState, AddEditClientState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AddEditClientState, AddEditClientState>,
              AddEditClientState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, () => build(client: _$args));
  }
}
