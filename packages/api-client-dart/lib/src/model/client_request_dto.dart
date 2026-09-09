//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/client_request_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'client_request_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClientRequestDto {
  /// Returns a new [ClientRequestDto] instance.
  ClientRequestDto({
    required this.id,

    required this.nom,

    required this.prenom,

    required this.phoneE164,

    required this.note,

    required this.banqueId,

    required this.banqueName,

    required this.requestedById,

    required this.requestedByName,

    required this.status,

    required this.reviewedById,

    required this.reviewedByName,

    required this.reviewedAt,

    required this.rejectionNote,

    required this.createdProspectId,

    required this.createdAt,

    required this.updatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'nom', required: true, includeIfNull: false)
  final String nom;

  @JsonKey(name: r'prenom', required: true, includeIfNull: false)
  final String prenom;

  /// Téléphone normalisé E.164.
  @JsonKey(name: r'phoneE164', required: true, includeIfNull: false)
  final String phoneE164;

  @JsonKey(name: r'note', required: true, includeIfNull: true)
  final String? note;

  @JsonKey(name: r'banqueId', required: true, includeIfNull: false)
  final String banqueId;

  @JsonKey(name: r'banqueName', required: true, includeIfNull: false)
  final String banqueName;

  @JsonKey(name: r'requestedById', required: true, includeIfNull: false)
  final String requestedById;

  @JsonKey(name: r'requestedByName', required: true, includeIfNull: false)
  final String requestedByName;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ClientRequestStatus.unknownDefaultOpenApi,
  )
  final ClientRequestStatus status;

  @JsonKey(name: r'reviewedById', required: true, includeIfNull: true)
  final String? reviewedById;

  @JsonKey(name: r'reviewedByName', required: true, includeIfNull: true)
  final String? reviewedByName;

  @JsonKey(name: r'reviewedAt', required: true, includeIfNull: true)
  final DateTime? reviewedAt;

  @JsonKey(name: r'rejectionNote', required: true, includeIfNull: true)
  final String? rejectionNote;

  /// Prospect issu de l’approbation. Nul tant que la demande n’a pas abouti.
  @JsonKey(name: r'createdProspectId', required: true, includeIfNull: true)
  final String? createdProspectId;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ClientRequestDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                nom,
                prenom,
                phoneE164,
                note,
                banqueId,
                banqueName,
                requestedById,
                requestedByName,
                status,
                reviewedById,
                reviewedByName,
                reviewedAt,
                rejectionNote,
                createdProspectId,
                createdAt,
                updatedAt,
              ],
              [
                other.id,
                other.nom,
                other.prenom,
                other.phoneE164,
                other.note,
                other.banqueId,
                other.banqueName,
                other.requestedById,
                other.requestedByName,
                other.status,
                other.reviewedById,
                other.reviewedByName,
                other.reviewedAt,
                other.rejectionNote,
                other.createdProspectId,
                other.createdAt,
                other.updatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        nom,
        prenom,
        phoneE164,
        note,
        banqueId,
        banqueName,
        requestedById,
        requestedByName,
        status,
        reviewedById,
        reviewedByName,
        reviewedAt,
        rejectionNote,
        createdProspectId,
        createdAt,
        updatedAt,
      ]);

  factory ClientRequestDto.fromJson(Map<String, dynamic> json) =>
      _$ClientRequestDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ClientRequestDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
