//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'option_publique_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OptionPubliqueDto {
  /// Returns a new [OptionPubliqueDto] instance.
  OptionPubliqueDto({required this.id, required this.libelle});

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'libelle', required: true, includeIfNull: false)
  final String libelle;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is OptionPubliqueDto &&
            runtimeType == other.runtimeType &&
            equals([id, libelle], [other.id, other.libelle]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([id, libelle]);

  factory OptionPubliqueDto.fromJson(Map<String, dynamic> json) =>
      _$OptionPubliqueDtoFromJson(json);

  Map<String, dynamic> toJson() => _$OptionPubliqueDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
