// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'post_auth_login_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PostAuthLoginResponse _$PostAuthLoginResponseFromJson(
  Map<String, dynamic> json,
) => PostAuthLoginResponse(
  accessToken: json['access_token'] as String,
  tokenType: json['token_type'] as String,
  expiresIn: json['expires_in'] as String,
  user: User.fromJson(json['user'] as Map<String, dynamic>),
);

Map<String, dynamic> _$PostAuthLoginResponseToJson(
  PostAuthLoginResponse instance,
) => <String, dynamic>{
  'access_token': instance.accessToken,
  'token_type': instance.tokenType,
  'expires_in': instance.expiresIn,
  'user': instance.user,
};
