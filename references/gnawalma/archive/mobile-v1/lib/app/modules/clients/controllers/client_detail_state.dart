import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../data/models/client_model.dart';
import '../../../data/models/project_model.dart';

part 'client_detail_state.freezed.dart';

@freezed
abstract class ClientDetailState with _$ClientDetailState {
  const factory ClientDetailState({
    ClientModel? client,
    @Default([]) List<ProjectModel> clientProjects,
    @Default(true) bool isLoading,
    @Default(true) bool isLoadingProjects,
    @Default(false) bool isPreviewMode,
  }) = _ClientDetailState;
}
