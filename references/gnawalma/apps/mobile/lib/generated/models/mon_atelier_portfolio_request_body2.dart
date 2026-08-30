// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'mon_atelier_portfolio_request_body2.g.dart';

@JsonSerializable()
class MonAtelierPortfolioRequestBody2 {
  const MonAtelierPortfolioRequestBody2({
    required this.ids,
  });
  
  factory MonAtelierPortfolioRequestBody2.fromJson(Map<String, Object?> json) => _$MonAtelierPortfolioRequestBody2FromJson(json);
  
  final List<String> ids;

  Map<String, Object?> toJson() => _$MonAtelierPortfolioRequestBody2ToJson(this);
}
