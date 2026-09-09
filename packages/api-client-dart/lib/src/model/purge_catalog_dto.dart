//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/purge_domain_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'purge_catalog_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PurgeCatalogDto {
  /// Returns a new [PurgeCatalogDto] instance.
  PurgeCatalogDto({
    required this.allowed,

    required this.confirmationHint,

    required this.domains,
  });

  /// Vrai si le compte appelant est le premier administrateur, seul habilité à purger.
  @JsonKey(name: r'allowed', required: true, includeIfNull: false)
  final bool allowed;

  /// Identifiant de connexion à ressaisir pour confirmer.
  @JsonKey(name: r'confirmationHint', required: true, includeIfNull: false)
  final String confirmationHint;

  @JsonKey(name: r'domains', required: true, includeIfNull: false)
  final List<PurgeDomainDto> domains;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is PurgeCatalogDto &&
            runtimeType == other.runtimeType &&
            equals(
              [allowed, confirmationHint, domains],
              [other.allowed, other.confirmationHint, other.domains],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([allowed, confirmationHint, domains]);

  factory PurgeCatalogDto.fromJson(Map<String, dynamic> json) =>
      _$PurgeCatalogDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PurgeCatalogDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
