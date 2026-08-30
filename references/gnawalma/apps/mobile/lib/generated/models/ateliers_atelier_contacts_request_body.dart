// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'channel.dart';

part 'ateliers_atelier_contacts_request_body.g.dart';

@JsonSerializable()
class AteliersAtelierContactsRequestBody {
  const AteliersAtelierContactsRequestBody({
    required this.channel,
    this.message,
    this.sharePhone,
  });
  
  factory AteliersAtelierContactsRequestBody.fromJson(Map<String, Object?> json) => _$AteliersAtelierContactsRequestBodyFromJson(json);
  
  final Channel channel;
  final String? message;
  @JsonKey(name: 'share_phone')
  final bool? sharePhone;

  Map<String, Object?> toJson() => _$AteliersAtelierContactsRequestBodyToJson(this);
}
