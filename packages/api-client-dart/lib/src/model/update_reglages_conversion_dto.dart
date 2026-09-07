//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/reglage_champ_input_dto.dart';
import 'package:crm_api_client/src/model/champ_libre_input_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_reglages_conversion_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateReglagesConversionDto {
  /// Returns a new [UpdateReglagesConversionDto] instance.
  UpdateReglagesConversionDto({required this.champs, required this.libres});

  /// La liste ENTIÈRE, dans l’ordre d’affichage voulu.
  @JsonKey(name: r'champs', required: true, includeIfNull: false)
  final List<ReglageChampInputDto> champs;

  @JsonKey(name: r'libres', required: true, includeIfNull: false)
  final List<ChampLibreInputDto> libres;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateReglagesConversionDto &&
            runtimeType == other.runtimeType &&
            equals([champs, libres], [other.champs, other.libres]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([champs, libres]);

  factory UpdateReglagesConversionDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateReglagesConversionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateReglagesConversionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
