import 'package:crm_api_client/src/model/analytics_finance_dto.dart';
import 'package:crm_api_client/src/model/analytics_funnel_dto.dart';
import 'package:crm_api_client/src/model/analytics_series_dto.dart';
import 'package:crm_api_client/src/model/analytics_totals_dto.dart';
import 'package:crm_api_client/src/model/app_update_dto.dart';
import 'package:crm_api_client/src/model/audience_preview_dto.dart';
import 'package:crm_api_client/src/model/auth_tokens_dto.dart';
import 'package:crm_api_client/src/model/auth_user_dto.dart';
import 'package:crm_api_client/src/model/bank_agent_activity_dto.dart';
import 'package:crm_api_client/src/model/bank_analytics_totals_dto.dart';
import 'package:crm_api_client/src/model/bank_bank_breakdown_dto.dart';
import 'package:crm_api_client/src/model/bank_case_analytics_dto.dart';
import 'package:crm_api_client/src/model/bank_case_detail_dto.dart';
import 'package:crm_api_client/src/model/bank_case_dto.dart';
import 'package:crm_api_client/src/model/bank_case_list_dto.dart';
import 'package:crm_api_client/src/model/bank_case_stage_dto.dart';
import 'package:crm_api_client/src/model/bank_case_stage_list_dto.dart';
import 'package:crm_api_client/src/model/bank_case_transition_dto.dart';
import 'package:crm_api_client/src/model/bank_rejection_breakdown_dto.dart';
import 'package:crm_api_client/src/model/bank_rejection_reason_dto.dart';
import 'package:crm_api_client/src/model/bank_rejection_reason_list_dto.dart';
import 'package:crm_api_client/src/model/bank_stage_count_dto.dart';
import 'package:crm_api_client/src/model/bank_time_bucket_dto.dart';
import 'package:crm_api_client/src/model/banque_dto.dart';
import 'package:crm_api_client/src/model/campaign_attempt_dto.dart';
import 'package:crm_api_client/src/model/campaign_commercial_dto.dart';
import 'package:crm_api_client/src/model/campaign_detail_dto.dart';
import 'package:crm_api_client/src/model/campaign_list_dto.dart';
import 'package:crm_api_client/src/model/campaign_progress_dto.dart';
import 'package:crm_api_client/src/model/campaign_summary_dto.dart';
import 'package:crm_api_client/src/model/create_bank_case_correction_dto.dart';
import 'package:crm_api_client/src/model/create_bank_case_dto.dart';
import 'package:crm_api_client/src/model/create_bank_case_stage_dto.dart';
import 'package:crm_api_client/src/model/create_bank_case_transition_dto.dart';
import 'package:crm_api_client/src/model/create_banque_dto.dart';
import 'package:crm_api_client/src/model/create_campaign_dto.dart';
import 'package:crm_api_client/src/model/create_departement_dto.dart';
import 'package:crm_api_client/src/model/create_notification_dto.dart';
import 'package:crm_api_client/src/model/create_notification_template_dto.dart';
import 'package:crm_api_client/src/model/create_prospect_dto.dart';
import 'package:crm_api_client/src/model/create_representant_dto.dart';
import 'package:crm_api_client/src/model/create_syndicat_dto.dart';
import 'package:crm_api_client/src/model/create_user_dto.dart';
import 'package:crm_api_client/src/model/demo_counts_dto.dart';
import 'package:crm_api_client/src/model/demo_status_dto.dart';
import 'package:crm_api_client/src/model/departement_dto.dart';
import 'package:crm_api_client/src/model/device_token_dto.dart';
import 'package:crm_api_client/src/model/directory_entry_dto.dart';
import 'package:crm_api_client/src/model/directory_page_dto.dart';
import 'package:crm_api_client/src/model/enrollment_method_count_dto.dart';
import 'package:crm_api_client/src/model/enrollment_method_list_dto.dart';
import 'package:crm_api_client/src/model/funnel_stage_dto.dart';
import 'package:crm_api_client/src/model/inbox_dto.dart';
import 'package:crm_api_client/src/model/inbox_item_dto.dart';
import 'package:crm_api_client/src/model/login_dto.dart';
import 'package:crm_api_client/src/model/logout_response_dto.dart';
import 'package:crm_api_client/src/model/merge_prospects_dto.dart';
import 'package:crm_api_client/src/model/named_count_dto.dart';
import 'package:crm_api_client/src/model/named_count_list_dto.dart';
import 'package:crm_api_client/src/model/notification_delivery_counts_dto.dart';
import 'package:crm_api_client/src/model/notification_detail_dto.dart';
import 'package:crm_api_client/src/model/notification_dto.dart';
import 'package:crm_api_client/src/model/notification_list_dto.dart';
import 'package:crm_api_client/src/model/notification_recipient_dto.dart';
import 'package:crm_api_client/src/model/notification_template_dto.dart';
import 'package:crm_api_client/src/model/notification_template_list_dto.dart';
import 'package:crm_api_client/src/model/ok_dto.dart';
import 'package:crm_api_client/src/model/page_meta_dto.dart';
import 'package:crm_api_client/src/model/phase2_page_meta_dto.dart';
import 'package:crm_api_client/src/model/phase2_status_count_dto.dart';
import 'package:crm_api_client/src/model/phase2_status_list_dto.dart';
import 'package:crm_api_client/src/model/presence_counts_dto.dart';
import 'package:crm_api_client/src/model/prospect_conflict_dto.dart';
import 'package:crm_api_client/src/model/prospect_conflict_existing_dto.dart';
import 'package:crm_api_client/src/model/prospect_dto.dart';
import 'package:crm_api_client/src/model/prospect_list_dto.dart';
import 'package:crm_api_client/src/model/prospect_search_item_dto.dart';
import 'package:crm_api_client/src/model/prospect_search_list_dto.dart';
import 'package:crm_api_client/src/model/purge_catalog_dto.dart';
import 'package:crm_api_client/src/model/purge_deletion_dto.dart';
import 'package:crm_api_client/src/model/purge_domain_dto.dart';
import 'package:crm_api_client/src/model/purge_request_dto.dart';
import 'package:crm_api_client/src/model/purge_result_dto.dart';
import 'package:crm_api_client/src/model/reassign_prospects_dto.dart';
import 'package:crm_api_client/src/model/reassign_result_dto.dart';
import 'package:crm_api_client/src/model/referentiels_bundle_dto.dart';
import 'package:crm_api_client/src/model/refresh_dto.dart';
import 'package:crm_api_client/src/model/region_dto.dart';
import 'package:crm_api_client/src/model/region_with_departements_dto.dart';
import 'package:crm_api_client/src/model/register_device_dto.dart';
import 'package:crm_api_client/src/model/render_template_dto.dart';
import 'package:crm_api_client/src/model/rendered_template_dto.dart';
import 'package:crm_api_client/src/model/reorder_bank_case_stages_dto.dart';
import 'package:crm_api_client/src/model/representant_dto.dart';
import 'package:crm_api_client/src/model/representant_list_dto.dart';
import 'package:crm_api_client/src/model/representant_lookup_dto.dart';
import 'package:crm_api_client/src/model/reset_password_dto.dart';
import 'package:crm_api_client/src/model/segment_count_dto.dart';
import 'package:crm_api_client/src/model/segment_list_dto.dart';
import 'package:crm_api_client/src/model/set_active_dto.dart';
import 'package:crm_api_client/src/model/set_bank_case_stage_active_dto.dart';
import 'package:crm_api_client/src/model/supervised_user_dto.dart';
import 'package:crm_api_client/src/model/supervision_dto.dart';
import 'package:crm_api_client/src/model/sync_changes_dto.dart';
import 'package:crm_api_client/src/model/sync_deletion_dto.dart';
import 'package:crm_api_client/src/model/sync_entity_data_dto.dart';
import 'package:crm_api_client/src/model/sync_operation_dto.dart';
import 'package:crm_api_client/src/model/sync_operation_result_dto.dart';
import 'package:crm_api_client/src/model/sync_pull_response_dto.dart';
import 'package:crm_api_client/src/model/sync_push_dto.dart';
import 'package:crm_api_client/src/model/sync_push_response_dto.dart';
import 'package:crm_api_client/src/model/syndicat_dto.dart';
import 'package:crm_api_client/src/model/time_bucket_dto.dart';
import 'package:crm_api_client/src/model/top_commercial_dto.dart';
import 'package:crm_api_client/src/model/top_commercial_list_dto.dart';
import 'package:crm_api_client/src/model/top_representant_dto.dart';
import 'package:crm_api_client/src/model/top_representant_list_dto.dart';
import 'package:crm_api_client/src/model/unregister_device_dto.dart';
import 'package:crm_api_client/src/model/update_bank_case_dto.dart';
import 'package:crm_api_client/src/model/update_bank_case_stage_dto.dart';
import 'package:crm_api_client/src/model/update_banque_dto.dart';
import 'package:crm_api_client/src/model/update_departement_dto.dart';
import 'package:crm_api_client/src/model/update_notification_template_dto.dart';
import 'package:crm_api_client/src/model/update_prospect_dto.dart';
import 'package:crm_api_client/src/model/update_representant_dto.dart';
import 'package:crm_api_client/src/model/update_syndicat_dto.dart';
import 'package:crm_api_client/src/model/update_user_dto.dart';
import 'package:crm_api_client/src/model/user_dto.dart';
import 'package:crm_api_client/src/model/user_list_dto.dart';

