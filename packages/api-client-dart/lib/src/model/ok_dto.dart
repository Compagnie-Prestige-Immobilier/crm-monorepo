//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'ok_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OkDto {
  /// Returns a new [OkDto] instance.
  OkDto({required this.ok});

  @JsonKey(name: r'ok', required: true, includeIfNull: false)
  final bool ok;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is OkDto &&
            runtimeType == other.runtimeType &&
            equals([ok], [other.ok]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([ok]);

  factory OkDto.fromJson(Map<String, dynamic> json) => _$OkDtoFromJson(json);

  Map<String, dynamic> toJson() => _$OkDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
