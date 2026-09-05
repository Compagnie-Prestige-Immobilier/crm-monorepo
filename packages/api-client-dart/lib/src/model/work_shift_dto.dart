//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'work_shift_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class WorkShiftDto {
  /// Returns a new [WorkShiftDto] instance.
  WorkShiftDto({

    required  this.key,

    required  this.label,

    required  this.start,

    required  this.end,
  });

  @JsonKey(
    
    name: r'key',
    required: true,
    includeIfNull: false,
  unknownEnumValue: WorkShiftDtoKeyEnum.unknownDefaultOpenApi,
  )


  final WorkShiftDtoKeyEnum key;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'start',
    required: true,
    includeIfNull: false,
  )


  final String start;



  @JsonKey(
    
    name: r'end',
    required: true,
    includeIfNull: false,
  )


  final String end;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is WorkShiftDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            key,
            label,
            start,
            end,
        ],
        [
            other.key,
            other.label,
            other.start,
            other.end,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        key,
        label,
        start,
        end,
    ],);

  factory WorkShiftDto.fromJson(Map<String, dynamic> json) => _$WorkShiftDtoFromJson(json);

  Map<String, dynamic> toJson() => _$WorkShiftDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum WorkShiftDtoKeyEnum {
@JsonValue(r'morning')
morning(r'morning'),
@JsonValue(r'afternoon')
afternoon(r'afternoon'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const WorkShiftDtoKeyEnum(this.value);

final String value;

@override
String toString() => value;
}


