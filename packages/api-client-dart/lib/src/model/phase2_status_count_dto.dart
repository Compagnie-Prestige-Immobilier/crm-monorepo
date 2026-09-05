//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/phase2_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'phase2_status_count_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Phase2StatusCountDto {
  /// Returns a new [Phase2StatusCountDto] instance.
  Phase2StatusCountDto({

    required  this.status,

    required  this.label,

    required  this.prospects,

    required  this.share,
  });

  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  unknownEnumValue: Phase2Status.unknownDefaultOpenApi,
  )


  final Phase2Status status;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'prospects',
    required: true,
    includeIfNull: false,
  )


  final num prospects;



      /// Part du total filtré, en pourcentage.
  @JsonKey(
    
    name: r'share',
    required: true,
    includeIfNull: false,
  )


  final num share;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is Phase2StatusCountDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            status,
            label,
            prospects,
            share,
        ],
        [
            other.status,
            other.label,
            other.prospects,
            other.share,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        status,
        label,
        prospects,
        share,
    ],);

  factory Phase2StatusCountDto.fromJson(Map<String, dynamic> json) => _$Phase2StatusCountDtoFromJson(json);

  Map<String, dynamic> toJson() => _$Phase2StatusCountDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

