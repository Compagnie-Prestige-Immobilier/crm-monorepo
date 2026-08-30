// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'signalements_request_body.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SignalementsRequestBody _$SignalementsRequestBodyFromJson(
  Map<String, dynamic> json,
) => SignalementsRequestBody(
  type: Type.fromJson(json['type'] as String),
  id: (json['id'] as num).toInt(),
  reason: json['reason'] as String,
);

Map<String, dynamic> _$SignalementsRequestBodyToJson(
  SignalementsRequestBody instance,
) => <String, dynamic>{
  'type': _$TypeEnumMap[instance.type]!,
  'id': instance.id,
  'reason': instance.reason,
};

const _$TypeEnumMap = {
  Type.atelier: 'atelier',
  Type.avis: 'avis',
  Type.$unknown: r'$unknown',
};
