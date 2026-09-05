//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/segment_count_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'segment_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SegmentListDto {
  /// Returns a new [SegmentListDto] instance.
  SegmentListDto({required this.items, required this.total});

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<SegmentCountDto> items;

  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final num total;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SegmentListDto &&
            runtimeType == other.runtimeType &&
            equals([items, total], [other.items, other.total]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([items, total]);

  factory SegmentListDto.fromJson(Map<String, dynamic> json) =>
      _$SegmentListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SegmentListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
