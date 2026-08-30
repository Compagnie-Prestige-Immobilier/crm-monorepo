// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'get_mon_atelier_tableau_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GetMonAtelierTableauResponse _$GetMonAtelierTableauResponseFromJson(
  Map<String, dynamic> json,
) => GetMonAtelierTableauResponse(
  unpaidCfa: json['unpaid_cfa'] as String,
  overdueOrders: json['overdue_orders'] as String,
  activeOrders: json['active_orders'] as String,
  nextDueAt: json['next_due_at'] as String,
  pendingRequests: json['pending_requests'],
);

Map<String, dynamic> _$GetMonAtelierTableauResponseToJson(
  GetMonAtelierTableauResponse instance,
) => <String, dynamic>{
  'unpaid_cfa': instance.unpaidCfa,
  'overdue_orders': instance.overdueOrders,
  'active_orders': instance.activeOrders,
  'next_due_at': instance.nextDueAt,
  'pending_requests': instance.pendingRequests,
};
