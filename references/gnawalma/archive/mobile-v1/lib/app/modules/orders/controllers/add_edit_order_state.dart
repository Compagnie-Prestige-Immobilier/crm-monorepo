import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../data/models/order_model.dart';
import '../../../data/models/client_model.dart';
import '../../../data/models/project_model.dart';

part 'add_edit_order_state.freezed.dart';

@freezed
abstract class AddEditOrderState with _$AddEditOrderState {
  const factory AddEditOrderState({
    @Default(false) bool isEditMode,
    @Default(false) bool isLoading,
    @Default(false) bool isSaving,
    OrderModel? existingOrder,
    ClientModel? selectedClient,
    @Default([]) List<ProjectModel> selectedProjects,
    @Default([]) List<ClientModel> availableClients,
    @Default([]) List<ProjectModel> availableProjects,
    DateTime? orderDate,
    DateTime? expectedDeliveryDate,
  }) = _AddEditOrderState;
}
