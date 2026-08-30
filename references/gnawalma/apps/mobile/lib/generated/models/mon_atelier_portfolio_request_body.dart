// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'mon_atelier_portfolio_request_body.g.dart';

@JsonSerializable()
class MonAtelierPortfolioRequestBody {
  const MonAtelierPortfolioRequestBody({
    required this.path,
  });
  
  factory MonAtelierPortfolioRequestBody.fromJson(Map<String, Object?> json) => _$MonAtelierPortfolioRequestBodyFromJson(json);
  
  final String path;

  Map<String, Object?> toJson() => _$MonAtelierPortfolioRequestBodyToJson(this);
}
