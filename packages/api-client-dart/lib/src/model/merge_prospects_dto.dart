//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'merge_prospects_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MergeProspectsDto {
  /// Returns a new [MergeProspectsDto] instance.
  MergeProspectsDto({

    required  this.targetId,

    required  this.sourceId,

     this.preferSource = false,
  });

      /// La fiche conservée.
  @JsonKey(
    
    name: r'targetId',
    required: true,
    includeIfNull: false,
  )


  final String targetId;



      /// La fiche absorbée puis supprimée logiquement.
  @JsonKey(
    
    name: r'sourceId',
    required: true,
    includeIfNull: false,
  )


  final String sourceId;



      /// Reprendre les champs de la source (nom, prénom, banque, syndicat, statut) sur la cible.
  @JsonKey(
    defaultValue: false,
    name: r'preferSource',
    required: false,
    includeIfNull: false,
  )


  final bool? preferSource;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is MergeProspectsDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            targetId,
            sourceId,
            preferSource,
        ],
        [
            other.targetId,
            other.sourceId,
            other.preferSource,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        targetId,
        sourceId,
        preferSource,
    ],);

  factory MergeProspectsDto.fromJson(Map<String, dynamic> json) => _$MergeProspectsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$MergeProspectsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

