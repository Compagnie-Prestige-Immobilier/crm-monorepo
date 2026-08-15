//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum PurgeDomainKey {
  @JsonValue(r'teleconseillers')
  teleconseillers(r'teleconseillers'),
  @JsonValue(r'finances')
  finances(r'finances'),
  @JsonValue(r'representants')
  representants(r'representants'),
  @JsonValue(r'prospects')
  prospects(r'prospects'),
  @JsonValue(r'campagnes')
  campagnes(r'campagnes'),
  @JsonValue(r'campagnesRepresentants')
  campagnesRepresentants(r'campagnesRepresentants'),
  @JsonValue(r'demandesClients')
  demandesClients(r'demandesClients'),
  @JsonValue(r'fileAppels')
  fileAppels(r'fileAppels'),
  @JsonValue(r'tentatives')
  tentatives(r'tentatives'),
  @JsonValue(r'dossiers')
  dossiers(r'dossiers'),
  @JsonValue(r'notifications')
  notifications(r'notifications'),
  @JsonValue(r'synchronisation')
  synchronisation(r'synchronisation'),
  @JsonValue(r'journal')
  journal(r'journal'),
  @JsonValue(r'referentiels')
  referentiels(r'referentiels'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const PurgeDomainKey(this.value);

  final String value;

  @override
  String toString() => value;
}
