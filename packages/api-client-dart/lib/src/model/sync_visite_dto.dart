//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/visite_referentiel_ref_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_visite_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncVisiteDto {
  /// Returns a new [SyncVisiteDto] instance.
  SyncVisiteDto({

    required  this.id,

    required  this.reference,

    required  this.date,

    required  this.time,

    required  this.visitorName,

    required  this.phone,

    required  this.phoneE164,

    required  this.entreprise,

    required  this.objet,

    required  this.direction,

    required  this.destinataire,

    required  this.comment,

    required  this.createdById,

    required  this.createdAt,

    required  this.updatedAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'reference',
    required: true,
    includeIfNull: false,
  )


  final String reference;



  @JsonKey(
    
    name: r'date',
    required: true,
    includeIfNull: false,
  )


  final String date;



  @JsonKey(
    
    name: r'time',
    required: true,
    includeIfNull: true,
  )


  final String? time;



  @JsonKey(
    
    name: r'visitorName',
    required: true,
    includeIfNull: false,
  )


  final String visitorName;



  @JsonKey(
    
    name: r'phone',
    required: true,
    includeIfNull: true,
  )


  final String? phone;



  @JsonKey(
    
    name: r'phoneE164',
    required: true,
    includeIfNull: true,
  )


  final String? phoneE164;



  @JsonKey(
    
    name: r'entreprise',
    required: true,
    includeIfNull: false,
  )


  final VisiteReferentielRefDto entreprise;



  @JsonKey(
    
    name: r'objet',
    required: true,
    includeIfNull: false,
  )


  final VisiteReferentielRefDto objet;



  @JsonKey(
    
    name: r'direction',
    required: true,
    includeIfNull: true,
  )


  final VisiteReferentielRefDto? direction;



  @JsonKey(
    
    name: r'destinataire',
    required: true,
    includeIfNull: true,
  )


  final VisiteReferentielRefDto? destinataire;



  @JsonKey(
    
    name: r'comment',
    required: true,
    includeIfNull: true,
  )


  final String? comment;



  @JsonKey(
    
    name: r'createdById',
    required: true,
    includeIfNull: false,
  )


  final String createdById;



  @JsonKey(
    
    name: r'createdAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime createdAt;



  @JsonKey(
    
    name: r'updatedAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime updatedAt;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SyncVisiteDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            reference,
            date,
            time,
            visitorName,
            phone,
            phoneE164,
            entreprise,
            objet,
            direction,
            destinataire,
            comment,
            createdById,
            createdAt,
            updatedAt,
        ],
        [
            other.id,
            other.reference,
            other.date,
            other.time,
            other.visitorName,
            other.phone,
            other.phoneE164,
            other.entreprise,
            other.objet,
            other.direction,
            other.destinataire,
            other.comment,
            other.createdById,
            other.createdAt,
            other.updatedAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        reference,
        date,
        time,
        visitorName,
        phone,
        phoneE164,
        entreprise,
        objet,
        direction,
        destinataire,
        comment,
        createdById,
        createdAt,
        updatedAt,
    ],);

  factory SyncVisiteDto.fromJson(Map<String, dynamic> json) => _$SyncVisiteDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncVisiteDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

