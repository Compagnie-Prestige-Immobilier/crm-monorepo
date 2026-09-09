//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'parametres_chues_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ParametresChuesDto {
  /// Returns a new [ParametresChuesDto] instance.
  ParametresChuesDto({
    required this.plateformeChuesUrl,

    required this.plateformeGrandPublicUrl,

    required this.emailChues,

    required this.whatsappChuesE164,

    required this.messageWhatsapp,

    required this.accuseReceptionObjet,

    required this.accuseReceptionCorps,

    required this.destinatairesEnrolement,

    required this.destinatairesBpe,

    required this.destinatairesSupervision,

    required this.destinatairesDirection,

    required this.verrouFiches,
  });

  @JsonKey(name: r'plateformeChuesUrl', required: true, includeIfNull: false)
  final String plateformeChuesUrl;

  @JsonKey(
    name: r'plateformeGrandPublicUrl',
    required: true,
    includeIfNull: false,
  )
  final String plateformeGrandPublicUrl;

  @JsonKey(name: r'emailChues', required: true, includeIfNull: false)
  final String emailChues;

  @JsonKey(name: r'whatsappChuesE164', required: true, includeIfNull: false)
  final String whatsappChuesE164;

  @JsonKey(name: r'messageWhatsapp', required: true, includeIfNull: false)
  final String messageWhatsapp;

  @JsonKey(name: r'accuseReceptionObjet', required: true, includeIfNull: false)
  final String accuseReceptionObjet;

  @JsonKey(name: r'accuseReceptionCorps', required: true, includeIfNull: false)
  final String accuseReceptionCorps;

  @JsonKey(
    name: r'destinatairesEnrolement',
    required: true,
    includeIfNull: false,
  )
  final List<String> destinatairesEnrolement;

  @JsonKey(name: r'destinatairesBpe', required: true, includeIfNull: false)
  final List<String> destinatairesBpe;

  @JsonKey(
    name: r'destinatairesSupervision',
    required: true,
    includeIfNull: false,
  )
  final List<String> destinatairesSupervision;

  @JsonKey(
    name: r'destinatairesDirection',
    required: true,
    includeIfNull: false,
  )
  final List<String> destinatairesDirection;

  @JsonKey(name: r'verrouFiches', required: true, includeIfNull: false)
  final bool verrouFiches;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ParametresChuesDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                plateformeChuesUrl,
                plateformeGrandPublicUrl,
                emailChues,
                whatsappChuesE164,
                messageWhatsapp,
                accuseReceptionObjet,
                accuseReceptionCorps,
                destinatairesEnrolement,
                destinatairesBpe,
                destinatairesSupervision,
                destinatairesDirection,
                verrouFiches,
              ],
              [
                other.plateformeChuesUrl,
                other.plateformeGrandPublicUrl,
                other.emailChues,
                other.whatsappChuesE164,
                other.messageWhatsapp,
                other.accuseReceptionObjet,
                other.accuseReceptionCorps,
                other.destinatairesEnrolement,
                other.destinatairesBpe,
                other.destinatairesSupervision,
                other.destinatairesDirection,
                other.verrouFiches,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        plateformeChuesUrl,
        plateformeGrandPublicUrl,
        emailChues,
        whatsappChuesE164,
        messageWhatsapp,
        accuseReceptionObjet,
        accuseReceptionCorps,
        destinatairesEnrolement,
        destinatairesBpe,
        destinatairesSupervision,
        destinatairesDirection,
        verrouFiches,
      ]);

  factory ParametresChuesDto.fromJson(Map<String, dynamic> json) =>
      _$ParametresChuesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ParametresChuesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
