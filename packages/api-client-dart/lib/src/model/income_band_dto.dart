//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'income_band_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class IncomeBandDto {
  /// Returns a new [IncomeBandDto] instance.
  IncomeBandDto({

    required  this.id,

    required  this.code,

    required  this.label,

    required  this.minXof,

    required  this.maxXof,

    required  this.position,

    required  this.isActive,

    required  this.updatedAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



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
    
    name: r'minXof',
    required: true,
    includeIfNull: true,
  )


  final num? minXof;



  @JsonKey(
    
    name: r'maxXof',
    required: true,
    includeIfNull: true,
  )


  final num? maxXof;



  @JsonKey(
    
    name: r'position',
    required: true,
    includeIfNull: false,
  )


  final num position;



  @JsonKey(
    
    name: r'isActive',
    required: true,
    includeIfNull: false,
  )


  final bool isActive;



  @JsonKey(
    
    name: r'updatedAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime updatedAt;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is IncomeBandDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            code,
            label,
            minXof,
            maxXof,
            position,
            isActive,
            updatedAt,
        ],
        [
            other.id,
            other.code,
            other.label,
            other.minXof,
            other.maxXof,
            other.position,
            other.isActive,
            other.updatedAt,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        code,
        label,
        minXof,
        maxXof,
        position,
        isActive,
        updatedAt,
    ],);

  factory IncomeBandDto.fromJson(Map<String, dynamic> json) => _$IncomeBandDtoFromJson(json);

  Map<String, dynamic> toJson() => _$IncomeBandDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

