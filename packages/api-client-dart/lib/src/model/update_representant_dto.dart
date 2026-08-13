//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_representant_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateRepresentantDto {
  /// Returns a new [UpdateRepresentantDto] instance.
  UpdateRepresentantDto({
    this.id,

    this.fullName,

    this.phone,

    this.departementId,

    this.iefId,

    this.notes,

    this.clientCreatedAt,
  });

  /// Identifiant UUID v7 généré par le client. Fourni par le mobile pour que les prospects saisis hors ligne puissent le référencer avant toute synchronisation.
  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'fullName', required: false, includeIfNull: false)
  final String? fullName;

  /// Téléphone en saisie libre. Normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: false, includeIfNull: false)
  final String? phone;

  @JsonKey(name: r'departementId', required: false, includeIfNull: false)
  final String? departementId;

  /// IEF de rattachement. FACULTATIVE : les fiches saisies avant l’arrivée de ce référentiel n’en portent pas, et la rendre obligatoire les invaliderait rétroactivement. Le département reste obligatoire — il se déduit de l’IEF, jamais l’inverse.
  @JsonKey(name: r'iefId', required: false, includeIfNull: false)
  final String? iefId;

  @JsonKey(name: r'notes', required: false, includeIfNull: false)
  final String? notes;

  /// Horodatage de la saisie sur le terrain. Défaut : maintenant. Distinct de createdAt, qui est l’arrivée en base.
  @JsonKey(name: r'clientCreatedAt', required: false, includeIfNull: false)
  final DateTime? clientCreatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateRepresentantDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                fullName,
                phone,
                departementId,
                iefId,
                notes,
                clientCreatedAt,
              ],
              [
                other.id,
                other.fullName,
                other.phone,
                other.departementId,
                other.iefId,
                other.notes,
                other.clientCreatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        fullName,
        phone,
        departementId,
        iefId,
        notes,
        clientCreatedAt,
      ]);

  factory UpdateRepresentantDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateRepresentantDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateRepresentantDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
