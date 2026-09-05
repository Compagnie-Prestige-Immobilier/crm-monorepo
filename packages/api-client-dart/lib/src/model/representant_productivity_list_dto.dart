//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/representant_productivity_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'representant_productivity_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RepresentantProductivityListDto {
  /// Returns a new [RepresentantProductivityListDto] instance.
  RepresentantProductivityListDto({

    required  this.items,

    required  this.total,

    required  this.dormantDays,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<RepresentantProductivityDto> items;



      /// Prospects apportés par TOUS les représentants du périmètre filtré, et non seulement par les `items` rendus. `items` est tronqué par `limit` : sommer ses lignes donnerait le total du haut de classement sous un nom qui se lit comme un total de population.
  @JsonKey(
    
    name: r'total',
    required: true,
    includeIfNull: false,
  )


  final num total;



      /// Seuil de dormance retenu, en jours.
  @JsonKey(
    
    name: r'dormantDays',
    required: true,
    includeIfNull: false,
  )


  final num dormantDays;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is RepresentantProductivityListDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            items,
            total,
            dormantDays,
        ],
        [
            other.items,
            other.total,
            other.dormantDays,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        items,
        total,
        dormantDays,
    ],);

  factory RepresentantProductivityListDto.fromJson(Map<String, dynamic> json) => _$RepresentantProductivityListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$RepresentantProductivityListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

