//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/visite_import_change_field_dto.dart';
import 'package:crm_api_client/src/model/visite_import_change_kind.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_import_change_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteImportChangeDto {
  /// Returns a new [VisiteImportChangeDto] instance.
  VisiteImportChangeDto({

    required  this.id,

    required  this.sheet,

    required  this.rowNumber,

    required  this.kind,

    required  this.reference,

    required  this.visiteId,

    required  this.label,

    required  this.fields,

    required  this.selected,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'sheet',
    required: true,
    includeIfNull: false,
  )


  final String sheet;



  @JsonKey(
    
    name: r'rowNumber',
    required: true,
    includeIfNull: false,
  )


  final num rowNumber;



  @JsonKey(
    
    name: r'kind',
    required: true,
    includeIfNull: false,
  unknownEnumValue: VisiteImportChangeKind.unknownDefaultOpenApi,
  )


  final VisiteImportChangeKind kind;



      /// Nul pour une création.
  @JsonKey(
    
    name: r'reference',
    required: true,
    includeIfNull: true,
  )


  final String? reference;



  @JsonKey(
    
    name: r'visiteId',
    required: true,
    includeIfNull: true,
  )


  final String? visiteId;



      /// « MME LY SEYNABOU, 12/08 14:30 », sans avoir à relire la visite.
  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'fields',
    required: true,
    includeIfNull: false,
  )


  final List<VisiteImportChangeFieldDto> fields;



      /// Coché par défaut : décocher retire la ligne de l’application.
  @JsonKey(
    
    name: r'selected',
    required: true,
    includeIfNull: false,
  )


  final bool selected;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is VisiteImportChangeDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            sheet,
            rowNumber,
            kind,
            reference,
            visiteId,
            label,
            fields,
            selected,
        ],
        [
            other.id,
            other.sheet,
            other.rowNumber,
            other.kind,
            other.reference,
            other.visiteId,
            other.label,
            other.fields,
            other.selected,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        sheet,
        rowNumber,
        kind,
        reference,
        visiteId,
        label,
        fields,
        selected,
    ],);

  factory VisiteImportChangeDto.fromJson(Map<String, dynamic> json) => _$VisiteImportChangeDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteImportChangeDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

