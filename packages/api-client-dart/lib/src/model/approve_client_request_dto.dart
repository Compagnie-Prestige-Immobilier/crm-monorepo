//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'approve_client_request_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ApproveClientRequestDto {
  /// Returns a new [ApproveClientRequestDto] instance.
  ApproveClientRequestDto({
    required this.representantId,

    required this.syndicatId,

    this.banqueId,

    this.clientCreatedAt,
  });

  /// Représentant de rattachement du prospect créé.
  @JsonKey(name: r'representantId', required: true, includeIfNull: false)
  final String representantId;

  @JsonKey(name: r'syndicatId', required: true, includeIfNull: false)
  final String syndicatId;

  /// Banque du prospect créé. Par défaut celle de la demande.
  @JsonKey(name: r'banqueId', required: false, includeIfNull: false)
  final String? banqueId;

  /// Date de saisie à retenir. Par défaut celle de la demande.
  @JsonKey(name: r'clientCreatedAt', required: false, includeIfNull: false)
  final DateTime? clientCreatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ApproveClientRequestDto &&
            runtimeType == other.runtimeType &&
            equals(
              [representantId, syndicatId, banqueId, clientCreatedAt],
              [
                other.representantId,
                other.syndicatId,
                other.banqueId,
                other.clientCreatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        representantId,
        syndicatId,
        banqueId,
        clientCreatedAt,
      ]);

  factory ApproveClientRequestDto.fromJson(Map<String, dynamic> json) =>
      _$ApproveClientRequestDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ApproveClientRequestDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
