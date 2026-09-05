//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'reorder_bank_case_stages_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReorderBankCaseStagesDto {
  /// Returns a new [ReorderBankCaseStagesDto] instance.
  ReorderBankCaseStagesDto({

    required  this.stageIds,
  });

      /// Liste ORDONNÉE de toutes les étapes OPEN, actives comme inactives. L’étape initiale doit venir en premier.
  @JsonKey(
    
    name: r'stageIds',
    required: true,
    includeIfNull: false,
  )


  final List<String> stageIds;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is ReorderBankCaseStagesDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            stageIds,
        ],
        [
            other.stageIds,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        stageIds,
    ],);

  factory ReorderBankCaseStagesDto.fromJson(Map<String, dynamic> json) => _$ReorderBankCaseStagesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ReorderBankCaseStagesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

