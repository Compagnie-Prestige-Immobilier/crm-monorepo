//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_objectif_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportObjectifDto {
  /// Returns a new [LotExportObjectifDto] instance.
  LotExportObjectifDto({
    required this.teleconseillerId,

    required this.fichesParJour,
  });

  @JsonKey(name: r'teleconseillerId', required: true, includeIfNull: false)
  final String teleconseillerId;

  // minimum: 1
  // maximum: 500
  @JsonKey(name: r'fichesParJour', required: true, includeIfNull: false)
  final num fichesParJour;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is LotExportObjectifDto &&
            runtimeType == other.runtimeType &&
            equals(
              [teleconseillerId, fichesParJour],
              [other.teleconseillerId, other.fichesParJour],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([teleconseillerId, fichesParJour]);

  factory LotExportObjectifDto.fromJson(Map<String, dynamic> json) =>
      _$LotExportObjectifDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportObjectifDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
