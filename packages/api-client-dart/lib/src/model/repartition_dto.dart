//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'repartition_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepartitionDto {
  /// Returns a new [RepartitionDto] instance.
  RepartitionDto({
    required this.id,

    required this.label,

    required this.inscriptions,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'inscriptions', required: true, includeIfNull: false)
  final num inscriptions;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is RepartitionDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, label, inscriptions],
              [other.id, other.label, other.inscriptions],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([id, label, inscriptions]);

  factory RepartitionDto.fromJson(Map<String, dynamic> json) =>
      _$RepartitionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepartitionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
