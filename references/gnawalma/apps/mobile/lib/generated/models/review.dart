// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'user.dart';

import 'package:gnawalma/json_converters.dart';
part 'review.g.dart';

@JsonSerializable()
class Review {
  const Review({
    required this.id,
    required this.userId,
    required this.atelierId,
    required this.rating,
    required this.text,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.user,
  });
  
  factory Review.fromJson(Map<String, Object?> json) => _$ReviewFromJson(json);
  
  final int id;
  @JsonKey(name: 'user_id')
  final int userId;
  @JsonKey(name: 'atelier_id')
  final int atelierId;
  final int rating;
  final String? text;
  final String status;
	@LocalDateTimeConverter()
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  final User? user;

  Map<String, Object?> toJson() => _$ReviewToJson(this);
}
