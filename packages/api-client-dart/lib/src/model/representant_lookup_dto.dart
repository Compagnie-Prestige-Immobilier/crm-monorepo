//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/representant_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_lookup_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantLookupDto {
  /// Returns a new [RepresentantLookupDto] instance.
  RepresentantLookupDto({

    required  this.found,

    required  this.phoneE164,

    required  this.representant,

    required  this.ownedByCommercialName,

    required  this.ownedByCommercialId,
  });

  @JsonKey(
    
    name: r'found',
    required: true,
    includeIfNull: false,
  )


  final bool found;



      /// Le numéro tel que normalisé par le serveur.
  @JsonKey(
    
    name: r'phoneE164',
    required: true,
    includeIfNull: false,
  )


  final String phoneE164;



  @JsonKey(
    
    name: r'representant',
    required: true,
    includeIfNull: true,
  )


  final RepresentantDto? representant;



      /// Nom du commercial propriétaire de la fiche, pour que le mobile puisse dire à qui s’adresser.
  @JsonKey(
    
    name: r'ownedByCommercialName',
    required: true,
    includeIfNull: true,
  )


  final String? ownedByCommercialName;



  @JsonKey(
    
    name: r'ownedByCommercialId',
    required: true,
    includeIfNull: true,
  )


  final String? ownedByCommercialId;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is RepresentantLookupDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            found,
            phoneE164,
            representant,
            ownedByCommercialName,
            ownedByCommercialId,
        ],
        [
            other.found,
            other.phoneE164,
            other.representant,
            other.ownedByCommercialName,
            other.ownedByCommercialId,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        found,
        phoneE164,
        representant,
        ownedByCommercialName,
        ownedByCommercialId,
    ],);

  factory RepresentantLookupDto.fromJson(Map<String, dynamic> json) => _$RepresentantLookupDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantLookupDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

