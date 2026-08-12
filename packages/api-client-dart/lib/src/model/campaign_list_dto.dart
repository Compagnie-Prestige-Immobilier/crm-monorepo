//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/campaign_summary_dto.dart';
import 'package:crm_api_client/src/model/phase2_page_meta_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'campaign_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CampaignListDto {
  /// Returns a new [CampaignListDto] instance.
  CampaignListDto({required this.items, required this.meta});

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<CampaignSummaryDto> items;

  @JsonKey(name: r'meta', required: true, includeIfNull: false)
  final Phase2PageMetaDto meta;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CampaignListDto &&
            runtimeType == other.runtimeType &&
            equals([items, meta], [other.items, other.meta]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([items, meta]);

  factory CampaignListDto.fromJson(Map<String, dynamic> json) =>
      _$CampaignListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CampaignListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
