//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'demo_counts_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DemoCountsDto {
  /// Returns a new [DemoCountsDto] instance.
  DemoCountsDto({
    required this.users,

    required this.representants,

    required this.prospects,

    required this.campaigns,

    required this.campaignCommerciaux,

    required this.callTasks,

    required this.callAttempts,

    required this.bankCases,

    required this.bankCaseTransitions,
  });

  @JsonKey(name: r'users', required: true, includeIfNull: false)
  final num users;

  @JsonKey(name: r'representants', required: true, includeIfNull: false)
  final num representants;

  @JsonKey(name: r'prospects', required: true, includeIfNull: false)
  final num prospects;

  @JsonKey(name: r'campaigns', required: true, includeIfNull: false)
  final num campaigns;

  @JsonKey(name: r'campaignCommerciaux', required: true, includeIfNull: false)
  final num campaignCommerciaux;

  @JsonKey(name: r'callTasks', required: true, includeIfNull: false)
  final num callTasks;

  @JsonKey(name: r'callAttempts', required: true, includeIfNull: false)
  final num callAttempts;

  @JsonKey(name: r'bankCases', required: true, includeIfNull: false)
  final num bankCases;

  @JsonKey(name: r'bankCaseTransitions', required: true, includeIfNull: false)
  final num bankCaseTransitions;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DemoCountsDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                users,
                representants,
                prospects,
                campaigns,
                campaignCommerciaux,
                callTasks,
                callAttempts,
                bankCases,
                bankCaseTransitions,
              ],
              [
                other.users,
                other.representants,
                other.prospects,
                other.campaigns,
                other.campaignCommerciaux,
                other.callTasks,
                other.callAttempts,
                other.bankCases,
                other.bankCaseTransitions,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        users,
        representants,
        prospects,
        campaigns,
        campaignCommerciaux,
        callTasks,
        callAttempts,
        bankCases,
        bankCaseTransitions,
      ]);

  factory DemoCountsDto.fromJson(Map<String, dynamic> json) =>
      _$DemoCountsDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DemoCountsDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
