// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'post_media_response.g.dart';

@JsonSerializable()
class PostMediaResponse {
  const PostMediaResponse({
    required this.path,
    required this.url,
  });
  
  factory PostMediaResponse.fromJson(Map<String, Object?> json) => _$PostMediaResponseFromJson(json);
  
  final String path;
  final String url;

  Map<String, Object?> toJson() => _$PostMediaResponseToJson(this);
}
