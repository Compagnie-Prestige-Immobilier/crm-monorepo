//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_canal_provenance_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateCanalProvenanceDto {
  /// Returns a new [UpdateCanalProvenanceDto] instance.
  UpdateCanalProvenanceDto({

     this.label,

     this.position,

     this.isActive,
  });

  @JsonKey(
    
    name: r'label',
    required: false,
    includeIfNull: false,
  )


  final String? label;



          // minimum: 0
          // maximum: 9999
  @JsonKey(
    
    name: r'position',
    required: false,
    includeIfNull: false,
  )


  final num? position;



      /// Le retirer des listes, jamais le supprimer.
  @JsonKey(
    
    name: r'isActive',
    required: false,
    includeIfNull: false,
  )


  final bool? isActive;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is UpdateCanalProvenanceDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            label,
            position,
            isActive,
        ],
        [
            other.label,
            other.position,
            other.isActive,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        label,
        position,
        isActive,
    ],);

  factory UpdateCanalProvenanceDto.fromJson(Map<String, dynamic> json) => _$UpdateCanalProvenanceDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateCanalProvenanceDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

