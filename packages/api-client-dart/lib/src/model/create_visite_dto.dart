//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_visite_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateVisiteDto {
  /// Returns a new [CreateVisiteDto] instance.
  CreateVisiteDto({
    required this.date,

    this.time,

    required this.visitorName,

    this.phone,

    required this.entrepriseId,

    required this.objetId,

    this.directionId,

    this.destinataireId,

    this.comment,
  });

  @JsonKey(name: r'date', required: true, includeIfNull: false)
  final String date;

  /// Omise si elle n’a pas été relevée.
  @JsonKey(name: r'time', required: false, includeIfNull: false)
  final String? time;

  @JsonKey(name: r'visitorName', required: true, includeIfNull: false)
  final String visitorName;

  /// Accepté sous n’importe quelle forme, y compris étrangère ou incomplète.
  @JsonKey(name: r'phone', required: false, includeIfNull: false)
  final String? phone;

  @JsonKey(name: r'entrepriseId', required: true, includeIfNull: false)
  final String entrepriseId;

  @JsonKey(name: r'objetId', required: true, includeIfNull: false)
  final String objetId;

  @JsonKey(name: r'directionId', required: false, includeIfNull: false)
  final String? directionId;

  @JsonKey(name: r'destinataireId', required: false, includeIfNull: false)
  final String? destinataireId;

  @JsonKey(name: r'comment', required: false, includeIfNull: false)
  final String? comment;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateVisiteDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                date,
                time,
                visitorName,
                phone,
                entrepriseId,
                objetId,
                directionId,
                destinataireId,
                comment,
              ],
              [
                other.date,
                other.time,
                other.visitorName,
                other.phone,
                other.entrepriseId,
                other.objetId,
                other.directionId,
                other.destinataireId,
                other.comment,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        date,
        time,
        visitorName,
        phone,
        entrepriseId,
        objetId,
        directionId,
        destinataireId,
        comment,
      ]);

  factory CreateVisiteDto.fromJson(Map<String, dynamic> json) =>
      _$CreateVisiteDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateVisiteDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
