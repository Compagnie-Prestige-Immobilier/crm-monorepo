//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'ouvrir_fiche_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OuvrirFicheDto {
  /// Returns a new [OuvrirFicheDto] instance.
  OuvrirFicheDto({

    required  this.id,

     this.representantId,

     this.prospectId,

    required  this.openedAt,

     this.draft,
  });

      /// UUID v7 engendré par le client. Clé d’idempotence : l’ouverture existe sur l’appareil avant d’atteindre le serveur.
  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



      /// Exclusif de `prospectId`.
  @JsonKey(
    
    name: r'representantId',
    required: false,
    includeIfNull: false,
  )


  final String? representantId;



      /// Exclusif de `representantId`.
  @JsonKey(
    
    name: r'prospectId',
    required: false,
    includeIfNull: false,
  )


  final String? prospectId;



      /// Heure du terrain, comme `clientCreatedAt` ailleurs : une ouverture faite hors ligne lundi compte lundi.
  @JsonKey(
    
    name: r'openedAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime openedAt;



      /// Réponses déjà saisies au moment de l’ouverture.
  @JsonKey(
    
    name: r'draft',
    required: false,
    includeIfNull: false,
  )


  final Map<String, Object>? draft;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is OuvrirFicheDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            representantId,
            prospectId,
            openedAt,
            draft,
        ],
        [
            other.id,
            other.representantId,
            other.prospectId,
            other.openedAt,
            other.draft,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        representantId,
        prospectId,
        openedAt,
        draft,
    ],);

  factory OuvrirFicheDto.fromJson(Map<String, dynamic> json) => _$OuvrirFicheDtoFromJson(json);

  Map<String, dynamic> toJson() => _$OuvrirFicheDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

