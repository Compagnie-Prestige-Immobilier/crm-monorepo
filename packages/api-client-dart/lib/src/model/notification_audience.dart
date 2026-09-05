//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum NotificationAudience {
      @JsonValue(r'ALL')
      ALL(r'ALL'),
      @JsonValue(r'ROLE')
      ROLE(r'ROLE'),
      @JsonValue(r'DEPARTEMENT')
      DEPARTEMENT(r'DEPARTEMENT'),
      @JsonValue(r'USERS')
      USERS(r'USERS'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const NotificationAudience(this.value);

  final String value;

  @override
  String toString() => value;
}
