//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/comptage_ouvertures_jour_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'comptage_ouvertures_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ComptageOuverturesDto {
  /// Returns a new [ComptageOuverturesDto] instance.
  ComptageOuverturesDto({

    required  this.items,
  });

      /// Une ligne par téléconseiller et par jour, de la plus récente à la plus ancienne.
  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<ComptageOuverturesJourDto> items;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is ComptageOuverturesDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            items,
        ],
        [
            other.items,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        items,
    ],);

  factory ComptageOuverturesDto.fromJson(Map<String, dynamic> json) => _$ComptageOuverturesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ComptageOuverturesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

