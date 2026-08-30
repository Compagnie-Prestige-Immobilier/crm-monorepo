import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../data/models/client_model.dart';

part 'add_edit_measurement_state.freezed.dart';

@freezed
abstract class AddEditMeasurementState with _$AddEditMeasurementState {
  const factory AddEditMeasurementState({
    ClientModel? client,
    @Default({}) Map<String, double> customMeasurements,
    @Default(false) bool isSaving,
    MeasurementRecord? existingMeasurement,
  }) = _AddEditMeasurementState;
}
