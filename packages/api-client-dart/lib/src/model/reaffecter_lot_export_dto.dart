//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'reaffecter_lot_export_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReaffecterLotExportDto {
  /// Returns a new [ReaffecterLotExportDto] instance.
  ReaffecterLotExportDto({
    required this.positions,

    required this.versTeleconseillerId,
  });

  @JsonKey(name: r'positions', required: true, includeIfNull: false)
  final List<num> positions;

  @JsonKey(name: r'versTeleconseillerId', required: true, includeIfNull: false)
  final String versTeleconseillerId;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ReaffecterLotExportDto &&
            runtimeType == other.runtimeType &&
            equals(
              [positions, versTeleconseillerId],
              [other.positions, other.versTeleconseillerId],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([positions, versTeleconseillerId]);

  factory ReaffecterLotExportDto.fromJson(Map<String, dynamic> json) =>
      _$ReaffecterLotExportDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ReaffecterLotExportDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
