//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/visite_referentiel_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_referentiel_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteReferentielListDto {
  /// Returns a new [VisiteReferentielListDto] instance.
  VisiteReferentielListDto({

    required  this.items,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<VisiteReferentielDto> items;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is VisiteReferentielListDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            items,
        ],
        [
            other.items,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        items,
    ],);

  factory VisiteReferentielListDto.fromJson(Map<String, dynamic> json) => _$VisiteReferentielListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteReferentielListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

