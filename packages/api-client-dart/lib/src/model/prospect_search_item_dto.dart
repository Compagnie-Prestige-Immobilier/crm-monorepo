//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'prospect_search_item_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProspectSearchItemDto {
  /// Returns a new [ProspectSearchItemDto] instance.
  ProspectSearchItemDto({

    required  this.id,

    required  this.nom,

    required  this.prenom,

    required  this.fullName,

    required  this.phoneE164,

    required  this.banqueId,

    required  this.banqueName,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'nom',
    required: true,
    includeIfNull: false,
  )


  final String nom;



  @JsonKey(
    
    name: r'prenom',
    required: true,
    includeIfNull: false,
  )


  final String prenom;



      /// Nom complet, tel qu’il sera copié sur le dossier.
  @JsonKey(
    
    name: r'fullName',
    required: true,
    includeIfNull: false,
  )


  final String fullName;



  @JsonKey(
    
    name: r'phoneE164',
    required: true,
    includeIfNull: false,
  )


  final String phoneE164;



  @JsonKey(
    
    name: r'banqueId',
    required: true,
    includeIfNull: false,
  )


  final String banqueId;



  @JsonKey(
    
    name: r'banqueName',
    required: true,
    includeIfNull: false,
  )


  final String banqueName;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is ProspectSearchItemDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            nom,
            prenom,
            fullName,
            phoneE164,
            banqueId,
            banqueName,
        ],
        [
            other.id,
            other.nom,
            other.prenom,
            other.fullName,
            other.phoneE164,
            other.banqueId,
            other.banqueName,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        nom,
        prenom,
        fullName,
        phoneE164,
        banqueId,
        banqueName,
    ],);

  factory ProspectSearchItemDto.fromJson(Map<String, dynamic> json) => _$ProspectSearchItemDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ProspectSearchItemDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

