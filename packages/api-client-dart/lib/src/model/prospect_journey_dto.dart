//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/grand_public_consent.dart';
import 'package:crm_api_client/src/model/projet.dart';
import 'package:crm_api_client/src/model/prospect_statut.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'prospect_journey_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProspectJourneyDto {
  /// Returns a new [ProspectJourneyDto] instance.
  ProspectJourneyDto({
    required this.id,

    required this.projet,

    required this.statut,

    required this.consent,

    required this.consentAt,

    required this.convertedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(
    name: r'projet',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Projet.unknownDefaultOpenApi,
  )
  final Projet projet;

  @JsonKey(
    name: r'statut',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ProspectStatut.unknownDefaultOpenApi,
  )
  final ProspectStatut statut;

  @JsonKey(
    name: r'consent',
    required: true,
    includeIfNull: false,
    unknownEnumValue: GrandPublicConsent.unknownDefaultOpenApi,
  )
  final GrandPublicConsent consent;

  @JsonKey(name: r'consentAt', required: true, includeIfNull: true)
  final DateTime? consentAt;

  @JsonKey(name: r'convertedAt', required: true, includeIfNull: true)
  final DateTime? convertedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ProspectJourneyDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, projet, statut, consent, consentAt, convertedAt],
              [
                other.id,
                other.projet,
                other.statut,
                other.consent,
                other.consentAt,
                other.convertedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([id, projet, statut, consent, consentAt, convertedAt]);

  factory ProspectJourneyDto.fromJson(Map<String, dynamic> json) =>
      _$ProspectJourneyDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ProspectJourneyDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