final _regList = RegExp(r'^List<(.*)>$');
final _regSet = RegExp(r'^Set<(.*)>$');
final _regMap = RegExp(r'^Map<String,(.*)>$');

ReturnType deserialize<ReturnType, BaseType>(
  dynamic value,
  String targetType, {
  bool growable = true,
}) {
  switch (targetType) {
    case 'String':
      return '$value' as ReturnType;
    case 'int':
      return (value is int ? value : int.parse('$value')) as ReturnType;
    case 'bool':
      if (value is bool) {
        return value as ReturnType;
      }
      final valueString = '$value'.toLowerCase();
      return (valueString == 'true' || valueString == '1') as ReturnType;
    case 'double':
      return (value is double ? value : double.parse('$value')) as ReturnType;
    case 'AnalyticsFinanceDto':
      return AnalyticsFinanceDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AnalyticsFunnelDto':
      return AnalyticsFunnelDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AnalyticsSeriesDto':
      return AnalyticsSeriesDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AnalyticsTotalsDto':
      return AnalyticsTotalsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AppUpdateDto':
      return AppUpdateDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'AudiencePreviewDto':
      return AudiencePreviewDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AuthTokensDto':
      return AuthTokensDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AuthUserDto':
      return AuthUserDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'BankAgentActivityDto':
      return BankAgentActivityDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankAnalyticsTotalsDto':
      return BankAnalyticsTotalsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankBankBreakdownDto':
      return BankBankBreakdownDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankCaseAnalyticsDto':
      return BankCaseAnalyticsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankCaseDetailDto':
      return BankCaseDetailDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankCaseDto':
      return BankCaseDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'BankCaseListDto':
      return BankCaseListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankCaseSortField':
    case 'BankCaseStageDto':
      return BankCaseStageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankCaseStageListDto':
      return BankCaseStageListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankCaseTransitionDto':
      return BankCaseTransitionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankRejectionBreakdownDto':
      return BankRejectionBreakdownDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankRejectionReasonDto':
      return BankRejectionReasonDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankRejectionReasonListDto':
      return BankRejectionReasonListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankStageCountDto':
      return BankStageCountDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankStageType':
    case 'BankTimeBucketDto':
      return BankTimeBucketDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankTimeGranularity':
    case 'BanqueDto':
      return BanqueDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'BddSegment':
    case 'CallOutcome':
    case 'CampaignAttemptDto':
      return CampaignAttemptDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CampaignCommercialDto':
      return CampaignCommercialDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CampaignDetailDto':
      return CampaignDetailDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CampaignListDto':
      return CampaignListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CampaignProgressDto':
      return CampaignProgressDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CampaignScope':
    case 'CampaignStatus':
    case 'CampaignSummaryDto':
      return CampaignSummaryDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateBankCaseCorrectionDto':
      return CreateBankCaseCorrectionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateBankCaseDto':
      return CreateBankCaseDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateBankCaseStageDto':
      return CreateBankCaseStageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateBankCaseTransitionDto':
      return CreateBankCaseTransitionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateBanqueDto':
      return CreateBanqueDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateCampaignDto':
      return CreateCampaignDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateDepartementDto':
      return CreateDepartementDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateNotificationDto':
      return CreateNotificationDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateNotificationTemplateDto':
      return CreateNotificationTemplateDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'CreateProspectDto':
      return CreateProspectDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateRepresentantDto':
      return CreateRepresentantDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateSyndicatDto':
      return CreateSyndicatDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateUserDto':
      return CreateUserDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DemoCountsDto':
      return DemoCountsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DemoStatusDto':
      return DemoStatusDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DepartementDto':
      return DepartementDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DevicePlatform':
    case 'DeviceTokenDto':
      return DeviceTokenDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DirectoryEntryDto':
      return DirectoryEntryDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DirectoryPageDto':
      return DirectoryPageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'EnrollmentMethod':
    case 'EnrollmentMethodCountDto':
      return EnrollmentMethodCountDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'EnrollmentMethodListDto':
      return EnrollmentMethodListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ExportMode':
    case 'FunnelStageDto':
      return FunnelStageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'InboxDto':
      return InboxDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'InboxItemDto':
      return InboxItemDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'LoginDto':
      return LoginDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'LogoutResponseDto':
      return LogoutResponseDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MergeProspectsDto':
      return MergeProspectsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'NamedCountDto':
      return NamedCountDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'NamedCountListDto':
      return NamedCountListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'NotificationAudience':
    case 'NotificationCategory':
    case 'NotificationDeliveryCountsDto':
      return NotificationDeliveryCountsDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'NotificationDeliveryStatus':
    case 'NotificationDetailDto':
      return NotificationDetailDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'NotificationDto':
      return NotificationDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'NotificationListDto':
      return NotificationListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'NotificationRecipientDto':
      return NotificationRecipientDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'NotificationStatus':
    case 'NotificationTemplateDto':
      return NotificationTemplateDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'NotificationTemplateListDto':
      return NotificationTemplateListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OkDto':
      return OkDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'PageMetaDto':
      return PageMetaDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'Phase2PageMetaDto':
      return Phase2PageMetaDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Phase2Status':
    case 'Phase2StatusCountDto':
      return Phase2StatusCountDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Phase2StatusListDto':
      return Phase2StatusListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PresenceCountsDto':
      return PresenceCountsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PresenceState':
    case 'ProspectConflictDto':
      return ProspectConflictDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProspectConflictExistingDto':
      return ProspectConflictExistingDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProspectDto':
      return ProspectDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ProspectListDto':
      return ProspectListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProspectSearchItemDto':
      return ProspectSearchItemDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProspectSearchListDto':
      return ProspectSearchListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProspectSortField':
    case 'ProspectStatut':
    case 'PurgeCatalogDto':
      return PurgeCatalogDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PurgeDeletionDto':
      return PurgeDeletionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PurgeDomainDto':
      return PurgeDomainDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PurgeDomainKey':
    case 'PurgeRequestDto':
      return PurgeRequestDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PurgeResultDto':
      return PurgeResultDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ReassignProspectsDto':
      return ReassignProspectsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ReassignResultDto':
      return ReassignResultDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ReferentielsBundleDto':
      return ReferentielsBundleDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RefreshDto':
      return RefreshDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'RegionDto':
      return RegionDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'RegionWithDepartementsDto':
      return RegionWithDepartementsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RegisterDeviceDto':
      return RegisterDeviceDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RenderTemplateDto':
      return RenderTemplateDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RenderedTemplateDto':
      return RenderedTemplateDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ReorderBankCaseStagesDto':
      return ReorderBankCaseStagesDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantDto':
      return RepresentantDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantListDto':
      return RepresentantListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantLookupDto':
      return RepresentantLookupDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ResetPasswordDto':
      return ResetPasswordDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Role':
    case 'SegmentCountDto':
      return SegmentCountDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SegmentListDto':
      return SegmentListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SetActiveDto':
      return SetActiveDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'SetBankCaseStageActiveDto':
      return SetBankCaseStageActiveDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SortOrder':
    case 'SupervisedUserDto':
      return SupervisedUserDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SupervisionDto':
      return SupervisionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SyncChangesDto':
      return SyncChangesDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SyncDeletionDto':
      return SyncDeletionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SyncEntity':
    case 'SyncEntityDataDto':
      return SyncEntityDataDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SyncOp':
    case 'SyncOpStatus':
    case 'SyncOperationDto':
      return SyncOperationDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SyncOperationResultDto':
      return SyncOperationResultDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SyncPullResponseDto':
      return SyncPullResponseDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SyncPushDto':
      return SyncPushDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'SyncPushResponseDto':
      return SyncPushResponseDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SyndicatDto':
      return SyndicatDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'TimeBucketDto':
      return TimeBucketDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'TimeGranularity':
    case 'TopCommercialDto':
      return TopCommercialDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'TopCommercialListDto':
      return TopCommercialListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'TopRepresentantDto':
      return TopRepresentantDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'TopRepresentantListDto':
      return TopRepresentantListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UnregisterDeviceDto':
      return UnregisterDeviceDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateBankCaseDto':
      return UpdateBankCaseDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateBankCaseStageDto':
      return UpdateBankCaseStageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateBanqueDto':
      return UpdateBanqueDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateDepartementDto':
      return UpdateDepartementDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateNotificationTemplateDto':
      return UpdateNotificationTemplateDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'UpdateProspectDto':
      return UpdateProspectDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateRepresentantDto':
      return UpdateRepresentantDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateSyndicatDto':
      return UpdateSyndicatDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateUserDto':
      return UpdateUserDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UserDto':
      return UserDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'UserListDto':
      return UserListDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    default:
      RegExpMatch? match;

      if (value is List && (match = _regList.firstMatch(targetType)) != null) {
        targetType = match![1]!; // ignore: parameter_assignments
        return value
                .map<BaseType>(
                  (dynamic v) => deserialize<BaseType, BaseType>(
                    v,
                    targetType,
                    growable: growable,
                  ),
                )
                .toList(growable: growable)
            as ReturnType;
      }
      if (value is Set && (match = _regSet.firstMatch(targetType)) != null) {
        targetType = match![1]!; // ignore: parameter_assignments
        return value
                .map<BaseType>(
                  (dynamic v) => deserialize<BaseType, BaseType>(
                    v,
                    targetType,
                    growable: growable,
                  ),
                )
                .toSet()
            as ReturnType;
      }
      if (value is Map && (match = _regMap.firstMatch(targetType)) != null) {
        targetType = match![1]!.trim(); // ignore: parameter_assignments
        return Map<String, BaseType>.fromIterables(
              value.keys as Iterable<String>,
              value.values.map(
                (dynamic v) => deserialize<BaseType, BaseType>(
                  v,
                  targetType,
                  growable: growable,
                ),
              ),
            )
            as ReturnType;
      }
      break;
  }
  throw Exception('Cannot deserialize');
}
