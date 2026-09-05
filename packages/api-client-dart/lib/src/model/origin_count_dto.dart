//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'origin_count_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OriginCountDto {
  /// Returns a new [OriginCountDto] instance.
  OriginCountDto({

    required  this.origin,

    required  this.label,

    required  this.prospects,

    required  this.share,
  });

      /// Clé de provenance. Nulle pour une fiche née d’une tournée terrain.
  @JsonKey(
    
    name: r'origin',
    required: true,
    includeIfNull: true,
  )


  final String? origin;



      /// Libellé prêt à afficher.
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



      /// Part du total filtré, en pourcentage. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(
    
    name: r'share',
    required: true,
    includeIfNull: true,
  )


  final num? share;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is OriginCountDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            origin,
            label,
            prospects,
            share,
        ],
        [
            other.origin,
            other.label,
            other.prospects,
            other.share,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        origin,
        label,
        prospects,
        share,
    ],);

  factory OriginCountDto.fromJson(Map<String, dynamic> json) => _$OriginCountDtoFromJson(json);

  Map<String, dynamic> toJson() => _$OriginCountDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

