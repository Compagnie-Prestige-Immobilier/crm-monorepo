//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'phase2_page_meta_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Phase2PageMetaDto {
  /// Returns a new [Phase2PageMetaDto] instance.
  Phase2PageMetaDto({
    required this.total,

    required this.page,

    required this.pageSize,

    required this.pageCount,
  });

  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final num total;

  @JsonKey(name: r'page', required: true, includeIfNull: false)
  final num page;

  @JsonKey(name: r'pageSize', required: true, includeIfNull: false)
  final num pageSize;

  @JsonKey(name: r'pageCount', required: true, includeIfNull: false)
  final num pageCount;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is Phase2PageMetaDto &&
            runtimeType == other.runtimeType &&
            equals(
              [total, page, pageSize, pageCount],
              [other.total, other.page, other.pageSize, other.pageCount],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([total, page, pageSize, pageCount]);

  factory Phase2PageMetaDto.fromJson(Map<String, dynamic> json) =>
      _$Phase2PageMetaDtoFromJson(json);

  Map<String, dynamic> toJson() => _$Phase2PageMetaDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
