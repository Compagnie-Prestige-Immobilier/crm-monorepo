//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/lot_export_repartition_jour_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_repartition_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportRepartitionDto {
  /// Returns a new [LotExportRepartitionDto] instance.
  LotExportRepartitionDto({

    required  this.teleconseillerId,

    required  this.teleconseillerName,

    required  this.jours,
  });

  @JsonKey(
    
    name: r'teleconseillerId',
    required: true,
    includeIfNull: false,
  )


  final String teleconseillerId;



  @JsonKey(
    
    name: r'teleconseillerName',
    required: true,
    includeIfNull: false,
  )


  final String teleconseillerName;



  @JsonKey(
    
    name: r'jours',
    required: true,
    includeIfNull: false,
  )


  final List<LotExportRepartitionJourDto> jours;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is LotExportRepartitionDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            teleconseillerId,
            teleconseillerName,
            jours,
        ],
        [
            other.teleconseillerId,
            other.teleconseillerName,
            other.jours,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        teleconseillerId,
        teleconseillerName,
        jours,
    ],);

  factory LotExportRepartitionDto.fromJson(Map<String, dynamic> json) => _$LotExportRepartitionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportRepartitionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

