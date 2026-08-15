//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'import_row_preview_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ImportRowPreviewDto {
  /// Returns a new [ImportRowPreviewDto] instance.
  ImportRowPreviewDto({
    required this.line,

    required this.fullName,

    required this.phoneE164,

    required this.departementName,

    required this.iefName,

    required this.notes,
  });

  @JsonKey(name: r'line', required: true, includeIfNull: false)
  final num line;

  @JsonKey(name: r'fullName', required: true, includeIfNull: false)
  final String fullName;

  /// Téléphone normalisé E.164 par le serveur.
  @JsonKey(name: r'phoneE164', required: true, includeIfNull: false)
  final String phoneE164;

  @JsonKey(name: r'departementName', required: true, includeIfNull: false)
  final String departementName;

  @JsonKey(name: r'iefName', required: true, includeIfNull: true)
  final String? iefName;

  @JsonKey(name: r'notes', required: true, includeIfNull: true)
  final String? notes;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ImportRowPreviewDto &&
            runtimeType == other.runtimeType &&
            equals(
              [line, fullName, phoneE164, departementName, iefName, notes],
              [
                other.line,
                other.fullName,
                other.phoneE164,
                other.departementName,
                other.iefName,
                other.notes,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        line,
        fullName,
        phoneE164,
        departementName,
        iefName,
        notes,
      ]);

  factory ImportRowPreviewDto.fromJson(Map<String, dynamic> json) =>
      _$ImportRowPreviewDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ImportRowPreviewDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
