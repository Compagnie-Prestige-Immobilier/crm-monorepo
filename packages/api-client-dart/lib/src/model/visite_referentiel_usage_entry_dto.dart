//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_referentiel_usage_entry_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteReferentielUsageEntryDto {
  /// Returns a new [VisiteReferentielUsageEntryDto] instance.
  VisiteReferentielUsageEntryDto({

    required  this.id,

    required  this.count,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'count',
    required: true,
    includeIfNull: false,
  )


  final num count;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is VisiteReferentielUsageEntryDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            id,
            count,
        ],
        [
            other.id,
            other.count,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        id,
        count,
    ],);

  factory VisiteReferentielUsageEntryDto.fromJson(Map<String, dynamic> json) => _$VisiteReferentielUsageEntryDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteReferentielUsageEntryDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

