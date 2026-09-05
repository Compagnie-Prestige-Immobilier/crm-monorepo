//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/visite_referentiel_ref_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteDto {
  /// Returns a new [VisiteDto] instance.
  VisiteDto({
    required this.id,

    required this.reference,

    required this.date,

    required this.time,

    required this.visitorName,

    required this.phone,

    required this.phoneE164,

    required this.entreprise,

    required this.objet,

    required this.direction,

    required this.destinataire,

    required this.comment,

    required this.createdById,

    required this.createdAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  /// Le « N° » du registre. Engendré par le serveur, immuable.
  @JsonKey(name: r'reference', required: true, includeIfNull: false)
  final String reference;

  /// Jour de la visite, à Dakar.
  @JsonKey(name: r'date', required: true, includeIfNull: false)
  final String date;

  /// Nul quand l’heure n’a pas été relevée.
  @JsonKey(name: r'time', required: true, includeIfNull: true)
  final String? time;

  @JsonKey(name: r'visitorName', required: true, includeIfNull: false)
  final String visitorName;

  /// Le numéro tel qu’il a été donné.
  @JsonKey(name: r'phone', required: true, includeIfNull: true)
  final String? phone;

  /// Forme E.164, nulle quand le numéro donné n’a pas pu être reconnu.
  @JsonKey(name: r'phoneE164', required: true, includeIfNull: true)
  final String? phoneE164;

  @JsonKey(name: r'entreprise', required: true, includeIfNull: false)
  final VisiteReferentielRefDto entreprise;

  @JsonKey(name: r'objet', required: true, includeIfNull: false)
  final VisiteReferentielRefDto objet;

  @JsonKey(name: r'direction', required: true, includeIfNull: true)
  final VisiteReferentielRefDto? direction;

  @JsonKey(name: r'destinataire', required: true, includeIfNull: true)
  final VisiteReferentielRefDto? destinataire;

  @JsonKey(name: r'comment', required: true, includeIfNull: true)
  final String? comment;

  @JsonKey(name: r'createdById', required: true, includeIfNull: false)
  final String createdById;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                reference,
                date,
                time,
                visitorName,
                phone,
                phoneE164,
                entreprise,
                objet,
                direction,
                destinataire,
                comment,
                createdById,
                createdAt,
              ],
              [
                other.id,
                other.reference,
                other.date,
                other.time,
                other.visitorName,
                other.phone,
                other.phoneE164,
                other.entreprise,
                other.objet,
                other.direction,
                other.destinataire,
                other.comment,
                other.createdById,
                other.createdAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        reference,
        date,
        time,
        visitorName,
        phone,
        phoneE164,
        entreprise,
        objet,
        direction,
        destinataire,
        comment,
        createdById,
        createdAt,
      ]);

  factory VisiteDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
