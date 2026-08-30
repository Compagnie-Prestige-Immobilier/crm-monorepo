// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'review.dart';

part 'get_ateliers_atelier_avis_response.g.dart';

@JsonSerializable()
class GetAteliersAtelierAvisResponse {
  const GetAteliersAtelierAvisResponse({
    required this.currentPage,
    required this.data,
    required this.firstPageUrl,
    required this.from,
    required this.nextPageUrl,
    required this.path,
    required this.perPage,
    required this.prevPageUrl,
    required this.to,
  });
  
  factory GetAteliersAtelierAvisResponse.fromJson(Map<String, Object?> json) => _$GetAteliersAtelierAvisResponseFromJson(json);
  
  @JsonKey(name: 'current_page')
  final int currentPage;
  final List<Review> data;
  @JsonKey(name: 'first_page_url')
  final String? firstPageUrl;
  final int? from;
  @JsonKey(name: 'next_page_url')
  final String? nextPageUrl;

  /// Base path for paginator generated URLs.
  final String? path;

  /// Number of items shown per page.
  @JsonKey(name: 'per_page')
  final int perPage;
  @JsonKey(name: 'prev_page_url')
  final String? prevPageUrl;

  /// Number of the last item in the slice.
  final int? to;

  Map<String, Object?> toJson() => _$GetAteliersAtelierAvisResponseToJson(this);
}
