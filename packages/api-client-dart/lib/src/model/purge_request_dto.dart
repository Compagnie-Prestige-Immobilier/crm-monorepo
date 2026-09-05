//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/purge_domain_key.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'purge_request_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PurgeRequestDto {
  /// Returns a new [PurgeRequestDto] instance.
  PurgeRequestDto({required this.domains, required this.confirmation});

  /// Domaines cochés. Le serveur y ajoute leurs dépendances.
  @JsonKey(name: r'domains', required: true, includeIfNull: false)
  final List<PurgeDomainKey> domains;

  /// Identifiant de connexion de l’administrateur, ressaisi. Comparé à son e-mail ou à son nom d’utilisateur.
  @JsonKey(name: r'confirmation', required: true, includeIfNull: false)
  final String confirmation;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is PurgeRequestDto &&
            runtimeType == other.runtimeType &&
            equals(
              [domains, confirmation],
              [other.domains, other.confirmation],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([domains, confirmation]);

  factory PurgeRequestDto.fromJson(Map<String, dynamic> json) =>
      _$PurgeRequestDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PurgeRequestDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
