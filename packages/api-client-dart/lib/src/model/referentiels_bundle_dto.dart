//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/departement_dto.dart';
import 'package:crm_api_client/src/model/profession_dto.dart';
import 'package:crm_api_client/src/model/income_band_dto.dart';
import 'package:crm_api_client/src/model/syndicat_dto.dart';
import 'package:crm_api_client/src/model/offer_dto.dart';
import 'package:crm_api_client/src/model/region_dto.dart';
import 'package:crm_api_client/src/model/banque_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'referentiels_bundle_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReferentielsBundleDto {
  /// Returns a new [ReferentielsBundleDto] instance.
  ReferentielsBundleDto({
    required this.banques,

    required this.syndicats,

    required this.departements,

    required this.regions,

    required this.professions,

    required this.incomeBands,

    required this.offers,
  });

  @JsonKey(name: r'banques', required: true, includeIfNull: false)
  final List<BanqueDto> banques;

  @JsonKey(name: r'syndicats', required: true, includeIfNull: false)
  final List<SyndicatDto> syndicats;

  @JsonKey(name: r'departements', required: true, includeIfNull: false)
  final List<DepartementDto> departements;

  @JsonKey(name: r'regions', required: true, includeIfNull: false)
  final List<RegionDto> regions;

  @JsonKey(name: r'professions', required: true, includeIfNull: false)
  final List<ProfessionDto> professions;

  @JsonKey(name: r'incomeBands', required: true, includeIfNull: false)
  final List<IncomeBandDto> incomeBands;

  @JsonKey(name: r'offers', required: true, includeIfNull: false)
  final List<OfferDto> offers;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ReferentielsBundleDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                banques,
                syndicats,
                departements,
                regions,
                professions,
                incomeBands,
                offers,
              ],
              [
                other.banques,
                other.syndicats,
                other.departements,
                other.regions,
                other.professions,
                other.incomeBands,
                other.offers,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        banques,
        syndicats,
        departements,
        regions,
        professions,
        incomeBands,
        offers,
      ]);

  factory ReferentielsBundleDto.fromJson(Map<String, dynamic> json) =>
      _$ReferentielsBundleDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ReferentielsBundleDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
