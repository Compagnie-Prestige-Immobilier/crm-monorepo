//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/change_source.dart';
import 'package:crm_api_client/src/model/bdd_segment.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'segment_change_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SegmentChangeDto {
  /// Returns a new [SegmentChangeDto] instance.
  SegmentChangeDto({
    required this.id,

    required this.prospectId,

    required this.fromSegment,

    required this.toSegment,

    required this.fromBanqueId,

    required this.toBanqueId,

    required this.fromSyndicatId,

    required this.toSyndicatId,

    required this.reason,

    required this.changedById,

    required this.changedByName,

    required this.source_,

    required this.changedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'prospectId', required: true, includeIfNull: false)
  final String prospectId;

  @JsonKey(
    name: r'fromSegment',
    required: true,
    includeIfNull: false,
    unknownEnumValue: BddSegment.unknownDefaultOpenApi,
  )
  final BddSegment fromSegment;

  @JsonKey(
    name: r'toSegment',
    required: true,
    includeIfNull: false,
    unknownEnumValue: BddSegment.unknownDefaultOpenApi,
  )
  final BddSegment toSegment;

  @JsonKey(name: r'fromBanqueId', required: true, includeIfNull: false)
  final String fromBanqueId;

  @JsonKey(name: r'toBanqueId', required: true, includeIfNull: false)
  final String toBanqueId;

  @JsonKey(name: r'fromSyndicatId', required: true, includeIfNull: false)
  final String fromSyndicatId;

  @JsonKey(name: r'toSyndicatId', required: true, includeIfNull: false)
  final String toSyndicatId;

  @JsonKey(name: r'reason', required: true, includeIfNull: true)
  final String? reason;

  @JsonKey(name: r'changedById', required: true, includeIfNull: false)
  final String changedById;

  @JsonKey(name: r'changedByName', required: true, includeIfNull: false)
  final String changedByName;

  /// Le canal qui a écrit la bascule. Le panel écrit WEB.
  @JsonKey(
    name: r'source',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ChangeSource.unknownDefaultOpenApi,
  )
  final ChangeSource source_;

  @JsonKey(name: r'changedAt', required: true, includeIfNull: false)
  final DateTime changedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SegmentChangeDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                prospectId,
                fromSegment,
                toSegment,
                fromBanqueId,
                toBanqueId,
                fromSyndicatId,
                toSyndicatId,
                reason,
                changedById,
                changedByName,
                source_,
                changedAt,
              ],
              [
                other.id,
                other.prospectId,
                other.fromSegment,
                other.toSegment,
                other.fromBanqueId,
                other.toBanqueId,
                other.fromSyndicatId,
                other.toSyndicatId,
                other.reason,
                other.changedById,
                other.changedByName,
                other.source_,
                other.changedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        prospectId,
        fromSegment,
        toSegment,
        fromBanqueId,
        toBanqueId,
        fromSyndicatId,
        toSyndicatId,
        reason,
        changedById,
        changedByName,
        source_,
        changedAt,
      ]);

  factory SegmentChangeDto.fromJson(Map<String, dynamic> json) =>
      _$SegmentChangeDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SegmentChangeDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
