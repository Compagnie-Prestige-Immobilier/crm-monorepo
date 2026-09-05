//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/import_row_preview_dto.dart';
import 'package:crm_api_client/src/model/import_row_error_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'import_report_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ImportReportDto {
  /// Returns a new [ImportReportDto] instance.
  ImportReportDto({

    required  this.dryRun,

    required  this.totalRows,

    required  this.valid,

    required  this.enrichable,

    required  this.enriched,

    required  this.rejected,

    required  this.duplicates,

    required  this.created,

    required  this.errors,

    required  this.preview,
  });

      /// Vrai si rien n’a été écrit. Le premier temps de l’import est TOUJOURS une simulation : appliquer 4 000 lignes sans les avoir vues ne se rattrape pas.
  @JsonKey(
    
    name: r'dryRun',
    required: true,
    includeIfNull: false,
  )


  final bool dryRun;



      /// Lignes de données lues, en-tête exclu.
  @JsonKey(
    
    name: r'totalRows',
    required: true,
    includeIfNull: false,
  )


  final num totalRows;



      /// Lignes retenues.
  @JsonKey(
    
    name: r'valid',
    required: true,
    includeIfNull: false,
  )


  final num valid;



      /// Fiches déjà en base à qui le fichier apporte quelque chose. Nul quand `enrichir` est faux.
  @JsonKey(
    
    name: r'enrichable',
    required: true,
    includeIfNull: false,
  )


  final num enrichable;



      /// Fiches existantes réellement complétées. Nul en simulation.
  @JsonKey(
    
    name: r'enriched',
    required: true,
    includeIfNull: false,
  )


  final num enriched;



      /// Lignes rejetées.
  @JsonKey(
    
    name: r'rejected',
    required: true,
    includeIfNull: false,
  )


  final num rejected;



      /// Doublons de téléphone : déjà en base, ou répétés à l’intérieur du fichier. Comptés dans `rejected`.
  @JsonKey(
    
    name: r'duplicates',
    required: true,
    includeIfNull: false,
  )


  final num duplicates;



      /// Représentants réellement créés. Toujours 0 en simulation.
  @JsonKey(
    
    name: r'created',
    required: true,
    includeIfNull: false,
  )


  final num created;



      /// Au plus 200 erreurs détaillées.
  @JsonKey(
    
    name: r'errors',
    required: true,
    includeIfNull: false,
  )


  final List<ImportRowErrorDto> errors;



      /// Au plus 50 lignes valides, pour la prévisualisation.
  @JsonKey(
    
    name: r'preview',
    required: true,
    includeIfNull: false,
  )


  final List<ImportRowPreviewDto> preview;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is ImportReportDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            dryRun,
            totalRows,
            valid,
            enrichable,
            enriched,
            rejected,
            duplicates,
            created,
            errors,
            preview,
        ],
        [
            other.dryRun,
            other.totalRows,
            other.valid,
            other.enrichable,
            other.enriched,
            other.rejected,
            other.duplicates,
            other.created,
            other.errors,
            other.preview,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        dryRun,
        totalRows,
        valid,
        enrichable,
        enriched,
        rejected,
        duplicates,
        created,
        errors,
        preview,
    ],);

  factory ImportReportDto.fromJson(Map<String, dynamic> json) => _$ImportReportDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ImportReportDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

