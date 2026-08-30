import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../data/models/order_model.dart';
import '../../../data/models/client_model.dart';
import '../../../data/models/project_model.dart';

part 'order_detail_state.freezed.dart';

@freezed
abstract class OrderDetailState with _$OrderDetailState {
  const factory OrderDetailState({
    OrderModel? order,
    ClientModel? client,
    @Default([]) List<ProjectModel> orderProjects,
    @Default(false) bool isLoading,
  }) = _OrderDetailState;
}
