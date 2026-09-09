//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_parametres_chues_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateParametresChuesDto {
  /// Returns a new [UpdateParametresChuesDto] instance.
  UpdateParametresChuesDto({
    this.plateformeChuesUrl,

    this.plateformeGrandPublicUrl,

    this.emailChues,

    this.whatsappChuesE164,

    this.messageWhatsapp,

    this.accuseReceptionObjet,

    this.accuseReceptionCorps,

    this.destinatairesEnrolement,

    this.destinatairesBpe,

    this.destinatairesSupervision,

    this.destinatairesDirection,

    this.verrouFiches,
  });

  @JsonKey(name: r'plateformeChuesUrl', required: false, includeIfNull: false)
  final String? plateformeChuesUrl;

  @JsonKey(
    name: r'plateformeGrandPublicUrl',
    required: false,
    includeIfNull: false,
  )
  final String? plateformeGrandPublicUrl;

  @JsonKey(name: r'emailChues', required: false, includeIfNull: false)
  final String? emailChues;

  @JsonKey(name: r'whatsappChuesE164', required: false, includeIfNull: false)
  final String? whatsappChuesE164;

  @JsonKey(name: r'messageWhatsapp', required: false, includeIfNull: false)
  final String? messageWhatsapp;

  @JsonKey(name: r'accuseReceptionObjet', required: false, includeIfNull: false)
  final String? accuseReceptionObjet;

  @JsonKey(name: r'accuseReceptionCorps', required: false, includeIfNull: false)
  final String? accuseReceptionCorps;

  @JsonKey(
    name: r'destinatairesEnrolement',
    required: false,
    includeIfNull: false,
  )
  final List<String>? destinatairesEnrolement;

  @JsonKey(name: r'destinatairesBpe', required: false, includeIfNull: false)
  final List<String>? destinatairesBpe;

  @JsonKey(
    name: r'destinatairesSupervision',
    required: false,
    includeIfNull: false,
  )
  final List<String>? destinatairesSupervision;

  @JsonKey(
    name: r'destinatairesDirection',
    required: false,
    includeIfNull: false,
  )
  final List<String>? destinatairesDirection;

  @JsonKey(name: r'verrouFiches', required: false, includeIfNull: false)
  final bool? verrouFiches;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateParametresChuesDto &&
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

  factory UpdateParametresChuesDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateParametresChuesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateParametresChuesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
