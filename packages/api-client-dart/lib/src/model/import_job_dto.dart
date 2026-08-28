//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/import_kind.dart';
import 'package:crm_api_client/src/model/import_mode.dart';
import 'package:crm_api_client/src/model/import_job_report_dto.dart';
import 'package:crm_api_client/src/model/import_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'import_job_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ImportJobDto {
  /// Returns a new [ImportJobDto] instance.
  ImportJobDto({
    required this.id,

    required this.kind,

    required this.status,

    required this.mode,

    required this.requestedById,

    required this.fileName,

    required this.fileBytes,

    required this.totalRows,

    required this.processedRows,

    required this.createdRows,

    required this.updatedRows,

    required this.skippedRows,

    required this.errorRows,

    required this.report,

    required this.failureCode,

    required this.failureMsg,

    required this.startedAt,

    required this.finishedAt,

    required this.expiresAt,

    required this.createdAt,

    required this.updatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(
    name: r'kind',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ImportKind.unknownDefaultOpenApi,
  )
  final ImportKind kind;

  /// `queued` : le travail attend un travailleur. `running` : il court, `processedRows` avance. `succeeded` : terminé, le rapport est là. `failed` : le motif est dans `failureCode`. `expired` : le fichier déposé et le rapport ont été détruits à l’échéance ; ce n’est pas une erreur.
  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ImportStatus.unknownDefaultOpenApi,
  )
  final ImportStatus status;

  /// DRY_RUN simule et n’écrit rien. APPLY écrit. Un import naît TOUJOURS en DRY_RUN : appliquer cinquante mille lignes sans les avoir vues ne se rattrape pas.
  @JsonKey(
    name: r'mode',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ImportMode.unknownDefaultOpenApi,
  )
  final ImportMode mode;

  @JsonKey(name: r'requestedById', required: true, includeIfNull: false)
  final String requestedById;

  /// Nom du fichier tel que téléversé. JAMAIS utilisé comme chemin.
  @JsonKey(name: r'fileName', required: true, includeIfNull: false)
  final String fileName;

  @JsonKey(name: r'fileBytes', required: true, includeIfNull: false)
  final num fileBytes;

  /// Dénominateur de l’avancement. NUL tant que le travail n’a pas lu l’en-tête du classeur, et nul aussi quand la feuille ne déclare pas ses dimensions.
  @JsonKey(name: r'totalRows', required: true, includeIfNull: true)
  final num? totalRows;

  @JsonKey(name: r'processedRows', required: true, includeIfNull: false)
  final num processedRows;

  @JsonKey(name: r'createdRows', required: true, includeIfNull: false)
  final num createdRows;

  /// Lignes RÉÉCRITES. Seul l’aller-retour Excel du registre des visites en produit.
  @JsonKey(name: r'updatedRows', required: true, includeIfNull: false)
  final num updatedRows;

  @JsonKey(name: r'skippedRows', required: true, includeIfNull: false)
  final num skippedRows;

  @JsonKey(name: r'errorRows', required: true, includeIfNull: false)
  final num errorRows;

  @JsonKey(name: r'report', required: true, includeIfNull: true)
  final ImportJobReportDto? report;

  @JsonKey(name: r'failureCode', required: true, includeIfNull: true)
  final String? failureCode;

  @JsonKey(name: r'failureMsg', required: true, includeIfNull: true)
  final String? failureMsg;

  @JsonKey(name: r'startedAt', required: true, includeIfNull: true)
  final DateTime? startedAt;

  @JsonKey(name: r'finishedAt', required: true, includeIfNull: true)
  final DateTime? finishedAt;

  /// Au-delà, le classeur déposé et le rapport sont détruits.
  @JsonKey(name: r'expiresAt', required: true, includeIfNull: false)
  final DateTime expiresAt;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ImportJobDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                kind,
                status,
                mode,
                requestedById,
                fileName,
                fileBytes,
                totalRows,
                processedRows,
                createdRows,
                updatedRows,
                skippedRows,
                errorRows,
                report,
                failureCode,
                failureMsg,
                startedAt,
                finishedAt,
                expiresAt,
                createdAt,
                updatedAt,
              ],
              [
                other.id,
                other.kind,
                other.status,
                other.mode,
                other.requestedById,
                other.fileName,
                other.fileBytes,
                other.totalRows,
                other.processedRows,
                other.createdRows,
                other.updatedRows,
                other.skippedRows,
                other.errorRows,
                other.report,
                other.failureCode,
                other.failureMsg,
                other.startedAt,
                other.finishedAt,
                other.expiresAt,
                other.createdAt,
                other.updatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        kind,
        status,
        mode,
        requestedById,
        fileName,
        fileBytes,
        totalRows,
        processedRows,
        createdRows,
        updatedRows,
        skippedRows,
        errorRows,
        report,
        failureCode,
        failureMsg,
        startedAt,
        finishedAt,
        expiresAt,
        createdAt,
        updatedAt,
      ]);

  factory ImportJobDto.fromJson(Map<String, dynamic> json) =>
      _$ImportJobDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ImportJobDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
