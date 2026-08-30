// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'user.dart';

part 'post_auth_refresh_response.g.dart';

@JsonSerializable()
class PostAuthRefreshResponse {
  const PostAuthRefreshResponse({
    required this.accessToken,
    required this.tokenType,
    required this.expiresIn,
    required this.user,
  });
  
  factory PostAuthRefreshResponse.fromJson(Map<String, Object?> json) => _$PostAuthRefreshResponseFromJson(json);
  
  @JsonKey(name: 'access_token')
  final String accessToken;
  @JsonKey(name: 'token_type')
  final String tokenType;
  @JsonKey(name: 'expires_in')
  final String expiresIn;
  final User user;

  Map<String, Object?> toJson() => _$PostAuthRefreshResponseToJson(this);
}
