import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../data/models/client_model.dart';
import '../../../data/models/project_model.dart';
import '../../../data/models/beneficiary_model.dart';

part 'new_order_state.freezed.dart';

@freezed
abstract class NewOrderState with _$NewOrderState {
  const factory NewOrderState({
    @Default(0) int currentStep,
    @Default(['Client', 'Articles', 'Paiement']) List<String> steps,

    // Step 1: Client Selection
    ClientModel? selectedClient,
    @Default('') String searchQuery,
    @Default([]) List<ClientModel> recentClients,
    @Default([]) List<ClientModel> searchResults,
    @Default(false) bool isSearching,

    // Step 2: Item Building
    @Default([]) List<ProjectModel> cartItems,
    @Default({}) Map<String, String?> itemErrors,
    BeneficiaryModel? selectedBeneficiary,
    @Default('Cliente') String selectedForWhom,
    @Default('') String garmentType,
    @Default({}) Map<String, double> itemMeasurements,
    @Default('') String measurementNotes,
    @Default(0.0) double itemPrice,
    @Default([]) List<String> itemPhotos,
    String? fabricPhoto,
    @Default('') String fabricNote,
    String? audioNotePath,
    @Default([]) List<BeneficiaryModel> clientBeneficiaries,

    // Step 3: Payment
    @Default(0.0) double depositAmount,
    DateTime? deliveryDate,

    // UI State
    @Default(false) bool isCreatingOrder,
    @Default(false) bool orderCreationAttempted,
    @Default(false) bool showHistory,
  }) = _NewOrderState;
}
