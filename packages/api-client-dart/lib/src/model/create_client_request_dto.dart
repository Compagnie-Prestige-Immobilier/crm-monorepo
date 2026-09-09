//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_client_request_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateClientRequestDto {
  /// Returns a new [CreateClientRequestDto] instance.
  CreateClientRequestDto({
    required this.nom,

    required this.prenom,

    required this.phone,

    required this.banqueId,

    this.note,
  });

  @JsonKey(name: r'nom', required: true, includeIfNull: false)
  final String nom;

  @JsonKey(name: r'prenom', required: true, includeIfNull: false)
  final String prenom;

  /// Téléphone en saisie libre. Normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: true, includeIfNull: false)
  final String phone;

  /// Banque demandeuse. Elle devient la provenance lisible du prospect créé, pour que l’on puisse mesurer ce qui entre hors base.
  @JsonKey(name: r'banqueId', required: true, includeIfNull: false)
  final String banqueId;

  /// Contexte laissé à l’administrateur : référence du dossier, agence, urgence.
  @JsonKey(name: r'note', required: false, includeIfNull: false)
  final String? note;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateClientRequestDto &&
            runtimeType == other.runtimeType &&
            equals(
              [nom, prenom, phone, banqueId, note],
              [
                other.nom,
                other.prenom,
                other.phone,
                other.banqueId,
                other.note,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([nom, prenom, phone, banqueId, note]);

  factory CreateClientRequestDto.fromJson(Map<String, dynamic> json) =>
      _$CreateClientRequestDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateClientRequestDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
