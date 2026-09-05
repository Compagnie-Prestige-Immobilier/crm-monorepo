//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/origin_label_count_dto.dart';
import 'package:crm_api_client/src/model/origin_count_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'origin_breakdown_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OriginBreakdownDto {
  /// Returns a new [OriginBreakdownDto] instance.
  OriginBreakdownDto({
    required this.items,

    required this.byLabel,

    required this.total,
  });

  /// Premier niveau : la provenance.
  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<OriginCountDto> items;

  /// Second niveau : le détail lisible, à provenance égale.
  @JsonKey(name: r'byLabel', required: true, includeIfNull: false)
  final List<OriginLabelCountDto> byLabel;

  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final num total;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is OriginBreakdownDto &&
            runtimeType == other.runtimeType &&
            equals(
              [items, byLabel, total],
              [other.items, other.byLabel, other.total],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([items, byLabel, total]);

  factory OriginBreakdownDto.fromJson(Map<String, dynamic> json) =>
      _$OriginBreakdownDtoFromJson(json);

  Map<String, dynamic> toJson() => _$OriginBreakdownDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
