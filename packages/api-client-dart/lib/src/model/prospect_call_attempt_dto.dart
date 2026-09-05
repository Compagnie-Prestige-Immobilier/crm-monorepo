//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/call_outcome.dart';
import 'package:crm_api_client/src/model/enrollment_method.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'prospect_call_attempt_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProspectCallAttemptDto {
  /// Returns a new [ProspectCallAttemptDto] instance.
  ProspectCallAttemptDto({

    required  this.id,

    required  this.outcome,

    required  this.reasonLabel,

    required  this.method,

    required  this.comment,

    required  this.email,

    required  this.fonctionnaire,

    required  this.engagementEnCours,

    required  this.dureeEtablissementMois,

    required  this.rendezVousAt,

    required  this.deviceCallType,

    required  this.deviceCallDurationSeconds,

    required  this.deviceCallAt,

    required  this.performedById,

    required  this.performedByName,

    required  this.clientCreatedAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'outcome',
    required: true,
    includeIfNull: false,
  unknownEnumValue: CallOutcome.unknownDefaultOpenApi,
  )


  final CallOutcome outcome;



      /// Libellé du motif choisi.
  @JsonKey(
    
    name: r'reasonLabel',
    required: true,
    includeIfNull: true,
  )


  final String? reasonLabel;



  @JsonKey(
    
    name: r'method',
    required: true,
    includeIfNull: true,
  unknownEnumValue: EnrollmentMethod.unknownDefaultOpenApi,
  )


  final EnrollmentMethod? method;



  @JsonKey(
    
    name: r'comment',
    required: true,
    includeIfNull: true,
  )


  final String? comment;



  @JsonKey(
    
    name: r'email',
    required: true,
    includeIfNull: true,
  )


  final String? email;



  @JsonKey(
    
    name: r'fonctionnaire',
    required: true,
    includeIfNull: true,
  )


  final bool? fonctionnaire;



  @JsonKey(
    
    name: r'engagementEnCours',
    required: true,
    includeIfNull: true,
  )


  final bool? engagementEnCours;



  @JsonKey(
    
    name: r'dureeEtablissementMois',
    required: true,
    includeIfNull: true,
  )


  final num? dureeEtablissementMois;



  @JsonKey(
    
    name: r'rendezVousAt',
    required: true,
    includeIfNull: true,
  )


  final DateTime? rendezVousAt;



  @JsonKey(
    
    name: r'deviceCallType',
    required: true,
    includeIfNull: true,
  )


  final String? deviceCallType;



  @JsonKey(
    
    name: r'deviceCallDurationSeconds',
    required: true,
    includeIfNull: true,
  )


  final num? deviceCallDurationSeconds;



  @JsonKey(
    
    name: r'deviceCallAt',
    required: true,
    includeIfNull: true,
  )


  final DateTime? deviceCallAt;



  @JsonKey(
    
    name: r'performedById',
    required: true,
    includeIfNull: false,
  )


  final String performedById;



  @JsonKey(
    
    name: r'performedByName',
    required: true,
    includeIfNull: false,
  )


  final String performedByName;



  @JsonKey(
    
    name: r'clientCreatedAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime clientCreatedAt;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is ProspectCallAttemptDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            outcome,
            reasonLabel,
            method,
            comment,
            email,
            fonctionnaire,
            engagementEnCours,
            dureeEtablissementMois,
            rendezVousAt,
            deviceCallType,
            deviceCallDurationSeconds,
            deviceCallAt,
            performedById,
            performedByName,
            clientCreatedAt,
        ],
        [
            other.id,
            other.outcome,
            other.reasonLabel,
            other.method,
            other.comment,
            other.email,
            other.fonctionnaire,
            other.engagementEnCours,
            other.dureeEtablissementMois,
            other.rendezVousAt,
            other.deviceCallType,
            other.deviceCallDurationSeconds,
            other.deviceCallAt,
            other.performedById,
            other.performedByName,
            other.clientCreatedAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        outcome,
        reasonLabel,
        method,
        comment,
        email,
        fonctionnaire,
        engagementEnCours,
        dureeEtablissementMois,
        rendezVousAt,
        deviceCallType,
        deviceCallDurationSeconds,
        deviceCallAt,
        performedById,
        performedByName,
        clientCreatedAt,
    ],);

  factory ProspectCallAttemptDto.fromJson(Map<String, dynamic> json) => _$ProspectCallAttemptDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ProspectCallAttemptDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

