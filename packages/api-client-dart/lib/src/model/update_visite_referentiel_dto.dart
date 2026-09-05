//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_visite_referentiel_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateVisiteReferentielDto {
  /// Returns a new [UpdateVisiteReferentielDto] instance.
  UpdateVisiteReferentielDto({

     this.label,

     this.sortOrder,
  });

  @JsonKey(
    
    name: r'label',
    required: false,
    includeIfNull: false,
  )


  final String? label;



  @JsonKey(
    
    name: r'sortOrder',
    required: false,
    includeIfNull: false,
  )


  final num? sortOrder;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is UpdateVisiteReferentielDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            label,
            sortOrder,
        ],
        [
            other.label,
            other.sortOrder,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        label,
        sortOrder,
    ],);

  factory UpdateVisiteReferentielDto.fromJson(Map<String, dynamic> json) => _$UpdateVisiteReferentielDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateVisiteReferentielDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

