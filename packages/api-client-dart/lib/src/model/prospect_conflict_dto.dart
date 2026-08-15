//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/prospect_conflict_existing_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'prospect_conflict_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProspectConflictDto {
  /// Returns a new [ProspectConflictDto] instance.
  ProspectConflictDto({
    required this.statusCode,

    required this.code,

    required this.message,

    this.details,

    this.requestId,

    required this.existing,
  });

  /// Le code HTTP, répété dans le corps pour que le corps se suffise à lui même.
  @JsonKey(name: r'statusCode', required: true, includeIfNull: false)
  final num statusCode;

  /// Clé stable et machinable de l’erreur. C’est SUR ELLE qu’un client branche, jamais sur `message`. Les codes métier sont énumérés dans la description de chaque opération ; les codes génériques dérivent du statut HTTP (BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, VALIDATION_FAILED, INTERNAL_SERVER_ERROR). DEUX CODES TRANSVERSES méritent d’être traités une fois pour toutes côté client. Ils sortent tous deux en 409 sur TOUTE requête POST, PATCH, PUT ou DELETE, ne dépendent d’aucune opération en particulier, et leur `message` est déjà rédigé pour être affiché tel quel : `DEMO_MODE_READ_ONLY` tant que le mode démonstration est actif ; `DEMO_MODE_STATE_UNKNOWN` quand le serveur n’arrive pas à lire l’état de ce mode et refuse d’écrire une ligne dont il ne saurait pas dire si elle est réelle. Le second N’ANNONCE PAS une démonstration en cours : il invite à réessayer, et non à faire éteindre un interrupteur. Ces routes-là, et elles seules, n’émettent JAMAIS ces codes : la bascule de démonstration elle-même (sans quoi le mode ne pourrait plus être éteint), l’authentification, la remontée hors ligne du mobile (`POST /v1/sync/push`, qui n’est JAMAIS refusée), le marquage en lu d’une notification personnelle, et l’aperçu d’un gabarit de notification (`POST /v1/notification-templates/render`, un calcul qui n’écrit rien malgré la méthode POST).
  @JsonKey(
    name: r'code',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ProspectConflictDtoCodeEnum.unknownDefaultOpenApi,
  )
  final ProspectConflictDtoCodeEnum code;

  /// Message en français, destiné à être lu par un humain. Toujours une CHAÎNE, jamais un tableau. Susceptible de changer sans préavis.
  @JsonKey(name: r'message', required: true, includeIfNull: false)
  final String message;

  /// Détail par champ, renseigné pour les refus de validation d’entrée. Reprend ce que la validation mettait auparavant dans `message` sous forme de tableau.
  @JsonKey(name: r'details', required: false, includeIfNull: false)
  final List<String>? details;

  /// Identifiant de la requête, repris de l’en tête `x-request-id` quand il est fourni. C’est la seule valeur à citer dans un signalement d’incident.
  @JsonKey(name: r'requestId', required: false, includeIfNull: false)
  final String? requestId;

  @JsonKey(name: r'existing', required: true, includeIfNull: false)
  final ProspectConflictExistingDto existing;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ProspectConflictDto &&
            runtimeType == other.runtimeType &&
            equals(
              [statusCode, code, message, details, requestId, existing],
              [
                other.statusCode,
                other.code,
                other.message,
                other.details,
                other.requestId,
                other.existing,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        statusCode,
        code,
        message,
        details,
        requestId,
        existing,
      ]);

  factory ProspectConflictDto.fromJson(Map<String, dynamic> json) =>
      _$ProspectConflictDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ProspectConflictDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

