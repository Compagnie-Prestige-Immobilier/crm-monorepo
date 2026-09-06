//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/parametre_changement_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'journal_parametres_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class JournalParametresDto {
  /// Returns a new [JournalParametresDto] instance.
  JournalParametresDto({required this.items});

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<ParametreChangementDto> items;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is JournalParametresDto &&
            runtimeType == other.runtimeType &&
            equals([items], [other.items]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([items]);

  factory JournalParametresDto.fromJson(Map<String, dynamic> json) =>
      _$JournalParametresDtoFromJson(json);

  Map<String, dynamic> toJson() => _$JournalParametresDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
