import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../data/models/client_model.dart';

part 'add_edit_client_state.freezed.dart';

@freezed
abstract class AddEditClientState with _$AddEditClientState {
  const factory AddEditClientState({
    @Default(0) int currentStep,
    @Default(false) bool isSaving,
    @Default(false) bool isEditMode,
    ClientModel? existingClient,
    // Phone validation fields
    @Default(false) bool isCheckingPhone,
    @Default(false) bool phoneExists,
    ClientModel? existingPhoneClient,
    String? phoneError,
  }) = _AddEditClientState;
}
