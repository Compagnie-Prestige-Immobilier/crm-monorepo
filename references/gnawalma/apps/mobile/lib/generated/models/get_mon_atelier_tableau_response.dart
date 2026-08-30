// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'get_mon_atelier_tableau_response.g.dart';

@JsonSerializable()
class GetMonAtelierTableauResponse {
  const GetMonAtelierTableauResponse({
    required this.unpaidCfa,
    required this.overdueOrders,
    required this.activeOrders,
    required this.nextDueAt,
    required this.pendingRequests,
  });
  
  factory GetMonAtelierTableauResponse.fromJson(Map<String, Object?> json) => _$GetMonAtelierTableauResponseFromJson(json);
  
  @JsonKey(name: 'unpaid_cfa')
  final String unpaidCfa;
  @JsonKey(name: 'overdue_orders')
  final String overdueOrders;
  @JsonKey(name: 'active_orders')
  final String activeOrders;
  @JsonKey(name: 'next_due_at')
  final String nextDueAt;
  @JsonKey(name: 'pending_requests')
  final dynamic pendingRequests;

  Map<String, Object?> toJson() => _$GetMonAtelierTableauResponseToJson(this);
}
