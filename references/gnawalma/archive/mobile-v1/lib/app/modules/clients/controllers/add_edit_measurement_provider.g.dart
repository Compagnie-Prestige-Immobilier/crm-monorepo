// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'add_edit_measurement_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(AddEditMeasurement)
final addEditMeasurementProvider = AddEditMeasurementFamily._();

final class AddEditMeasurementProvider
    extends $NotifierProvider<AddEditMeasurement, AddEditMeasurementState> {
  AddEditMeasurementProvider._({
    required AddEditMeasurementFamily super.from,
    required ClientModel? super.argument,
  }) : super(
         retry: null,
         name: r'addEditMeasurementProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$addEditMeasurementHash();

  @override
  String toString() {
    return r'addEditMeasurementProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  AddEditMeasurement create() => AddEditMeasurement();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AddEditMeasurementState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AddEditMeasurementState>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is AddEditMeasurementProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$addEditMeasurementHash() =>
    r'b8c98d6bf2b7abaf3c1c4fff06187c66c5fa1f77';

final class AddEditMeasurementFamily extends $Family
    with
        $ClassFamilyOverride<
          AddEditMeasurement,
          AddEditMeasurementState,
          AddEditMeasurementState,
          AddEditMeasurementState,
          ClientModel?
        > {
  AddEditMeasurementFamily._()
    : super(
        retry: null,
        name: r'addEditMeasurementProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  AddEditMeasurementProvider call({ClientModel? initialClient}) =>
      AddEditMeasurementProvider._(argument: initialClient, from: this);

  @override
  String toString() => r'addEditMeasurementProvider';
}

abstract class _$AddEditMeasurement extends $Notifier<AddEditMeasurementState> {
  late final _$args = ref.$arg as ClientModel?;
  ClientModel? get initialClient => _$args;

  AddEditMeasurementState build({ClientModel? initialClient});
  @$mustCallSuper
  @override
  void runBuild() {
    final ref =
        this.ref as $Ref<AddEditMeasurementState, AddEditMeasurementState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AddEditMeasurementState, AddEditMeasurementState>,
              AddEditMeasurementState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, () => build(initialClient: _$args));
  }
}
