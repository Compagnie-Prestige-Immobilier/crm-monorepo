//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'callback_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CallbackDto {
  /// Returns a new [CallbackDto] instance.
  CallbackDto({

    required  this.id,

    required  this.prospectId,

    required  this.shortCode,

    required  this.phoneE164,

    required  this.scheduledAt,

    required  this.comment,

    required  this.assignedToId,

    required  this.assignedToName,

    required  this.overdue,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'prospectId',
    required: true,
    includeIfNull: false,
  )


  final String prospectId;



      /// Code court à six caractères du prospect.
  @JsonKey(
    
    name: r'shortCode',
    required: true,
    includeIfNull: false,
  )


  final String shortCode;



  @JsonKey(
    
    name: r'phoneE164',
    required: true,
    includeIfNull: false,
  )


  final String phoneE164;



  @JsonKey(
    
    name: r'scheduledAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime scheduledAt;



  @JsonKey(
    
    name: r'comment',
    required: true,
    includeIfNull: true,
  )


  final String? comment;



  @JsonKey(
    
    name: r'assignedToId',
    required: true,
    includeIfNull: false,
  )


  final String assignedToId;



  @JsonKey(
    
    name: r'assignedToName',
    required: true,
    includeIfNull: false,
  )


  final String assignedToName;



      /// Le rappel est passé. État DÉRIVÉ de scheduledAt et de l’heure du serveur, jamais stocké.
  @JsonKey(
    
    name: r'overdue',
    required: true,
    includeIfNull: false,
  )


  final bool overdue;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is CallbackDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            prospectId,
            shortCode,
            phoneE164,
            scheduledAt,
            comment,
            assignedToId,
            assignedToName,
            overdue,
        ],
        [
            other.id,
            other.prospectId,
            other.shortCode,
            other.phoneE164,
            other.scheduledAt,
            other.comment,
            other.assignedToId,
            other.assignedToName,
            other.overdue,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        prospectId,
        shortCode,
        phoneE164,
        scheduledAt,
        comment,
        assignedToId,
        assignedToName,
        overdue,
    ],);

  factory CallbackDto.fromJson(Map<String, dynamic> json) => _$CallbackDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CallbackDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

