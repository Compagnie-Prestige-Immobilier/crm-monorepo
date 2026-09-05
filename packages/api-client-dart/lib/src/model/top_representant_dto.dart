//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'top_representant_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TopRepresentantDto {
  /// Returns a new [TopRepresentantDto] instance.
  TopRepresentantDto({

    required  this.id,

    required  this.label,

    required  this.phoneE164,

    required  this.departementName,

    required  this.commercialName,

    required  this.prospects,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'phoneE164',
    required: true,
    includeIfNull: false,
  )


  final String phoneE164;



  @JsonKey(
    
    name: r'departementName',
    required: true,
    includeIfNull: false,
  )


  final String departementName;



  @JsonKey(
    
    name: r'commercialName',
    required: true,
    includeIfNull: false,
  )


  final String commercialName;



  @JsonKey(
    
    name: r'prospects',
    required: true,
    includeIfNull: false,
  )


  final num prospects;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is TopRepresentantDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            label,
            phoneE164,
            departementName,
            commercialName,
            prospects,
        ],
        [
            other.id,
            other.label,
            other.phoneE164,
            other.departementName,
            other.commercialName,
            other.prospects,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        label,
        phoneE164,
        departementName,
        commercialName,
        prospects,
    ],);

  factory TopRepresentantDto.fromJson(Map<String, dynamic> json) => _$TopRepresentantDtoFromJson(json);

  Map<String, dynamic> toJson() => _$TopRepresentantDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

