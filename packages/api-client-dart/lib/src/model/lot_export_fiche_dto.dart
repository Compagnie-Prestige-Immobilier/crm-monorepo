//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/lot_export_fiche_etat.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_fiche_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportFicheDto {
  /// Returns a new [LotExportFicheDto] instance.
  LotExportFicheDto({
    required this.position,

    required this.jour,

    required this.ficheId,

    required this.fullName,

    required this.phoneE164,

    required this.teleconseillerId,

    required this.teleconseillerName,

    required this.etat,

    required this.statutLabel,
  });

  @JsonKey(name: r'position', required: true, includeIfNull: false)
  final num position;

  @JsonKey(name: r'jour', required: true, includeIfNull: false)
  final num jour;

  @JsonKey(name: r'ficheId', required: true, includeIfNull: true)
  final String? ficheId;

  @JsonKey(name: r'fullName', required: true, includeIfNull: false)
  final String fullName;

  @JsonKey(name: r'phoneE164', required: true, includeIfNull: false)
  final String phoneE164;

  @JsonKey(name: r'teleconseillerId', required: true, includeIfNull: true)
  final String? teleconseillerId;

  @JsonKey(name: r'teleconseillerName', required: true, includeIfNull: false)
  final String teleconseillerName;

  @JsonKey(
    name: r'etat',
    required: true,
    includeIfNull: false,
    unknownEnumValue: LotExportFicheEtat.unknownDefaultOpenApi,
  )
  final LotExportFicheEtat etat;

  @JsonKey(name: r'statutLabel', required: true, includeIfNull: true)
  final String? statutLabel;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is LotExportFicheDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                position,
                jour,
                ficheId,
                fullName,
                phoneE164,
                teleconseillerId,
                teleconseillerName,
                etat,
                statutLabel,
              ],
              [
                other.position,
                other.jour,
                other.ficheId,
                other.fullName,
                other.phoneE164,
                other.teleconseillerId,
                other.teleconseillerName,
                other.etat,
                other.statutLabel,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        position,
        jour,
        ficheId,
        fullName,
        phoneE164,
        teleconseillerId,
        teleconseillerName,
        etat,
        statutLabel,
      ]);

  factory LotExportFicheDto.fromJson(Map<String, dynamic> json) =>
      _$LotExportFicheDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportFicheDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
