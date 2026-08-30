import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../data/models/client_model.dart';

part 'clients_state.freezed.dart';

@freezed
abstract class ClientsState with _$ClientsState {
  const factory ClientsState({
    @Default([]) List<ClientModel> clients,
    @Default([]) List<ClientModel> filteredClients,
    @Default('') String searchQuery,
    @Default(true) bool isLoading,

    /// Set when the underlying stream failed. Distinguishes "load failed"
    /// from "you have nothing yet".
    @Default(false) bool hasError,
  }) = _ClientsState;
}
