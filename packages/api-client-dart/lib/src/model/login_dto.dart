//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'login_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LoginDto {
  /// Returns a new [LoginDto] instance.
  LoginDto({required this.identifier, required this.password});

  /// Adresse e-mail OU nom d’utilisateur. Le serveur essaie les deux.
  @JsonKey(name: r'identifier', required: true, includeIfNull: false)
  final String identifier;

  @JsonKey(name: r'password', required: true, includeIfNull: false)
  final String password;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is LoginDto &&
            runtimeType == other.runtimeType &&
            equals([identifier, password], [other.identifier, other.password]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([identifier, password]);

  factory LoginDto.fromJson(Map<String, dynamic> json) =>
      _$LoginDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LoginDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
