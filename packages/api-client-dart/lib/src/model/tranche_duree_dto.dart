//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'tranche_duree_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TrancheDureeDto {
  /// Returns a new [TrancheDureeDto] instance.
  TrancheDureeDto({required this.mois, required this.libelle});

  // minimum: 0
  @JsonKey(name: r'mois', required: true, includeIfNull: false)
  final num mois;

  @JsonKey(name: r'libelle', required: true, includeIfNull: false)
  final String libelle;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is TrancheDureeDto &&
            runtimeType == other.runtimeType &&
            equals([mois, libelle], [other.mois, other.libelle]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([mois, libelle]);

  factory TrancheDureeDto.fromJson(Map<String, dynamic> json) =>
      _$TrancheDureeDtoFromJson(json);

  Map<String, dynamic> toJson() => _$TrancheDureeDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
