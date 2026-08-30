// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'mon_atelier_commandes_order_paiements_request_body.g.dart';

@JsonSerializable()
class MonAtelierCommandesOrderPaiementsRequestBody {
  const MonAtelierCommandesOrderPaiementsRequestBody({
    required this.amountCfa,
  });
  
  factory MonAtelierCommandesOrderPaiementsRequestBody.fromJson(Map<String, Object?> json) => _$MonAtelierCommandesOrderPaiementsRequestBodyFromJson(json);
  
  @JsonKey(name: 'amount_cfa')
  final int amountCfa;

  Map<String, Object?> toJson() => _$MonAtelierCommandesOrderPaiementsRequestBodyToJson(this);
}
