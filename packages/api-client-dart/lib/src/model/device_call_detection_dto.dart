//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'device_call_detection_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DeviceCallDetectionDto {
  /// Returns a new [DeviceCallDetectionDto] instance.
  DeviceCallDetectionDto({

    required  this.id,

    required  this.performedById,

    required  this.performedByName,

    required  this.deviceCallType,

    required  this.deviceCallDurationSeconds,

    required  this.deviceCallAt,

    required  this.detectedAt,

    required  this.attemptId,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



      /// Le compte dont le téléphone a relevé l’appel.
  @JsonKey(
    
    name: r'performedById',
    required: true,
    includeIfNull: false,
  )


  final String performedById;



      /// Nom du téléconseiller.
  @JsonKey(
    
    name: r'performedByName',
    required: true,
    includeIfNull: false,
  )


  final String performedByName;



  @JsonKey(
    
    name: r'deviceCallType',
    required: true,
    includeIfNull: false,
  unknownEnumValue: DeviceCallDetectionDtoDeviceCallTypeEnum.unknownDefaultOpenApi,
  )


  final DeviceCallDetectionDtoDeviceCallTypeEnum deviceCallType;



      /// Durée en secondes lue au journal d’appels.
  @JsonKey(
    
    name: r'deviceCallDurationSeconds',
    required: true,
    includeIfNull: false,
  )


  final num deviceCallDurationSeconds;



      /// Heure de l’appel, telle que le journal la donne.
  @JsonKey(
    
    name: r'deviceCallAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime deviceCallAt;



      /// Heure à laquelle le téléphone a relevé l’appel.
  @JsonKey(
    
    name: r'detectedAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime detectedAt;



      /// La tentative qui consigne cet appel. `null` : appel non consigné.
  @JsonKey(
    
    name: r'attemptId',
    required: true,
    includeIfNull: true,
  )


  final String? attemptId;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is DeviceCallDetectionDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            performedById,
            performedByName,
            deviceCallType,
            deviceCallDurationSeconds,
            deviceCallAt,
            detectedAt,
            attemptId,
        ],
        [
            other.id,
            other.performedById,
            other.performedByName,
            other.deviceCallType,
            other.deviceCallDurationSeconds,
            other.deviceCallAt,
            other.detectedAt,
            other.attemptId,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        performedById,
        performedByName,
        deviceCallType,
        deviceCallDurationSeconds,
        deviceCallAt,
        detectedAt,
        attemptId,
    ],);

  factory DeviceCallDetectionDto.fromJson(Map<String, dynamic> json) => _$DeviceCallDetectionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DeviceCallDetectionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum DeviceCallDetectionDtoDeviceCallTypeEnum {
@JsonValue(r'sortant')
sortant(r'sortant'),
@JsonValue(r'entrant')
entrant(r'entrant'),
@JsonValue(r'manque')
manque(r'manque'),
@JsonValue(r'rejete')
rejete(r'rejete'),
@JsonValue(r'bloque')
bloque(r'bloque'),
@JsonValue(r'messagerie')
messagerie(r'messagerie'),
@JsonValue(r'externe')
externe(r'externe'),
@JsonValue(r'inconnu')
inconnu(r'inconnu'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const DeviceCallDetectionDtoDeviceCallTypeEnum(this.value);

final String value;

@override
String toString() => value;
}


