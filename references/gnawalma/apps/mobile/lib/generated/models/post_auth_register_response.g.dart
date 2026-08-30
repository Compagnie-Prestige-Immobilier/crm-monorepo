// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'post_auth_register_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PostAuthRegisterResponse _$PostAuthRegisterResponseFromJson(
  Map<String, dynamic> json,
) => PostAuthRegisterResponse(
  accessToken: json['access_token'] as String,
  tokenType: json['token_type'] as String,
  expiresIn: json['expires_in'] as String,
  user: User.fromJson(json['user'] as Map<String, dynamic>),
);

Map<String, dynamic> _$PostAuthRegisterResponseToJson(
  PostAuthRegisterResponse instance,
) => <String, dynamic>{
  'access_token': instance.accessToken,
  'token_type': instance.tokenType,
  'expires_in': instance.expiresIn,
  'user': instance.user,
};
