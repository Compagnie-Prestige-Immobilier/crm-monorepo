//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_reaffectation_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportReaffectationDto {
  /// Returns a new [LotExportReaffectationDto] instance.
  LotExportReaffectationDto({
    required this.id,

    required this.fromName,

    required this.toName,

    required this.fiches,

    required this.performedByName,

    required this.createdAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'fromName', required: true, includeIfNull: true)
  final String? fromName;

  @JsonKey(name: r'toName', required: true, includeIfNull: false)
  final String toName;

  @JsonKey(name: r'fiches', required: true, includeIfNull: false)
  final num fiches;

  @JsonKey(name: r'performedByName', required: true, includeIfNull: false)
  final String performedByName;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final String createdAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is LotExportReaffectationDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, fromName, toName, fiches, performedByName, createdAt],
              [
                other.id,
                other.fromName,
                other.toName,
                other.fiches,
                other.performedByName,
                other.createdAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        fromName,
        toName,
        fiches,
        performedByName,
        createdAt,
      ]);

  factory LotExportReaffectationDto.fromJson(Map<String, dynamic> json) =>
      _$LotExportReaffectationDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportReaffectationDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
