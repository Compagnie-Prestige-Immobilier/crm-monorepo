//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/departement_dto.dart';
import 'package:crm_api_client/src/model/representant_dto.dart';
import 'package:crm_api_client/src/model/prospect_dto.dart';
import 'package:crm_api_client/src/model/ief_dto.dart';
import 'package:crm_api_client/src/model/syndicat_dto.dart';
import 'package:crm_api_client/src/model/banque_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'sync_changes_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyncChangesDto {
  /// Returns a new [SyncChangesDto] instance.
  SyncChangesDto({
    required this.departements,

    required this.iefs,

    required this.banques,

    required this.syndicats,

    required this.representants,

    required this.prospects,
  });

  @JsonKey(name: r'departements', required: true, includeIfNull: false)
  final List<DepartementDto> departements;

  @JsonKey(name: r'iefs', required: true, includeIfNull: false)
  final List<IefDto> iefs;

  @JsonKey(name: r'banques', required: true, includeIfNull: false)
  final List<BanqueDto> banques;

  @JsonKey(name: r'syndicats', required: true, includeIfNull: false)
  final List<SyndicatDto> syndicats;

  @JsonKey(name: r'representants', required: true, includeIfNull: false)
  final List<RepresentantDto> representants;

  @JsonKey(name: r'prospects', required: true, includeIfNull: false)
  final List<ProspectDto> prospects;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyncChangesDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                departements,
                iefs,
                banques,
                syndicats,
                representants,
                prospects,
              ],
              [
                other.departements,
                other.iefs,
                other.banques,
                other.syndicats,
                other.representants,
                other.prospects,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        departements,
        iefs,
        banques,
        syndicats,
        representants,
        prospects,
      ]);

  factory SyncChangesDto.fromJson(Map<String, dynamic> json) =>
      _$SyncChangesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyncChangesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
