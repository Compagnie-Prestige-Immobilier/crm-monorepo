// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rep_campaign_preview_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepCampaignPreviewDtoCWProxy {
  RepCampaignPreviewDto eligible(num eligible);

  RepCampaignPreviewDto perCommercial(num perCommercial);

  RepCampaignPreviewDto perDay(List<num> perDay);

  RepCampaignPreviewDto scopeLabel(String scopeLabel);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignPreviewDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignPreviewDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignPreviewDto call({
    num eligible,
    num perCommercial,
    List<num> perDay,
    String scopeLabel,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepCampaignPreviewDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepCampaignPreviewDto.copyWith.fieldName(...)`
class _$RepCampaignPreviewDtoCWProxyImpl
    implements _$RepCampaignPreviewDtoCWProxy {
  const _$RepCampaignPreviewDtoCWProxyImpl(this._value);

  final RepCampaignPreviewDto _value;

  @override
  RepCampaignPreviewDto eligible(num eligible) => this(eligible: eligible);

  @override
  RepCampaignPreviewDto perCommercial(num perCommercial) =>
      this(perCommercial: perCommercial);

  @override
  RepCampaignPreviewDto perDay(List<num> perDay) => this(perDay: perDay);

  @override
  RepCampaignPreviewDto scopeLabel(String scopeLabel) =>
      this(scopeLabel: scopeLabel);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignPreviewDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignPreviewDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignPreviewDto call({
    Object? eligible = const $CopyWithPlaceholder(),
    Object? perCommercial = const $CopyWithPlaceholder(),
    Object? perDay = const $CopyWithPlaceholder(),
    Object? scopeLabel = const $CopyWithPlaceholder(),
  }) {
    return RepCampaignPreviewDto(
      eligible: eligible == const $CopyWithPlaceholder()
          ? _value.eligible
          // ignore: cast_nullable_to_non_nullable
          : eligible as num,
      perCommercial: perCommercial == const $CopyWithPlaceholder()
          ? _value.perCommercial
          // ignore: cast_nullable_to_non_nullable
          : perCommercial as num,
      perDay: perDay == const $CopyWithPlaceholder()
          ? _value.perDay
          // ignore: cast_nullable_to_non_nullable
          : perDay as List<num>,
      scopeLabel: scopeLabel == const $CopyWithPlaceholder()
          ? _value.scopeLabel
          // ignore: cast_nullable_to_non_nullable
          : scopeLabel as String,
    );
  }
}

extension $RepCampaignPreviewDtoCopyWith on RepCampaignPreviewDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepCampaignPreviewDto.copyWith(...)` or like so:`instanceOfRepCampaignPreviewDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepCampaignPreviewDtoCWProxy get copyWith =>
      _$RepCampaignPreviewDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepCampaignPreviewDto _$RepCampaignPreviewDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepCampaignPreviewDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['eligible', 'perCommercial', 'perDay', 'scopeLabel'],
  );
  final val = RepCampaignPreviewDto(
    eligible: $checkedConvert('eligible', (v) => v as num),
    perCommercial: $checkedConvert('perCommercial', (v) => v as num),
    perDay: $checkedConvert(
      'perDay',
      (v) => (v as List<dynamic>).map((e) => e as num).toList(),
    ),
    scopeLabel: $checkedConvert('scopeLabel', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$RepCampaignPreviewDtoToJson(
  RepCampaignPreviewDto instance,
) => <String, dynamic>{
  'eligible': instance.eligible,
  'perCommercial': instance.perCommercial,
  'perDay': instance.perDay,
  'scopeLabel': instance.scopeLabel,
};
