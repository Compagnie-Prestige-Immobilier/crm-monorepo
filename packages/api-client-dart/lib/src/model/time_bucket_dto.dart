//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'time_bucket_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TimeBucketDto {
  /// Returns a new [TimeBucketDto] instance.
  TimeBucketDto({
    required this.bucket,

    required this.prospects,

    required this.representants,
  });

  /// Début de la période.
  @JsonKey(name: r'bucket', required: true, includeIfNull: false)
  final DateTime bucket;

  @JsonKey(name: r'prospects', required: true, includeIfNull: false)
  final num prospects;

  @JsonKey(name: r'representants', required: true, includeIfNull: false)
  final num representants;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is TimeBucketDto &&
            runtimeType == other.runtimeType &&
            equals(
              [bucket, prospects, representants],
              [other.bucket, other.prospects, other.representants],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([bucket, prospects, representants]);

  factory TimeBucketDto.fromJson(Map<String, dynamic> json) =>
      _$TimeBucketDtoFromJson(json);

  Map<String, dynamic> toJson() => _$TimeBucketDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
