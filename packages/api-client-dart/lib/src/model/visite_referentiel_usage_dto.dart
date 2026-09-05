//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/visite_referentiel_usage_entry_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_referentiel_usage_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteReferentielUsageDto {
  /// Returns a new [VisiteReferentielUsageDto] instance.
  VisiteReferentielUsageDto({

    required  this.entreprises,

    required  this.directions,

    required  this.destinataires,

    required  this.objets,
  });

  @JsonKey(
    
    name: r'entreprises',
    required: true,
    includeIfNull: false,
  )


  final List<VisiteReferentielUsageEntryDto> entreprises;



  @JsonKey(
    
    name: r'directions',
    required: true,
    includeIfNull: false,
  )


  final List<VisiteReferentielUsageEntryDto> directions;



  @JsonKey(
    
    name: r'destinataires',
    required: true,
    includeIfNull: false,
  )


  final List<VisiteReferentielUsageEntryDto> destinataires;



  @JsonKey(
    
    name: r'objets',
    required: true,
    includeIfNull: false,
  )


  final List<VisiteReferentielUsageEntryDto> objets;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is VisiteReferentielUsageDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            entreprises,
            directions,
            destinataires,
            objets,
        ],
        [
            other.entreprises,
            other.directions,
            other.destinataires,
            other.objets,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        entreprises,
        directions,
        destinataires,
        objets,
    ],);

  factory VisiteReferentielUsageDto.fromJson(Map<String, dynamic> json) => _$VisiteReferentielUsageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteReferentielUsageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

