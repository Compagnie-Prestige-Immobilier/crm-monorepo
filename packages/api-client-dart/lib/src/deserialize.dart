import 'package:crm_api_client/src/model/ambassador_conversion_dto.dart';
import 'package:crm_api_client/src/model/analytics_delays_dto.dart';
import 'package:crm_api_client/src/model/analytics_finance_dto.dart';
import 'package:crm_api_client/src/model/analytics_funnel_dto.dart';
import 'package:crm_api_client/src/model/analytics_series_dto.dart';
import 'package:crm_api_client/src/model/analytics_totals_dto.dart';
import 'package:crm_api_client/src/model/android_release_dto.dart';
import 'package:crm_api_client/src/model/android_release_list_dto.dart';
import 'package:crm_api_client/src/model/api_error_dto.dart';
import 'package:crm_api_client/src/model/app_update_dto.dart';
import 'package:crm_api_client/src/model/approve_client_request_dto.dart';
import 'package:crm_api_client/src/model/audience_preview_dto.dart';
import 'package:crm_api_client/src/model/auth_tokens_dto.dart';
import 'package:crm_api_client/src/model/auth_user_dto.dart';
import 'package:crm_api_client/src/model/bank_agent_activity_dto.dart';
import 'package:crm_api_client/src/model/bank_aging_bucket_dto.dart';
import 'package:crm_api_client/src/model/bank_aging_dto.dart';
import 'package:crm_api_client/src/model/bank_aging_stage_dto.dart';
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
import 'package:crm_api_client/src/model/call_outcome_reason_dto.dart';
import 'package:crm_api_client/src/model/call_outcome_reason_list_dto.dart';
import 'package:crm_api_client/src/model/call_recording_dto.dart';
import 'package:crm_api_client/src/model/callback_dto.dart';
import 'package:crm_api_client/src/model/callback_list_dto.dart';
import 'package:crm_api_client/src/model/canal_provenance_dto.dart';
import 'package:crm_api_client/src/model/champ_libre_dto.dart';
import 'package:crm_api_client/src/model/champ_libre_input_dto.dart';
import 'package:crm_api_client/src/model/change_my_password_dto.dart';
import 'package:crm_api_client/src/model/change_prospect_segment_dto.dart';
import 'package:crm_api_client/src/model/client_request_dto.dart';
import 'package:crm_api_client/src/model/client_request_list_dto.dart';
import 'package:crm_api_client/src/model/comptage_ouvertures_dto.dart';
import 'package:crm_api_client/src/model/comptage_ouvertures_jour_dto.dart';
import 'package:crm_api_client/src/model/confirm_grand_public_conversion_dto.dart';
import 'package:crm_api_client/src/model/create_bank_case_correction_dto.dart';
import 'package:crm_api_client/src/model/create_bank_case_dto.dart';
import 'package:crm_api_client/src/model/create_bank_case_stage_dto.dart';
import 'package:crm_api_client/src/model/create_bank_case_transition_dto.dart';
import 'package:crm_api_client/src/model/create_banque_dto.dart';
import 'package:crm_api_client/src/model/create_call_outcome_reason_dto.dart';
import 'package:crm_api_client/src/model/create_canal_provenance_dto.dart';
import 'package:crm_api_client/src/model/create_client_request_dto.dart';
import 'package:crm_api_client/src/model/create_departement_dto.dart';
import 'package:crm_api_client/src/model/create_employeur_dto.dart';
import 'package:crm_api_client/src/model/create_income_band_dto.dart';
import 'package:crm_api_client/src/model/create_lot_export_dto.dart';
import 'package:crm_api_client/src/model/create_notification_dto.dart';
import 'package:crm_api_client/src/model/create_notification_template_dto.dart';
import 'package:crm_api_client/src/model/create_offer_dto.dart';
import 'package:crm_api_client/src/model/create_profession_dto.dart';
import 'package:crm_api_client/src/model/create_prospect_dto.dart';
import 'package:crm_api_client/src/model/create_rep_call_attempt_dto.dart';
import 'package:crm_api_client/src/model/create_representant_comment_dto.dart';
import 'package:crm_api_client/src/model/create_representant_dto.dart';
import 'package:crm_api_client/src/model/create_statut_qualification_dto.dart';
import 'package:crm_api_client/src/model/create_syndicat_dto.dart';
import 'package:crm_api_client/src/model/create_user_dto.dart';
import 'package:crm_api_client/src/model/create_visite_dto.dart';
import 'package:crm_api_client/src/model/create_visite_referentiel_dto.dart';
import 'package:crm_api_client/src/model/data_quality_dto.dart';
import 'package:crm_api_client/src/model/data_quality_row_dto.dart';
import 'package:crm_api_client/src/model/database_dump_job_dto.dart';
import 'package:crm_api_client/src/model/delai_median_dto.dart';
import 'package:crm_api_client/src/model/delay_leg_dto.dart';
import 'package:crm_api_client/src/model/demo_workspace_counts_dto.dart';
import 'package:crm_api_client/src/model/demo_workspace_status_dto.dart';
import 'package:crm_api_client/src/model/departement_dto.dart';
import 'package:crm_api_client/src/model/departement_yield_dto.dart';
import 'package:crm_api_client/src/model/departement_yield_list_dto.dart';
import 'package:crm_api_client/src/model/dernier_tirage_dto.dart';
import 'package:crm_api_client/src/model/device_call_detection_dto.dart';
import 'package:crm_api_client/src/model/device_call_detection_list_dto.dart';
import 'package:crm_api_client/src/model/directory_entry_dto.dart';
import 'package:crm_api_client/src/model/directory_page_dto.dart';
import 'package:crm_api_client/src/model/disposition_presentation_dto.dart';
import 'package:crm_api_client/src/model/disposition_response_dto.dart';
import 'package:crm_api_client/src/model/disposition_widget_dto.dart';
import 'package:crm_api_client/src/model/employeur_dto.dart';
import 'package:crm_api_client/src/model/enregistrer_brouillon_dto.dart';
import 'package:crm_api_client/src/model/enrolement_indicateurs_dto.dart';
import 'package:crm_api_client/src/model/enrolement_reglages_dto.dart';
import 'package:crm_api_client/src/model/enrollment_method_count_dto.dart';
import 'package:crm_api_client/src/model/enrollment_method_list_dto.dart';
import 'package:crm_api_client/src/model/funnel_stage_dto.dart';
import 'package:crm_api_client/src/model/ief_dto.dart';
import 'package:crm_api_client/src/model/import_job_dto.dart';
import 'package:crm_api_client/src/model/import_job_error_dto.dart';
import 'package:crm_api_client/src/model/import_job_list_dto.dart';
import 'package:crm_api_client/src/model/import_job_report_dto.dart';
import 'package:crm_api_client/src/model/import_report_dto.dart';
import 'package:crm_api_client/src/model/import_row_error_dto.dart';
import 'package:crm_api_client/src/model/import_row_preview_dto.dart';
import 'package:crm_api_client/src/model/inbox_dto.dart';
import 'package:crm_api_client/src/model/inbox_item_dto.dart';
import 'package:crm_api_client/src/model/income_band_dto.dart';
import 'package:crm_api_client/src/model/inscription_plateforme_detail_dto.dart';
import 'package:crm_api_client/src/model/inscription_plateforme_dto.dart';
import 'package:crm_api_client/src/model/inscriptions_page_dto.dart';
import 'package:crm_api_client/src/model/login_dto.dart';
import 'package:crm_api_client/src/model/logout_response_dto.dart';
import 'package:crm_api_client/src/model/lot_export_attempt_dto.dart';
import 'package:crm_api_client/src/model/lot_export_detail_dto.dart';
import 'package:crm_api_client/src/model/lot_export_distribution_dto.dart';
import 'package:crm_api_client/src/model/lot_export_distribution_input_dto.dart';
import 'package:crm_api_client/src/model/lot_export_fiche_dto.dart';
import 'package:crm_api_client/src/model/lot_export_fiches_dto.dart';
import 'package:crm_api_client/src/model/lot_export_list_dto.dart';
import 'package:crm_api_client/src/model/lot_export_objectif_dto.dart';
import 'package:crm_api_client/src/model/lot_export_performance_dto.dart';
import 'package:crm_api_client/src/model/lot_export_preview_dto.dart';
import 'package:crm_api_client/src/model/lot_export_prospect_filter_dto.dart';
import 'package:crm_api_client/src/model/lot_export_reaffectation_dto.dart';
import 'package:crm_api_client/src/model/lot_export_repartition_dto.dart';
import 'package:crm_api_client/src/model/lot_export_repartition_jour_dto.dart';
import 'package:crm_api_client/src/model/lot_export_summary_dto.dart';
import 'package:crm_api_client/src/model/merge_prospects_dto.dart';
import 'package:crm_api_client/src/model/mes_attributions_dto.dart';
import 'package:crm_api_client/src/model/named_count_dto.dart';
import 'package:crm_api_client/src/model/named_count_list_dto.dart';
import 'package:crm_api_client/src/model/notification_delivery_counts_dto.dart';
import 'package:crm_api_client/src/model/notification_detail_dto.dart';
import 'package:crm_api_client/src/model/notification_dto.dart';
import 'package:crm_api_client/src/model/notification_list_dto.dart';
import 'package:crm_api_client/src/model/notification_recipient_dto.dart';
import 'package:crm_api_client/src/model/notification_template_dto.dart';
import 'package:crm_api_client/src/model/notification_template_list_dto.dart';
import 'package:crm_api_client/src/model/offer_dto.dart';
import 'package:crm_api_client/src/model/ok_dto.dart';
import 'package:crm_api_client/src/model/origin_breakdown_dto.dart';
import 'package:crm_api_client/src/model/origin_count_dto.dart';
import 'package:crm_api_client/src/model/origin_label_count_dto.dart';
import 'package:crm_api_client/src/model/ouverture_fiche_dto.dart';
import 'package:crm_api_client/src/model/ouverture_fiche_list_dto.dart';
import 'package:crm_api_client/src/model/ouvrir_fiche_dto.dart';
import 'package:crm_api_client/src/model/page_meta_dto.dart';
import 'package:crm_api_client/src/model/pays_dto.dart';
import 'package:crm_api_client/src/model/performance_score.dart';
import 'package:crm_api_client/src/model/phase2_status_count_dto.dart';
import 'package:crm_api_client/src/model/phase2_status_list_dto.dart';
import 'package:crm_api_client/src/model/presence_counts_dto.dart';
import 'package:crm_api_client/src/model/profession_dto.dart';
import 'package:crm_api_client/src/model/prospect_call_attempt_dto.dart';
import 'package:crm_api_client/src/model/prospect_call_attempt_list_dto.dart';
import 'package:crm_api_client/src/model/prospect_conflict_dto.dart';
import 'package:crm_api_client/src/model/prospect_conflict_existing_dto.dart';
import 'package:crm_api_client/src/model/prospect_dto.dart';
import 'package:crm_api_client/src/model/prospect_journey_dto.dart';
import 'package:crm_api_client/src/model/prospect_list_dto.dart';
import 'package:crm_api_client/src/model/prospect_search_item_dto.dart';
import 'package:crm_api_client/src/model/prospect_search_list_dto.dart';
import 'package:crm_api_client/src/model/purge_catalog_dto.dart';
import 'package:crm_api_client/src/model/purge_deletion_dto.dart';
import 'package:crm_api_client/src/model/purge_domain_dto.dart';
import 'package:crm_api_client/src/model/purge_request_dto.dart';
import 'package:crm_api_client/src/model/purge_result_dto.dart';
import 'package:crm_api_client/src/model/reaffecter_lot_export_dto.dart';
import 'package:crm_api_client/src/model/reassign_prospects_dto.dart';
import 'package:crm_api_client/src/model/reassign_result_dto.dart';
import 'package:crm_api_client/src/model/referentiels_bundle_dto.dart';
import 'package:crm_api_client/src/model/refresh_dto.dart';
import 'package:crm_api_client/src/model/region_dto.dart';
import 'package:crm_api_client/src/model/region_with_departements_dto.dart';
import 'package:crm_api_client/src/model/reglage_champ_dto.dart';
import 'package:crm_api_client/src/model/reglage_champ_input_dto.dart';
import 'package:crm_api_client/src/model/reglages_conversion_dto.dart';
import 'package:crm_api_client/src/model/reject_client_request_dto.dart';
import 'package:crm_api_client/src/model/render_template_dto.dart';
import 'package:crm_api_client/src/model/rendered_template_dto.dart';
import 'package:crm_api_client/src/model/reorder_bank_case_stages_dto.dart';
import 'package:crm_api_client/src/model/reorder_visite_referentiel_dto.dart';
import 'package:crm_api_client/src/model/rep_call_attempt_result_dto.dart';
import 'package:crm_api_client/src/model/repartition_dto.dart';
import 'package:crm_api_client/src/model/representant_call_attempt_dto.dart';
import 'package:crm_api_client/src/model/representant_call_attempt_list_dto.dart';
import 'package:crm_api_client/src/model/representant_comment_dto.dart';
import 'package:crm_api_client/src/model/representant_comment_list_dto.dart';
import 'package:crm_api_client/src/model/representant_dto.dart';
import 'package:crm_api_client/src/model/representant_export_query_dto.dart';
import 'package:crm_api_client/src/model/representant_list_dto.dart';
import 'package:crm_api_client/src/model/representant_lookup_dto.dart';
import 'package:crm_api_client/src/model/representant_productivity_dto.dart';
import 'package:crm_api_client/src/model/representant_productivity_list_dto.dart';
import 'package:crm_api_client/src/model/representant_relation_change_dto.dart';
import 'package:crm_api_client/src/model/representant_relation_change_list_dto.dart';
import 'package:crm_api_client/src/model/reset_password_dto.dart';
import 'package:crm_api_client/src/model/retirer_teleconseiller_dto.dart';
import 'package:crm_api_client/src/model/score_part.dart';
import 'package:crm_api_client/src/model/segment_change_dto.dart';
import 'package:crm_api_client/src/model/segment_change_list_dto.dart';
import 'package:crm_api_client/src/model/segment_conversion_author_dto.dart';
import 'package:crm_api_client/src/model/segment_conversion_dto.dart';
import 'package:crm_api_client/src/model/segment_conversion_list_dto.dart';
import 'package:crm_api_client/src/model/segment_conversion_origin_dto.dart';
import 'package:crm_api_client/src/model/segment_count_dto.dart';
import 'package:crm_api_client/src/model/segment_list_dto.dart';
import 'package:crm_api_client/src/model/serie_jour_dto.dart';
import 'package:crm_api_client/src/model/set_active_dto.dart';
import 'package:crm_api_client/src/model/set_bank_case_stage_active_dto.dart';
import 'package:crm_api_client/src/model/set_call_outcome_reason_active_dto.dart';
import 'package:crm_api_client/src/model/set_statut_qualification_active_dto.dart';
import 'package:crm_api_client/src/model/set_visite_import_change_selection_dto.dart';
import 'package:crm_api_client/src/model/set_visite_referentiel_active_dto.dart';
import 'package:crm_api_client/src/model/statut_qualification_dto.dart';
import 'package:crm_api_client/src/model/statut_qualification_list_dto.dart';
import 'package:crm_api_client/src/model/stock_representants_dto.dart';
import 'package:crm_api_client/src/model/stock_representants_part_dto.dart';
import 'package:crm_api_client/src/model/suggestion_dto.dart';
import 'package:crm_api_client/src/model/suggestion_list_dto.dart';
import 'package:crm_api_client/src/model/supervised_user_dto.dart';
import 'package:crm_api_client/src/model/supervision_activity_counts_dto.dart';
import 'package:crm_api_client/src/model/supervision_activity_dto.dart';
import 'package:crm_api_client/src/model/supervision_activity_row_dto.dart';
import 'package:crm_api_client/src/model/supervision_campagne_dto.dart';
import 'package:crm_api_client/src/model/supervision_campagne_teleconseiller_dto.dart';
import 'package:crm_api_client/src/model/supervision_campagnes_dto.dart';
import 'package:crm_api_client/src/model/supervision_campagnes_totaux_dto.dart';
import 'package:crm_api_client/src/model/supervision_dto.dart';
import 'package:crm_api_client/src/model/supervision_histogram_bar_dto.dart';
import 'package:crm_api_client/src/model/supervision_rep_statut_dto.dart';
import 'package:crm_api_client/src/model/supervision_rep_statuts_dto.dart';
import 'package:crm_api_client/src/model/supervision_score_dto.dart';
import 'package:crm_api_client/src/model/supervision_teleconseiller_dto.dart';
import 'package:crm_api_client/src/model/suppression_dto.dart';
import 'package:crm_api_client/src/model/switch_workspace_dto.dart';
import 'package:crm_api_client/src/model/sync_changes_dto.dart';
import 'package:crm_api_client/src/model/sync_deletion_dto.dart';
import 'package:crm_api_client/src/model/sync_entity_data_dto.dart';
import 'package:crm_api_client/src/model/sync_operation_dto.dart';
import 'package:crm_api_client/src/model/sync_operation_result_dto.dart';
import 'package:crm_api_client/src/model/sync_pull_response_dto.dart';
import 'package:crm_api_client/src/model/sync_push_dto.dart';
import 'package:crm_api_client/src/model/sync_push_response_dto.dart';
import 'package:crm_api_client/src/model/sync_visite_dto.dart';
import 'package:crm_api_client/src/model/sync_visite_referentiel_dto.dart';
import 'package:crm_api_client/src/model/syndicat_dto.dart';
import 'package:crm_api_client/src/model/time_bucket_dto.dart';
import 'package:crm_api_client/src/model/tirage_dto.dart';
import 'package:crm_api_client/src/model/top_commercial_dto.dart';
import 'package:crm_api_client/src/model/top_commercial_list_dto.dart';
import 'package:crm_api_client/src/model/top_representant_dto.dart';
import 'package:crm_api_client/src/model/top_representant_list_dto.dart';
import 'package:crm_api_client/src/model/update_bank_case_dto.dart';
import 'package:crm_api_client/src/model/update_bank_case_stage_dto.dart';
import 'package:crm_api_client/src/model/update_banque_dto.dart';
import 'package:crm_api_client/src/model/update_call_outcome_reason_dto.dart';
import 'package:crm_api_client/src/model/update_canal_provenance_dto.dart';
import 'package:crm_api_client/src/model/update_departement_dto.dart';
import 'package:crm_api_client/src/model/update_disposition_dto.dart';
import 'package:crm_api_client/src/model/update_employeur_dto.dart';
import 'package:crm_api_client/src/model/update_enrolement_reglages_dto.dart';
import 'package:crm_api_client/src/model/update_grand_public_consent_dto.dart';
import 'package:crm_api_client/src/model/update_income_band_dto.dart';
import 'package:crm_api_client/src/model/update_lot_export_dto.dart';
import 'package:crm_api_client/src/model/update_notification_template_dto.dart';
import 'package:crm_api_client/src/model/update_offer_dto.dart';
import 'package:crm_api_client/src/model/update_profession_dto.dart';
import 'package:crm_api_client/src/model/update_prospect_dto.dart';
import 'package:crm_api_client/src/model/update_reglages_conversion_dto.dart';
import 'package:crm_api_client/src/model/update_representant_dto.dart';
import 'package:crm_api_client/src/model/update_statut_qualification_dto.dart';
import 'package:crm_api_client/src/model/update_suggestion_status_dto.dart';
import 'package:crm_api_client/src/model/update_syndicat_dto.dart';
import 'package:crm_api_client/src/model/update_user_dto.dart';
import 'package:crm_api_client/src/model/update_visite_dto.dart';
import 'package:crm_api_client/src/model/update_visite_referentiel_dto.dart';
import 'package:crm_api_client/src/model/update_work_shifts_dto.dart';
import 'package:crm_api_client/src/model/user_dto.dart';
import 'package:crm_api_client/src/model/user_list_dto.dart';
import 'package:crm_api_client/src/model/visite_dto.dart';
import 'package:crm_api_client/src/model/visite_import_change_dto.dart';
import 'package:crm_api_client/src/model/visite_import_change_field_dto.dart';
import 'package:crm_api_client/src/model/visite_import_change_list_dto.dart';
import 'package:crm_api_client/src/model/visite_list_dto.dart';
import 'package:crm_api_client/src/model/visite_referentiel_dto.dart';
import 'package:crm_api_client/src/model/visite_referentiel_list_dto.dart';
import 'package:crm_api_client/src/model/visite_referentiel_ref_dto.dart';
import 'package:crm_api_client/src/model/visite_referentiel_usage_dto.dart';
import 'package:crm_api_client/src/model/visite_referentiel_usage_entry_dto.dart';
import 'package:crm_api_client/src/model/visite_referentiels_bundle_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_agent_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_bucket_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_croisement_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_heure_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_heure_jour_semaine_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_jour_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_jour_semaine_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_mois_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_recurrent_dto.dart';
import 'package:crm_api_client/src/model/visite_stat_saisie_dto.dart';
import 'package:crm_api_client/src/model/visite_stats_dto.dart';
import 'package:crm_api_client/src/model/weekly_cohort_dto.dart';
import 'package:crm_api_client/src/model/weekly_cohort_list_dto.dart';
import 'package:crm_api_client/src/model/work_shift_dto.dart';
import 'package:crm_api_client/src/model/work_shifts_dto.dart';

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
    case 'AmbassadorConversionDto':
      return AmbassadorConversionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AnalyticsDelaysDto':
      return AnalyticsDelaysDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
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
    case 'AndroidReleaseDto':
      return AndroidReleaseDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AndroidReleaseListDto':
      return AndroidReleaseListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ApiErrorDto':
      return ApiErrorDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'AppUpdateDto':
      return AppUpdateDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ApproveClientRequestDto':
      return ApproveClientRequestDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AudiencePreviewDto':
      return AudiencePreviewDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AuthTokensDto':
      return AuthTokensDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'AuthUserDto':
      return AuthUserDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'BankAgeBucket':
    case 'BankAgentActivityDto':
      return BankAgentActivityDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankAgingBucketDto':
      return BankAgingBucketDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'BankAgingDto':
      return BankAgingDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'BankAgingStageDto':
      return BankAgingStageDto.fromJson(value as Map<String, dynamic>)
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
    case 'BanqueDto':
      return BanqueDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'BddSegment':
    case 'CallOutcome':
    case 'CallOutcomeEffect':
    case 'CallOutcomeReasonDto':
      return CallOutcomeReasonDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CallOutcomeReasonListDto':
      return CallOutcomeReasonListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CallRecordingDto':
      return CallRecordingDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CallbackDto':
      return CallbackDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'CallbackListDto':
      return CallbackListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CallbackScope':
    case 'CanalProvenanceDto':
      return CanalProvenanceDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ChampLibreDto':
      return ChampLibreDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ChampLibreInputDto':
      return ChampLibreInputDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ChangeMyPasswordDto':
      return ChangeMyPasswordDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ChangeProspectSegmentDto':
      return ChangeProspectSegmentDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ChangeSource':
    case 'ClientRequestDto':
      return ClientRequestDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClientRequestListDto':
      return ClientRequestListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ClientRequestStatus':
    case 'ComptageOuverturesDto':
      return ComptageOuverturesDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ComptageOuverturesJourDto':
      return ComptageOuverturesJourDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ConfirmGrandPublicConversionDto':
      return ConfirmGrandPublicConversionDto.fromJson(
            value as Map<String, dynamic>,
          )
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
    case 'CreateCallOutcomeReasonDto':
      return CreateCallOutcomeReasonDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateCanalProvenanceDto':
      return CreateCanalProvenanceDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateClientRequestDto':
      return CreateClientRequestDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateDepartementDto':
      return CreateDepartementDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateEmployeurDto':
      return CreateEmployeurDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateIncomeBandDto':
      return CreateIncomeBandDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateLotExportDto':
      return CreateLotExportDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateNotificationDto':
      return CreateNotificationDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateNotificationTemplateDto':
      return CreateNotificationTemplateDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'CreateOfferDto':
      return CreateOfferDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateProfessionDto':
      return CreateProfessionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateProspectDto':
      return CreateProspectDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateRepCallAttemptDto':
      return CreateRepCallAttemptDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateRepresentantCommentDto':
      return CreateRepresentantCommentDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'CreateRepresentantDto':
      return CreateRepresentantDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateStatutQualificationDto':
      return CreateStatutQualificationDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'CreateSyndicatDto':
      return CreateSyndicatDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateUserDto':
      return CreateUserDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateVisiteDto':
      return CreateVisiteDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'CreateVisiteReferentielDto':
      return CreateVisiteReferentielDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DashboardEcran':
    case 'DashboardMarque':
    case 'DashboardPreset':
    case 'DashboardSource':
    case 'DashboardTaille':
    case 'DataQualityDto':
      return DataQualityDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DataQualityRowDto':
      return DataQualityRowDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DatabaseDumpJobDto':
      return DatabaseDumpJobDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DelaiMedianDto':
      return DelaiMedianDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DelayLeg':
    case 'DelayLegDto':
      return DelayLegDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'DemoWorkspaceCountsDto':
      return DemoWorkspaceCountsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DemoWorkspaceStatusDto':
      return DemoWorkspaceStatusDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DepartementDto':
      return DepartementDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DepartementYieldDto':
      return DepartementYieldDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DepartementYieldListDto':
      return DepartementYieldListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DernierTirageDto':
      return DernierTirageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DeviceCallDetectionDto':
      return DeviceCallDetectionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DeviceCallDetectionListDto':
      return DeviceCallDetectionListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DirectoryEntryDto':
      return DirectoryEntryDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DirectoryPageDto':
      return DirectoryPageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DispositionPresentationDto':
      return DispositionPresentationDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DispositionResponseDto':
      return DispositionResponseDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'DispositionWidgetDto':
      return DispositionWidgetDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'EmployeurDto':
      return EmployeurDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'EmployeurType':
    case 'EnregistrerBrouillonDto':
      return EnregistrerBrouillonDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'EnrolementIndicateursDto':
      return EnrolementIndicateursDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'EnrolementReglagesDto':
      return EnrolementReglagesDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'EnrollmentMethod':
    case 'EnrollmentMethodCountDto':
      return EnrollmentMethodCountDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'EnrollmentMethodListDto':
      return EnrollmentMethodListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ExportMode':
    case 'FamilleStatut':
    case 'FunnelStageDto':
      return FunnelStageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'GrandPublicConsent':
    case 'IefDto':
      return IefDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ImportJobDto':
      return ImportJobDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ImportJobErrorDto':
      return ImportJobErrorDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ImportJobListDto':
      return ImportJobListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ImportJobReportDto':
      return ImportJobReportDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ImportKind':
    case 'ImportMode':
    case 'ImportReportDto':
      return ImportReportDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ImportRowErrorDto':
      return ImportRowErrorDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ImportRowPreviewDto':
      return ImportRowPreviewDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ImportStatus':
    case 'InboxDto':
      return InboxDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'InboxItemDto':
      return InboxItemDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'IncomeBandDto':
      return IncomeBandDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'InscriptionPlateformeDetailDto':
      return InscriptionPlateformeDetailDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'InscriptionPlateformeDto':
      return InscriptionPlateformeDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'InscriptionsPageDto':
      return InscriptionsPageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LoginDto':
      return LoginDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'LogoutResponseDto':
      return LogoutResponseDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportAttemptDto':
      return LotExportAttemptDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportCible':
    case 'LotExportDetailDto':
      return LotExportDetailDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportDistributionDto':
      return LotExportDistributionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportDistributionInputDto':
      return LotExportDistributionInputDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'LotExportFicheDto':
      return LotExportFicheDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportFicheEtat':
    case 'LotExportFichesDto':
      return LotExportFichesDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportListDto':
      return LotExportListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportObjectifDto':
      return LotExportObjectifDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportPerformanceDto':
      return LotExportPerformanceDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportPreviewDto':
      return LotExportPreviewDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportProspectFilterDto':
      return LotExportProspectFilterDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportReaffectationDto':
      return LotExportReaffectationDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportRepartitionDto':
      return LotExportRepartitionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportRepartitionJourDto':
      return LotExportRepartitionJourDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'LotExportSummaryDto':
      return LotExportSummaryDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MergeProspectsDto':
      return MergeProspectsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MesAttributionsDto':
      return MesAttributionsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ModeEpargne':
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
    case 'OfferDto':
      return OfferDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'OkDto':
      return OkDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'OriginBreakdownDto':
      return OriginBreakdownDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OriginCountDto':
      return OriginCountDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OriginLabelCountDto':
      return OriginLabelCountDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OuvertureFicheDto':
      return OuvertureFicheDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OuvertureFicheListDto':
      return OuvertureFicheListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OuvrirFicheDto':
      return OuvrirFicheDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'PageMetaDto':
      return PageMetaDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'PaymentMode':
    case 'PaysDto':
      return PaysDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'PerformanceScore':
      return PerformanceScore.fromJson(value as Map<String, dynamic>)
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
    case 'PrioriteTraitement':
    case 'ProfessionDto':
      return ProfessionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Projet':
    case 'ProspectCallAttemptDto':
      return ProspectCallAttemptDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProspectCallAttemptListDto':
      return ProspectCallAttemptListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProspectConflictDto':
      return ProspectConflictDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProspectConflictExistingDto':
      return ProspectConflictExistingDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ProspectDto':
      return ProspectDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ProspectJourneyDto':
      return ProspectJourneyDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
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
    case 'ProspectType':
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
    case 'RappelOrigine':
    case 'ReaffecterLotExportDto':
      return ReaffecterLotExportDto.fromJson(value as Map<String, dynamic>)
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
    case 'ReglageChampDto':
      return ReglageChampDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ReglageChampInputDto':
      return ReglageChampInputDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ReglagesConversionDto':
      return ReglagesConversionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RejectClientRequestDto':
      return RejectClientRequestDto.fromJson(value as Map<String, dynamic>)
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
    case 'ReorderVisiteReferentielDto':
      return ReorderVisiteReferentielDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepCallAttemptApplyStatus':
    case 'RepCallAttemptResultDto':
      return RepCallAttemptResultDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepCallOutcome':
    case 'RepartitionDto':
      return RepartitionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantCallAttemptDto':
      return RepresentantCallAttemptDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantCallAttemptListDto':
      return RepresentantCallAttemptListDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'RepresentantCommentDto':
      return RepresentantCommentDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantCommentListDto':
      return RepresentantCommentListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantDto':
      return RepresentantDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantExportQueryDto':
      return RepresentantExportQueryDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantListDto':
      return RepresentantListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantLookupDto':
      return RepresentantLookupDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantProductivityDto':
      return RepresentantProductivityDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RepresentantProductivityListDto':
      return RepresentantProductivityListDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'RepresentantRelation':
    case 'RepresentantRelationChangeDto':
      return RepresentantRelationChangeDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'RepresentantRelationChangeListDto':
      return RepresentantRelationChangeListDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'RepresentantSortField':
    case 'RepresentantSuivi':
    case 'ResetPasswordDto':
      return ResetPasswordDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'RetirerTeleconseillerDto':
      return RetirerTeleconseillerDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Role':
    case 'ScorePart':
      return ScorePart.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'SegmentChangeDto':
      return SegmentChangeDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SegmentChangeListDto':
      return SegmentChangeListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SegmentConversionAuthorDto':
      return SegmentConversionAuthorDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SegmentConversionDto':
      return SegmentConversionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SegmentConversionListDto':
      return SegmentConversionListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SegmentConversionOriginDto':
      return SegmentConversionOriginDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SegmentCountDto':
      return SegmentCountDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SegmentListDto':
      return SegmentListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SerieJourDto':
      return SerieJourDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'SetActiveDto':
      return SetActiveDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'SetBankCaseStageActiveDto':
      return SetBankCaseStageActiveDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SetCallOutcomeReasonActiveDto':
      return SetCallOutcomeReasonActiveDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'SetStatutQualificationActiveDto':
      return SetStatutQualificationActiveDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'SetVisiteImportChangeSelectionDto':
      return SetVisiteImportChangeSelectionDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'SetVisiteReferentielActiveDto':
      return SetVisiteReferentielActiveDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'SortOrder':
    case 'StatutQualificationDto':
      return StatutQualificationDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'StatutQualificationEffect':
    case 'StatutQualificationListDto':
      return StatutQualificationListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'StockRepresentantsDto':
      return StockRepresentantsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'StockRepresentantsPartDto':
      return StockRepresentantsPartDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SuggestionDto':
      return SuggestionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SuggestionListDto':
      return SuggestionListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SuggestionStatus':
    case 'SupervisedUserDto':
      return SupervisedUserDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SupervisionActivityCountsDto':
      return SupervisionActivityCountsDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'SupervisionActivityDto':
      return SupervisionActivityDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SupervisionActivityRowDto':
      return SupervisionActivityRowDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SupervisionCampagneDto':
      return SupervisionCampagneDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SupervisionCampagneTeleconseillerDto':
      return SupervisionCampagneTeleconseillerDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'SupervisionCampagnesDto':
      return SupervisionCampagnesDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SupervisionCampagnesTotauxDto':
      return SupervisionCampagnesTotauxDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'SupervisionDto':
      return SupervisionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SupervisionGranularity':
    case 'SupervisionHistogramBarDto':
      return SupervisionHistogramBarDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SupervisionRepStatutDto':
      return SupervisionRepStatutDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SupervisionRepStatutsDto':
      return SupervisionRepStatutsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SupervisionScoreDto':
      return SupervisionScoreDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SupervisionTeleconseillerDto':
      return SupervisionTeleconseillerDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'SuppressionDto':
      return SuppressionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SwitchWorkspaceDto':
      return SwitchWorkspaceDto.fromJson(value as Map<String, dynamic>)
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
    case 'SyncVisiteDto':
      return SyncVisiteDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SyncVisiteReferentielDto':
      return SyncVisiteReferentielDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SyndicatDto':
      return SyndicatDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'TimeBucketDto':
      return TimeBucketDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'TimeGranularity':
    case 'TirageDto':
      return TirageDto.fromJson(value as Map<String, dynamic>) as ReturnType;
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
    case 'TypeContrat':
    case 'UpdateBankCaseDto':
      return UpdateBankCaseDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateBankCaseStageDto':
      return UpdateBankCaseStageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateBanqueDto':
      return UpdateBanqueDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateCallOutcomeReasonDto':
      return UpdateCallOutcomeReasonDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateCanalProvenanceDto':
      return UpdateCanalProvenanceDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateDepartementDto':
      return UpdateDepartementDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateDispositionDto':
      return UpdateDispositionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateEmployeurDto':
      return UpdateEmployeurDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateEnrolementReglagesDto':
      return UpdateEnrolementReglagesDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateGrandPublicConsentDto':
      return UpdateGrandPublicConsentDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateIncomeBandDto':
      return UpdateIncomeBandDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateLotExportDto':
      return UpdateLotExportDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateNotificationTemplateDto':
      return UpdateNotificationTemplateDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'UpdateOfferDto':
      return UpdateOfferDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateProfessionDto':
      return UpdateProfessionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateProspectDto':
      return UpdateProspectDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateReglagesConversionDto':
      return UpdateReglagesConversionDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateRepresentantDto':
      return UpdateRepresentantDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateStatutQualificationDto':
      return UpdateStatutQualificationDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'UpdateSuggestionStatusDto':
      return UpdateSuggestionStatusDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateSyndicatDto':
      return UpdateSyndicatDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateUserDto':
      return UpdateUserDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateVisiteDto':
      return UpdateVisiteDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateVisiteReferentielDto':
      return UpdateVisiteReferentielDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UpdateWorkShiftsDto':
      return UpdateWorkShiftsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'UserDto':
      return UserDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'UserListDto':
      return UserListDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'VisiteDto':
      return VisiteDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'VisiteImportChangeDto':
      return VisiteImportChangeDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteImportChangeFieldDto':
      return VisiteImportChangeFieldDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteImportChangeKind':
    case 'VisiteImportChangeListDto':
      return VisiteImportChangeListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteListDto':
      return VisiteListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteReferentielDto':
      return VisiteReferentielDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteReferentielKind':
    case 'VisiteReferentielListDto':
      return VisiteReferentielListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteReferentielRefDto':
      return VisiteReferentielRefDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteReferentielUsageDto':
      return VisiteReferentielUsageDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteReferentielUsageEntryDto':
      return VisiteReferentielUsageEntryDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'VisiteReferentielsBundleDto':
      return VisiteReferentielsBundleDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteSortField':
    case 'VisiteStatAgentDto':
      return VisiteStatAgentDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteStatBucketDto':
      return VisiteStatBucketDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteStatCroisementDto':
      return VisiteStatCroisementDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteStatHeureDto':
      return VisiteStatHeureDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteStatHeureJourSemaineDto':
      return VisiteStatHeureJourSemaineDto.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'VisiteStatJourDto':
      return VisiteStatJourDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteStatJourSemaineDto':
      return VisiteStatJourSemaineDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteStatMoisDto':
      return VisiteStatMoisDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteStatRecurrentDto':
      return VisiteStatRecurrentDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteStatSaisieDto':
      return VisiteStatSaisieDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'VisiteStatsDto':
      return VisiteStatsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'WeeklyCohortDto':
      return WeeklyCohortDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'WeeklyCohortListDto':
      return WeeklyCohortListDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'WhatsappStatus':
    case 'WorkShiftDto':
      return WorkShiftDto.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'WorkShiftsDto':
      return WorkShiftsDto.fromJson(value as Map<String, dynamic>)
          as ReturnType;
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
