//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'set_visite_import_change_selection_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SetVisiteImportChangeSelectionDto {
  /// Returns a new [SetVisiteImportChangeSelectionDto] instance.
  SetVisiteImportChangeSelectionDto({

    required  this.ids,

    required  this.selected,
  });

      /// Les lignes visées par ce geste.
  @JsonKey(
    
    name: r'ids',
    required: true,
    includeIfNull: false,
  )


  final List<String> ids;



  @JsonKey(
    
    name: r'selected',
    required: true,
    includeIfNull: false,
  )


  final bool selected;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is SetVisiteImportChangeSelectionDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            ids,
            selected,
        ],
        [
            other.ids,
            other.selected,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        ids,
        selected,
    ],);

  factory SetVisiteImportChangeSelectionDto.fromJson(Map<String, dynamic> json) => _$SetVisiteImportChangeSelectionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SetVisiteImportChangeSelectionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

