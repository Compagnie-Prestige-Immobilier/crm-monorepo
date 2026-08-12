//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'refresh_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RefreshDto {
  /// Returns a new [RefreshDto] instance.
  RefreshDto({required this.refreshToken});

  /// Le refresh token reçu au login ou au refresh précédent.
  @JsonKey(name: r'refreshToken', required: true, includeIfNull: false)
  final String refreshToken;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RefreshDto &&
            runtimeType == other.runtimeType &&
            equals([refreshToken], [other.refreshToken]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([refreshToken]);

  factory RefreshDto.fromJson(Map<String, dynamic> json) =>
      _$RefreshDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RefreshDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
