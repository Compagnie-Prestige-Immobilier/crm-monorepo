//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_repartition_jour_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportRepartitionJourDto {
  /// Returns a new [LotExportRepartitionJourDto] instance.
  LotExportRepartitionJourDto({

    required  this.jour,

    required  this.fiches,
  });

  @JsonKey(
    
    name: r'jour',
    required: true,
    includeIfNull: false,
  )


  final num jour;



  @JsonKey(
    
    name: r'fiches',
    required: true,
    includeIfNull: false,
  )


  final num fiches;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is LotExportRepartitionJourDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            jour,
            fiches,
        ],
        [
            other.jour,
            other.fiches,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        jour,
        fiches,
    ],);

  factory LotExportRepartitionJourDto.fromJson(Map<String, dynamic> json) => _$LotExportRepartitionJourDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportRepartitionJourDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

