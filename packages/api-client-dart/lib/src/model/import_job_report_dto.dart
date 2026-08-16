//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/import_kind.dart';
import 'package:crm_api_client/src/model/import_mode.dart';
import 'package:crm_api_client/src/model/import_job_error_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'import_job_report_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ImportJobReportDto {
  /// Returns a new [ImportJobReportDto] instance.
  ImportJobReportDto({
    required this.kind,

    required this.mode,

    required this.totalRows,

    required this.processedRows,

    required this.createdRows,

    required this.skippedRows,

    required this.errorRows,

    required this.truncated,

    required this.maxReportedErrors,

    required this.errors,
  });

  @JsonKey(
    name: r'kind',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ImportKind.unknownDefaultOpenApi,
  )
  final ImportKind kind;

  /// Le mode sous lequel ce rapport a été produit. En DRY_RUN, `createdRows` compte les lignes qui SERAIENT créées ; rien n’a été écrit.
  @JsonKey(
    name: r'mode',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ImportMode.unknownDefaultOpenApi,
  )
  final ImportMode mode;

  /// Lignes de données lues, en-tête et exemple exclus.
  @JsonKey(name: r'totalRows', required: true, includeIfNull: false)
  final num totalRows;

  @JsonKey(name: r'processedRows', required: true, includeIfNull: false)
  final num processedRows;

  @JsonKey(name: r'createdRows', required: true, includeIfNull: false)
  final num createdRows;

  /// Lignes écartées : doublons dans le fichier, ou déjà présentes en base.
  @JsonKey(name: r'skippedRows', required: true, includeIfNull: false)
  final num skippedRows;

  /// Lignes refusées à l’analyse. Compte EXACT.
  @JsonKey(name: r'errorRows', required: true, includeIfNull: false)
  final num errorRows;

  /// Vrai quand `errors` ne montre qu’une partie des refus. Le compteur `errorRows`, lui, reste exact.
  @JsonKey(name: r'truncated', required: true, includeIfNull: false)
  final bool truncated;

  /// Longueur maximale de `errors`.
  @JsonKey(name: r'maxReportedErrors', required: true, includeIfNull: false)
  final num maxReportedErrors;

  @JsonKey(name: r'errors', required: true, includeIfNull: false)
  final List<ImportJobErrorDto> errors;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ImportJobReportDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                kind,
                mode,
                totalRows,
                processedRows,
                createdRows,
                skippedRows,
                errorRows,
                truncated,
                maxReportedErrors,
                errors,
              ],
              [
                other.kind,
                other.mode,
                other.totalRows,
                other.processedRows,
                other.createdRows,
                other.skippedRows,
                other.errorRows,
                other.truncated,
                other.maxReportedErrors,
                other.errors,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        kind,
        mode,
        totalRows,
        processedRows,
        createdRows,
        skippedRows,
        errorRows,
        truncated,
        maxReportedErrors,
        errors,
      ]);

  factory ImportJobReportDto.fromJson(Map<String, dynamic> json) =>
      _$ImportJobReportDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ImportJobReportDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
