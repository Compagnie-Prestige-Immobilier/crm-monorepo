//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'suppression_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SuppressionDto {
  /// Returns a new [SuppressionDto] instance.
  SuppressionDto({required this.supprimees});

  @JsonKey(name: r'supprimees', required: true, includeIfNull: false)
  final num supprimees;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SuppressionDto &&
            runtimeType == other.runtimeType &&
            equals([supprimees], [other.supprimees]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([supprimees]);

  factory SuppressionDto.fromJson(Map<String, dynamic> json) =>
      _$SuppressionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SuppressionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