/// Clé stable et machinable de l’erreur. C’est SUR ELLE qu’un client branche, jamais sur `message`. Les codes métier sont énumérés dans la description de chaque opération ; les codes génériques dérivent du statut HTTP (BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, VALIDATION_FAILED, INTERNAL_SERVER_ERROR). DEUX CODES TRANSVERSES méritent d’être traités une fois pour toutes côté client. Ils sortent tous deux en 409 sur TOUTE requête POST, PATCH, PUT ou DELETE, ne dépendent d’aucune opération en particulier, et leur `message` est déjà rédigé pour être affiché tel quel : `DEMO_MODE_READ_ONLY` tant que le mode démonstration est actif ; `DEMO_MODE_STATE_UNKNOWN` quand le serveur n’arrive pas à lire l’état de ce mode et refuse d’écrire une ligne dont il ne saurait pas dire si elle est réelle. Le second N’ANNONCE PAS une démonstration en cours : il invite à réessayer, et non à faire éteindre un interrupteur. Ces routes-là, et elles seules, n’émettent JAMAIS ces codes : la bascule de démonstration elle-même (sans quoi le mode ne pourrait plus être éteint), l’authentification, la remontée hors ligne du mobile (`POST /v1/sync/push`, qui n’est JAMAIS refusée), le marquage en lu d’une notification personnelle, et l’aperçu d’un gabarit de notification (`POST /v1/notification-templates/render`, un calcul qui n’écrit rien malgré la méthode POST).
enum ProspectConflictDtoCodeEnum {
  /// Clé stable et machinable de l’erreur. C’est SUR ELLE qu’un client branche, jamais sur `message`. Les codes métier sont énumérés dans la description de chaque opération ; les codes génériques dérivent du statut HTTP (BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, VALIDATION_FAILED, INTERNAL_SERVER_ERROR). DEUX CODES TRANSVERSES méritent d’être traités une fois pour toutes côté client. Ils sortent tous deux en 409 sur TOUTE requête POST, PATCH, PUT ou DELETE, ne dépendent d’aucune opération en particulier, et leur `message` est déjà rédigé pour être affiché tel quel : `DEMO_MODE_READ_ONLY` tant que le mode démonstration est actif ; `DEMO_MODE_STATE_UNKNOWN` quand le serveur n’arrive pas à lire l’état de ce mode et refuse d’écrire une ligne dont il ne saurait pas dire si elle est réelle. Le second N’ANNONCE PAS une démonstration en cours : il invite à réessayer, et non à faire éteindre un interrupteur. Ces routes-là, et elles seules, n’émettent JAMAIS ces codes : la bascule de démonstration elle-même (sans quoi le mode ne pourrait plus être éteint), l’authentification, la remontée hors ligne du mobile (`POST /v1/sync/push`, qui n’est JAMAIS refusée), le marquage en lu d’une notification personnelle, et l’aperçu d’un gabarit de notification (`POST /v1/notification-templates/render`, un calcul qui n’écrit rien malgré la méthode POST).
  @JsonValue(r'PROSPECT_PHONE_CONFLICT')
  PROSPECT_PHONE_CONFLICT(r'PROSPECT_PHONE_CONFLICT'),

  /// Clé stable et machinable de l’erreur. C’est SUR ELLE qu’un client branche, jamais sur `message`. Les codes métier sont énumérés dans la description de chaque opération ; les codes génériques dérivent du statut HTTP (BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, VALIDATION_FAILED, INTERNAL_SERVER_ERROR). DEUX CODES TRANSVERSES méritent d’être traités une fois pour toutes côté client. Ils sortent tous deux en 409 sur TOUTE requête POST, PATCH, PUT ou DELETE, ne dépendent d’aucune opération en particulier, et leur `message` est déjà rédigé pour être affiché tel quel : `DEMO_MODE_READ_ONLY` tant que le mode démonstration est actif ; `DEMO_MODE_STATE_UNKNOWN` quand le serveur n’arrive pas à lire l’état de ce mode et refuse d’écrire une ligne dont il ne saurait pas dire si elle est réelle. Le second N’ANNONCE PAS une démonstration en cours : il invite à réessayer, et non à faire éteindre un interrupteur. Ces routes-là, et elles seules, n’émettent JAMAIS ces codes : la bascule de démonstration elle-même (sans quoi le mode ne pourrait plus être éteint), l’authentification, la remontée hors ligne du mobile (`POST /v1/sync/push`, qui n’est JAMAIS refusée), le marquage en lu d’une notification personnelle, et l’aperçu d’un gabarit de notification (`POST /v1/notification-templates/render`, un calcul qui n’écrit rien malgré la méthode POST).
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const ProspectConflictDtoCodeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
