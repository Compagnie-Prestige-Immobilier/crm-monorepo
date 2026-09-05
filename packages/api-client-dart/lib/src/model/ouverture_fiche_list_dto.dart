//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/ouverture_fiche_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'ouverture_fiche_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OuvertureFicheListDto {
  /// Returns a new [OuvertureFicheListDto] instance.
  OuvertureFicheListDto({

    required  this.items,
  });

      /// De la plus ancienne à la plus récente.
  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<OuvertureFicheDto> items;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is OuvertureFicheListDto &&
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

  factory OuvertureFicheListDto.fromJson(Map<String, dynamic> json) => _$OuvertureFicheListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$OuvertureFicheListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

