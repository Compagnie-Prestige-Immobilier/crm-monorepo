//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'named_count_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NamedCountDto {
  /// Returns a new [NamedCountDto] instance.
  NamedCountDto({

    required  this.id,

    required  this.label,

    required  this.prospects,

    required  this.share,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: true,
  )


  final String? id;



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
      other is NamedCountDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            label,
            prospects,
            share,
        ],
        [
            other.id,
            other.label,
            other.prospects,
            other.share,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        label,
        prospects,
        share,
    ],);

  factory NamedCountDto.fromJson(Map<String, dynamic> json) => _$NamedCountDtoFromJson(json);

  Map<String, dynamic> toJson() => _$NamedCountDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

