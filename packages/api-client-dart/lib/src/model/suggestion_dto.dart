//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/suggestion_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'suggestion_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SuggestionDto {
  /// Returns a new [SuggestionDto] instance.
  SuggestionDto({
    required this.id,

    required this.sourceRepresentantId,

    required this.sourceRepresentantShortCode,

    required this.suggestedName,

    required this.suggestedPhoneE164,

    required this.note,

    required this.status,

    required this.suggestedById,

    required this.suggestedByName,

    required this.resolvedRepresentantId,

    required this.clientCreatedAt,

    required this.createdAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  /// Le représentant qui a donné le numéro.
  @JsonKey(name: r'sourceRepresentantId', required: true, includeIfNull: false)
  final String sourceRepresentantId;

  /// Code court à six caractères du représentant qui a donné le numéro.
  @JsonKey(
    name: r'sourceRepresentantShortCode',
    required: true,
    includeIfNull: false,
  )
  final String sourceRepresentantShortCode;

  @JsonKey(name: r'suggestedName', required: true, includeIfNull: true)
  final String? suggestedName;

  /// Numéro normalisé par le serveur.
  @JsonKey(name: r'suggestedPhoneE164', required: true, includeIfNull: false)
  final String suggestedPhoneE164;

  @JsonKey(name: r'note', required: true, includeIfNull: true)
  final String? note;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: SuggestionStatus.unknownDefaultOpenApi,
  )
  final SuggestionStatus status;

  /// Téléconseiller qui a recueilli la suggestion.
  @JsonKey(name: r'suggestedById', required: true, includeIfNull: false)
  final String suggestedById;

  @JsonKey(name: r'suggestedByName', required: true, includeIfNull: false)
  final String suggestedByName;

  /// Fiche existante portant ce numéro au moment de la saisie. La piste est déjà connue.
  @JsonKey(name: r'resolvedRepresentantId', required: true, includeIfNull: true)
  final String? resolvedRepresentantId;

  @JsonKey(name: r'clientCreatedAt', required: true, includeIfNull: false)
  final DateTime clientCreatedAt;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SuggestionDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                sourceRepresentantId,
                sourceRepresentantShortCode,
                suggestedName,
                suggestedPhoneE164,
                note,
                status,
                suggestedById,
                suggestedByName,
                resolvedRepresentantId,
                clientCreatedAt,
                createdAt,
              ],
              [
                other.id,
                other.sourceRepresentantId,
                other.sourceRepresentantShortCode,
                other.suggestedName,
                other.suggestedPhoneE164,
                other.note,
                other.status,
                other.suggestedById,
                other.suggestedByName,
                other.resolvedRepresentantId,
                other.clientCreatedAt,
                other.createdAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        sourceRepresentantId,
        sourceRepresentantShortCode,
        suggestedName,
        suggestedPhoneE164,
        note,
        status,
        suggestedById,
        suggestedByName,
        resolvedRepresentantId,
        clientCreatedAt,
        createdAt,
      ]);

  factory SuggestionDto.fromJson(Map<String, dynamic> json) =>
      _$SuggestionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SuggestionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
