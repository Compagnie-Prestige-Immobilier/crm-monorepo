//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';


enum SyncOp {
      @JsonValue(r'create')
      create(r'create'),
      @JsonValue(r'update')
      update(r'update'),
      @JsonValue(r'delete')
      delete(r'delete'),
      @JsonValue(r'unknown_default_open_api')
      unknownDefaultOpenApi(r'unknown_default_open_api');

  const SyncOp(this.value);

  final String value;

  @override
  String toString() => value;
}
