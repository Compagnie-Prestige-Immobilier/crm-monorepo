// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'atelier.dart';

import 'package:gnawalma/json_converters.dart';
part 'user.g.dart';

@JsonSerializable()
class User {
  const User({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.role,
    this.createdAt,
    this.updatedAt,
    this.atelier,
  });
  
  factory User.fromJson(Map<String, Object?> json) => _$UserFromJson(json);
  
  final int id;
  final String name;
  final String? email;
  final String? phone;
  final String? role;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  final Atelier? atelier;

  Map<String, Object?> toJson() => _$UserToJson(this);
}
