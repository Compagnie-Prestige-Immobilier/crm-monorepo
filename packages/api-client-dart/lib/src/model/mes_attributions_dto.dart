//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'mes_attributions_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MesAttributionsDto {
  /// Returns a new [MesAttributionsDto] instance.
  MesAttributionsDto({

    required  this.representantIds,

    required  this.prospectIds,

    required  this.tout,
  });

  @JsonKey(
    
    name: r'representantIds',
    required: true,
    includeIfNull: false,
  )


  final List<String> representantIds;



  @JsonKey(
    
    name: r'prospectIds',
    required: true,
    includeIfNull: false,
  )


  final List<String> prospectIds;



      /// Vrai pour l’encadrement : aucun filtre ne s’applique.
  @JsonKey(
    
    name: r'tout',
    required: true,
    includeIfNull: false,
  )


  final bool tout;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is MesAttributionsDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            representantIds,
            prospectIds,
            tout,
        ],
        [
            other.representantIds,
            other.prospectIds,
            other.tout,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        representantIds,
        prospectIds,
        tout,
    ],);

  factory MesAttributionsDto.fromJson(Map<String, dynamic> json) => _$MesAttributionsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$MesAttributionsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

