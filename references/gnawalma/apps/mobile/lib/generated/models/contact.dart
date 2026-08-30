// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'atelier.dart';
import 'user.dart';

import 'package:gnawalma/json_converters.dart';
part 'contact.g.dart';

@JsonSerializable()
class Contact {
  const Contact({
    required this.id,
    required this.userId,
    required this.channel,
    required this.message,
    required this.sharePhone,
    required this.handledAt,
    required this.createdAt,
    required this.updatedAt,
    this.atelierId,
    this.myRating,
    this.user,
    this.atelier,
  });
  
  factory Contact.fromJson(Map<String, Object?> json) => _$ContactFromJson(json);
  
  final int id;
  @JsonKey(name: 'user_id')
  final int userId;
  @JsonKey(name: 'atelier_id')
  final int? atelierId;
  final String channel;
  final String? message;
  @JsonKey(name: 'share_phone')
  final bool sharePhone;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'handled_at')
  final DateTime? handledAt;
	@LocalDateTimeConverter()
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  @JsonKey(name: 'my_rating')
  final int? myRating;
  final User? user;
  final Atelier? atelier;

  Map<String, Object?> toJson() => _$ContactToJson(this);
}
