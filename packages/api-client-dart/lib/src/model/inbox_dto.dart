//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/inbox_item_dto.dart';
import 'package:crm_api_client/src/model/page_meta_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'inbox_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class InboxDto {
  /// Returns a new [InboxDto] instance.
  InboxDto({
    required this.items,

    required this.unreadCount,

    required this.meta,
  });

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<InboxItemDto> items;

  @JsonKey(name: r'unreadCount', required: true, includeIfNull: false)
  final num unreadCount;

  @JsonKey(name: r'meta', required: true, includeIfNull: false)
  final PageMetaDto meta;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is InboxDto &&
            runtimeType == other.runtimeType &&
            equals(
              [items, unreadCount, meta],
              [other.items, other.unreadCount, other.meta],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([items, unreadCount, meta]);

  factory InboxDto.fromJson(Map<String, dynamic> json) =>
      _$InboxDtoFromJson(json);

  Map<String, dynamic> toJson() => _$InboxDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
