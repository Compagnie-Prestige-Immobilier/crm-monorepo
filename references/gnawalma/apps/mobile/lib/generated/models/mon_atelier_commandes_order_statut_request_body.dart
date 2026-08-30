// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'status.dart';

part 'mon_atelier_commandes_order_statut_request_body.g.dart';

@JsonSerializable()
class MonAtelierCommandesOrderStatutRequestBody {
  const MonAtelierCommandesOrderStatutRequestBody({
    required this.status,
  });
  
  factory MonAtelierCommandesOrderStatutRequestBody.fromJson(Map<String, Object?> json) => _$MonAtelierCommandesOrderStatutRequestBodyFromJson(json);
  
  final Status status;

  Map<String, Object?> toJson() => _$MonAtelierCommandesOrderStatutRequestBodyToJson(this);
}
