// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'auth_mot_de_passe_oublie_request_body.g.dart';

@JsonSerializable()
class AuthMotDePasseOublieRequestBody {
  const AuthMotDePasseOublieRequestBody({
    required this.email,
  });
  
  factory AuthMotDePasseOublieRequestBody.fromJson(Map<String, Object?> json) => _$AuthMotDePasseOublieRequestBodyFromJson(json);
  
  final String email;

  Map<String, Object?> toJson() => _$AuthMotDePasseOublieRequestBodyToJson(this);
}
