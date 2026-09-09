//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/purge_domain_key.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'purge_domain_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PurgeDomainDto {
  /// Returns a new [PurgeDomainDto] instance.
  PurgeDomainDto({
    required this.key,

    required this.label,

    required this.hint,

    required this.requires,

    required this.rows,
  });

  @JsonKey(
    name: r'key',
    required: true,
    includeIfNull: false,
    unknownEnumValue: PurgeDomainKey.unknownDefaultOpenApi,
  )
  final PurgeDomainKey key;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'hint', required: true, includeIfNull: false)
  final String hint;

  /// Domaines entraînés par celui-ci, clés étrangères obligent. L’écran les coche avec lui.
  @JsonKey(name: r'requires', required: true, includeIfNull: false)
  final List<String> requires;

  /// Lignes actuellement concernées.
  @JsonKey(name: r'rows', required: true, includeIfNull: false)
  final num rows;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is PurgeDomainDto &&
            runtimeType == other.runtimeType &&
            equals(
              [key, label, hint, requires, rows],
              [other.key, other.label, other.hint, other.requires, other.rows],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([key, label, hint, requires, rows]);

  factory PurgeDomainDto.fromJson(Map<String, dynamic> json) =>
      _$PurgeDomainDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PurgeDomainDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
