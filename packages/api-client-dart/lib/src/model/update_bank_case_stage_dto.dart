//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_bank_case_stage_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateBankCaseStageDto {
  /// Returns a new [UpdateBankCaseStageDto] instance.
  UpdateBankCaseStageDto({

     this.label,

     this.color,
  });

  @JsonKey(
    
    name: r'label',
    required: false,
    includeIfNull: false,
  )


  final String? label;



  @JsonKey(
    
    name: r'color',
    required: false,
    includeIfNull: false,
  )


  final String? color;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is UpdateBankCaseStageDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            label,
            color,
        ],
        [
            other.label,
            other.color,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        label,
        color,
    ],);

  factory UpdateBankCaseStageDto.fromJson(Map<String, dynamic> json) => _$UpdateBankCaseStageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateBankCaseStageDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

