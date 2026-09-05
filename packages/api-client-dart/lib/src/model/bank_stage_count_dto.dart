//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bank_stage_type.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_stage_count_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankStageCountDto {
  /// Returns a new [BankStageCountDto] instance.
  BankStageCountDto({

    required  this.stageId,

    required  this.code,

    required  this.label,

    required  this.color,

    required  this.type,

    required  this.cases,

    required  this.share,
  });

  @JsonKey(
    
    name: r'stageId',
    required: true,
    includeIfNull: false,
  )


  final String stageId;



  @JsonKey(
    
    name: r'code',
    required: true,
    includeIfNull: false,
  )


  final String code;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'color',
    required: true,
    includeIfNull: false,
  )


  final String color;



  @JsonKey(
    
    name: r'type',
    required: true,
    includeIfNull: false,
  unknownEnumValue: BankStageType.unknownDefaultOpenApi,
  )


  final BankStageType type;



  @JsonKey(
    
    name: r'cases',
    required: true,
    includeIfNull: false,
  )


  final num cases;



  @JsonKey(
    
    name: r'share',
    required: true,
    includeIfNull: false,
  )


  final num share;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is BankStageCountDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            stageId,
            code,
            label,
            color,
            type,
            cases,
            share,
        ],
        [
            other.stageId,
            other.code,
            other.label,
            other.color,
            other.type,
            other.cases,
            other.share,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        stageId,
        code,
        label,
        color,
        type,
        cases,
        share,
    ],);

  factory BankStageCountDto.fromJson(Map<String, dynamic> json) => _$BankStageCountDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankStageCountDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

