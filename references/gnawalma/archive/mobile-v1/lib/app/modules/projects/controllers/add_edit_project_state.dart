import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../data/models/project_model.dart';
import '../../../data/models/client_model.dart';
import '../../../data/models/pattern_model.dart';

part 'add_edit_project_state.freezed.dart';

@freezed
abstract class AddEditProjectState with _$AddEditProjectState {
  const factory AddEditProjectState({
    @Default(0) int currentStep,
    @Default(['Client', 'Tissu', 'Modèle', 'Mesures', 'Contrat'])
    List<String> steps,
    @Default(ProjectStatus.todo) ProjectStatus selectedStatus,
    @Default(Gender.female) Gender selectedGender,
    @Default([]) List<String> photoUrls,
    DateTime? startDate,
    DateTime? expectedDeliveryDate,
    ClientModel? selectedClient,
    PatternModel? selectedPattern,
    @Default([]) List<ClientModel> clients,
    @Default([]) List<PatternModel> patterns,
    @Default({}) Map<String, double> currentMeasurements,
    @Default(false) bool isSaving,
    @Default(false) bool isLoadingClients,
    @Default(false) bool isLoadingPatterns,
    @Default(false) bool isEditMode,
    String? audioNotePath,
    String? clientFabricPhotoUrl,
    ProjectModel? existingProject,
  }) = _AddEditProjectState;
}
