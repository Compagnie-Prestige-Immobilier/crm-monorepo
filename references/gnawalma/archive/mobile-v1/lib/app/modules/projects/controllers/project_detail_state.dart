import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../data/models/project_model.dart';
import '../../../data/models/order_model.dart';
import '../../../data/models/client_model.dart';
import '../../../data/models/pattern_model.dart';

part 'project_detail_state.freezed.dart';

@freezed
abstract class ProjectDetailState with _$ProjectDetailState {
  const factory ProjectDetailState({
    ProjectModel? project,
    OrderModel? order,
    @Default([]) List<ProjectModel> orderArticles,
    ClientModel? client,
    PatternModel? pattern,
    @Default(true) bool isLoading,
    @Default(false) bool isPreviewMode,
  }) = _ProjectDetailState;
}
