//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'presence_counts_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PresenceCountsDto {
  /// Returns a new [PresenceCountsDto] instance.
  PresenceCountsDto({
    required this.online,

    required this.recent,

    required this.away,
  });

  @JsonKey(name: r'online', required: true, includeIfNull: false)
  final num online;

  @JsonKey(name: r'recent', required: true, includeIfNull: false)
  final num recent;

  @JsonKey(name: r'away', required: true, includeIfNull: false)
  final num away;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is PresenceCountsDto &&
            runtimeType == other.runtimeType &&
            equals(
              [online, recent, away],
              [other.online, other.recent, other.away],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([online, recent, away]);

  factory PresenceCountsDto.fromJson(Map<String, dynamic> json) =>
      _$PresenceCountsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PresenceCountsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
