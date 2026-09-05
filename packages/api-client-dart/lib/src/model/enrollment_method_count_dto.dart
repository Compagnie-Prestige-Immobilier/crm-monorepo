//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/enrollment_method.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'enrollment_method_count_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class EnrollmentMethodCountDto {
  /// Returns a new [EnrollmentMethodCountDto] instance.
  EnrollmentMethodCountDto({
    required this.method,

    required this.label,

    required this.prospects,

    required this.share,
  });

  @JsonKey(
    name: r'method',
    required: true,
    includeIfNull: false,
    unknownEnumValue: EnrollmentMethod.unknownDefaultOpenApi,
  )
  final EnrollmentMethod method;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'prospects', required: true, includeIfNull: false)
  final num prospects;

  /// Part des prospects porteurs d’une méthode.
  @JsonKey(name: r'share', required: true, includeIfNull: false)
  final num share;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is EnrollmentMethodCountDto &&
            runtimeType == other.runtimeType &&
            equals(
              [method, label, prospects, share],
              [other.method, other.label, other.prospects, other.share],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([method, label, prospects, share]);

  factory EnrollmentMethodCountDto.fromJson(Map<String, dynamic> json) =>
      _$EnrollmentMethodCountDtoFromJson(json);

  Map<String, dynamic> toJson() => _$EnrollmentMethodCountDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
