//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'demande_publique_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DemandePubliqueDto {
  /// Returns a new [DemandePubliqueDto] instance.
  DemandePubliqueDto({
    required this.nom,

    required this.prenom,

    required this.phone,

    this.email,

    this.profession,

    this.employeur,

    this.message,

    this.site,

    this.turnstileToken,
  });

  @JsonKey(name: r'nom', required: true, includeIfNull: false)
  final String nom;

  @JsonKey(name: r'prenom', required: true, includeIfNull: false)
  final String prenom;

  /// Saisie libre, normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: true, includeIfNull: false)
  final String phone;

  /// Sans adresse, la confirmation à l’écran vaut accusé de réception.
  @JsonKey(name: r'email', required: false, includeIfNull: false)
  final String? email;

  @JsonKey(name: r'profession', required: false, includeIfNull: false)
  final String? profession;

  @JsonKey(name: r'employeur', required: false, includeIfNull: false)
  final String? employeur;

  @JsonKey(name: r'message', required: false, includeIfNull: false)
  final String? message;

  /// Laisser vide.
  @JsonKey(name: r'site', required: false, includeIfNull: false)
  final String? site;

  /// Jeton rendu par le widget Cloudflare Turnstile de la page.
  @JsonKey(name: r'turnstileToken', required: false, includeIfNull: false)
  final String? turnstileToken;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DemandePubliqueDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                nom,
                prenom,
                phone,
                email,
                profession,
                employeur,
                message,
                site,
                turnstileToken,
              ],
              [
                other.nom,
                other.prenom,
                other.phone,
                other.email,
                other.profession,
                other.employeur,
                other.message,
                other.site,
                other.turnstileToken,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        nom,
        prenom,
        phone,
        email,
        profession,
        employeur,
        message,
        site,
        turnstileToken,
      ]);

  factory DemandePubliqueDto.fromJson(Map<String, dynamic> json) =>
      _$DemandePubliqueDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DemandePubliqueDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
