//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_referentiel_ref_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteReferentielRefDto {
  /// Returns a new [VisiteReferentielRefDto] instance.
  VisiteReferentielRefDto({

    required  this.id,

    required  this.code,

    required  this.label,
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




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is VisiteReferentielRefDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            code,
            label,
        ],
        [
            other.id,
            other.code,
            other.label,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        code,
        label,
    ],);

  factory VisiteReferentielRefDto.fromJson(Map<String, dynamic> json) => _$VisiteReferentielRefDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteReferentielRefDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

