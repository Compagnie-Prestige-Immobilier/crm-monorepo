// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'type.dart';

part 'signalements_request_body.g.dart';

@JsonSerializable()
class SignalementsRequestBody {
  const SignalementsRequestBody({
    required this.type,
    required this.id,
    required this.reason,
  });
  
  factory SignalementsRequestBody.fromJson(Map<String, Object?> json) => _$SignalementsRequestBodyFromJson(json);
  
  final Type type;
  final int id;
  final String reason;

  Map<String, Object?> toJson() => _$SignalementsRequestBodyToJson(this);
}
