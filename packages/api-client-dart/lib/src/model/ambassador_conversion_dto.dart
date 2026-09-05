//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'ambassador_conversion_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AmbassadorConversionDto {
  /// Returns a new [AmbassadorConversionDto] instance.
  AmbassadorConversionDto({

    required  this.contacted,

    required  this.ambassadors,

    required  this.conversionRate,

    required  this.reverted,

    required  this.untracked,
  });

      /// Représentants dont la relation a bougé au moins une fois dans la période. Dénominateur : un taux rapporté à l’annuaire entier mesurerait la taille du fichier, pas le travail.
  @JsonKey(
    
    name: r'contacted',
    required: true,
    includeIfNull: false,
  )


  final num contacted;



      /// Parmi eux, ceux passés au moins une fois AMBASSADEUR dans la période. Comptés une seule fois, quel que soit le nombre d’allers-retours.
  @JsonKey(
    
    name: r'ambassadors',
    required: true,
    includeIfNull: false,
  )


  final num ambassadors;



      /// Ambassadeurs rapportés aux représentants travaillés, en pourcentage. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(
    
    name: r'conversionRate',
    required: true,
    includeIfNull: true,
  )


  final num? conversionRate;



      /// Parmi les convertis de la période, ceux dont le statut COURANT n’est plus AMBASSADEUR. Ils restent au numérateur : la bascule a eu lieu et elle est datée. Les retirer ferait bouger le taux d’un mois clos à chaque changement de statut d’aujourd’hui.
  @JsonKey(
    
    name: r'reverted',
    required: true,
    includeIfNull: false,
  )


  final num reverted;



      /// Représentants du périmètre sans AUCUNE trace de relation, à aucune date. Hors du taux dans les deux termes : ils mesurent ce que la période ne dit pas.
  @JsonKey(
    
    name: r'untracked',
    required: true,
    includeIfNull: false,
  )


  final num untracked;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is AmbassadorConversionDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            contacted,
            ambassadors,
            conversionRate,
            reverted,
            untracked,
        ],
        [
            other.contacted,
            other.ambassadors,
            other.conversionRate,
            other.reverted,
            other.untracked,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        contacted,
        ambassadors,
        conversionRate,
        reverted,
        untracked,
    ],);

  factory AmbassadorConversionDto.fromJson(Map<String, dynamic> json) => _$AmbassadorConversionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AmbassadorConversionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

