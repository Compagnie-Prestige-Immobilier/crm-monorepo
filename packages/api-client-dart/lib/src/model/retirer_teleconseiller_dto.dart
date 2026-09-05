//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'retirer_teleconseiller_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RetirerTeleconseillerDto {
  /// Returns a new [RetirerTeleconseillerDto] instance.
  RetirerTeleconseillerDto({required this.teleconseillerId});

  @JsonKey(name: r'teleconseillerId', required: true, includeIfNull: false)
  final String teleconseillerId;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RetirerTeleconseillerDto &&
            runtimeType == other.runtimeType &&
            equals([teleconseillerId], [other.teleconseillerId]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([teleconseillerId]);

  factory RetirerTeleconseillerDto.fromJson(Map<String, dynamic> json) =>
      _$RetirerTeleconseillerDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RetirerTeleconseillerDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
