//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_canal_provenance_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateCanalProvenanceDto {
  /// Returns a new [CreateCanalProvenanceDto] instance.
  CreateCanalProvenanceDto({

    required  this.code,

    required  this.label,

     this.position,
  });

      /// Immuable une fois posé.
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



          // minimum: 0
          // maximum: 9999
  @JsonKey(
    
    name: r'position',
    required: false,
    includeIfNull: false,
  )


  final num? position;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is CreateCanalProvenanceDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            code,
            label,
            position,
        ],
        [
            other.code,
            other.label,
            other.position,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        code,
        label,
        position,
    ],);

  factory CreateCanalProvenanceDto.fromJson(Map<String, dynamic> json) => _$CreateCanalProvenanceDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateCanalProvenanceDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

