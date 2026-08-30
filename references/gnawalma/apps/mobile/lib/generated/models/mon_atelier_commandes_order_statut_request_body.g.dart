// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mon_atelier_commandes_order_statut_request_body.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MonAtelierCommandesOrderStatutRequestBody
_$MonAtelierCommandesOrderStatutRequestBodyFromJson(
  Map<String, dynamic> json,
) => MonAtelierCommandesOrderStatutRequestBody(
  status: Status.fromJson(json['status'] as String),
);

Map<String, dynamic> _$MonAtelierCommandesOrderStatutRequestBodyToJson(
  MonAtelierCommandesOrderStatutRequestBody instance,
) => <String, dynamic>{'status': _$StatusEnumMap[instance.status]!};

const _$StatusEnumMap = {
  Status.enCours: 'en_cours',
  Status.pret: 'pret',
  Status.livre: 'livre',
  Status.annule: 'annule',
  Status.$unknown: r'$unknown',
};
