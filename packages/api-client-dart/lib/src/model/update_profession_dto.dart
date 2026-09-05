//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_profession_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateProfessionDto {
  /// Returns a new [UpdateProfessionDto] instance.
  UpdateProfessionDto({

     this.code,

     this.label,

     this.isTeaching = false,

     this.position,

     this.isActive = true,
  });

  @JsonKey(
    
    name: r'code',
    required: false,
    includeIfNull: false,
  )


  final String? code;



  @JsonKey(
    
    name: r'label',
    required: false,
    includeIfNull: false,
  )


  final String? label;



  @JsonKey(
    defaultValue: false,
    name: r'isTeaching',
    required: false,
    includeIfNull: false,
  )


  final bool? isTeaching;



          // minimum: 0
          // maximum: 9999
  @JsonKey(
    
    name: r'position',
    required: false,
    includeIfNull: false,
  )


  final num? position;



  @JsonKey(
    defaultValue: true,
    name: r'isActive',
    required: false,
    includeIfNull: false,
  )


  final bool? isActive;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is UpdateProfessionDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            code,
            label,
            isTeaching,
            position,
            isActive,
        ],
        [
            other.code,
            other.label,
            other.isTeaching,
            other.position,
            other.isActive,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        code,
        label,
        isTeaching,
        position,
        isActive,
    ],);

  factory UpdateProfessionDto.fromJson(Map<String, dynamic> json) => _$UpdateProfessionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateProfessionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

