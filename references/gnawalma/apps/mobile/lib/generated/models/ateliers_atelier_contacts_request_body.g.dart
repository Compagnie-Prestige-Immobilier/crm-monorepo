// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ateliers_atelier_contacts_request_body.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AteliersAtelierContactsRequestBody _$AteliersAtelierContactsRequestBodyFromJson(
  Map<String, dynamic> json,
) => AteliersAtelierContactsRequestBody(
  channel: Channel.fromJson(json['channel'] as String),
  message: json['message'] as String?,
  sharePhone: json['share_phone'] as bool?,
);

Map<String, dynamic> _$AteliersAtelierContactsRequestBodyToJson(
  AteliersAtelierContactsRequestBody instance,
) => <String, dynamic>{
  'channel': _$ChannelEnumMap[instance.channel]!,
  'message': instance.message,
  'share_phone': instance.sharePhone,
};

const _$ChannelEnumMap = {
  Channel.phone: 'phone',
  Channel.whatsapp: 'whatsapp',
  Channel.request: 'request',
  Channel.$unknown: r'$unknown',
};
