// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'get_mes_contacts_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GetMesContactsResponse _$GetMesContactsResponseFromJson(
  Map<String, dynamic> json,
) => GetMesContactsResponse(
  currentPage: (json['current_page'] as num).toInt(),
  data: (json['data'] as List<dynamic>)
      .map((e) => Contact.fromJson(e as Map<String, dynamic>))
      .toList(),
  firstPageUrl: json['first_page_url'] as String?,
  from: (json['from'] as num?)?.toInt(),
  nextPageUrl: json['next_page_url'] as String?,
  path: json['path'] as String?,
  perPage: (json['per_page'] as num).toInt(),
  prevPageUrl: json['prev_page_url'] as String?,
  to: (json['to'] as num?)?.toInt(),
);

Map<String, dynamic> _$GetMesContactsResponseToJson(
  GetMesContactsResponse instance,
) => <String, dynamic>{
  'current_page': instance.currentPage,
  'data': instance.data,
  'first_page_url': instance.firstPageUrl,
  'from': instance.from,
  'next_page_url': instance.nextPageUrl,
  'path': instance.path,
  'per_page': instance.perPage,
  'prev_page_url': instance.prevPageUrl,
  'to': instance.to,
};
