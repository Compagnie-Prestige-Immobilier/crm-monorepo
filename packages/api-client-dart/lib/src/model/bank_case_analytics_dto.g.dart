// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_case_analytics_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankCaseAnalyticsDtoCWProxy {
  BankCaseAnalyticsDto totals(BankAnalyticsTotalsDto totals);

  BankCaseAnalyticsDto byStage(List<BankStageCountDto> byStage);

  BankCaseAnalyticsDto createdOverTime(List<BankTimeBucketDto> createdOverTime);

  BankCaseAnalyticsDto cashingsOverTime(
    List<BankTimeBucketDto> cashingsOverTime,
  );

  BankCaseAnalyticsDto byBank(List<BankBankBreakdownDto> byBank);

  BankCaseAnalyticsDto byRejectionReason(
    List<BankRejectionBreakdownDto> byRejectionReason,
  );

  BankCaseAnalyticsDto byAgent(List<BankAgentActivityDto> byAgent);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseAnalyticsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseAnalyticsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseAnalyticsDto call({
    BankAnalyticsTotalsDto totals,
    List<BankStageCountDto> byStage,
    List<BankTimeBucketDto> createdOverTime,
    List<BankTimeBucketDto> cashingsOverTime,
    List<BankBankBreakdownDto> byBank,
    List<BankRejectionBreakdownDto> byRejectionReason,
    List<BankAgentActivityDto> byAgent,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankCaseAnalyticsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankCaseAnalyticsDto.copyWith.fieldName(...)`
class _$BankCaseAnalyticsDtoCWProxyImpl
    implements _$BankCaseAnalyticsDtoCWProxy {
  const _$BankCaseAnalyticsDtoCWProxyImpl(this._value);

  final BankCaseAnalyticsDto _value;

  @override
  BankCaseAnalyticsDto totals(BankAnalyticsTotalsDto totals) =>
      this(totals: totals);

  @override
  BankCaseAnalyticsDto byStage(List<BankStageCountDto> byStage) =>
      this(byStage: byStage);

  @override
  BankCaseAnalyticsDto createdOverTime(
    List<BankTimeBucketDto> createdOverTime,
  ) => this(createdOverTime: createdOverTime);

  @override
  BankCaseAnalyticsDto cashingsOverTime(
    List<BankTimeBucketDto> cashingsOverTime,
  ) => this(cashingsOverTime: cashingsOverTime);

  @override
  BankCaseAnalyticsDto byBank(List<BankBankBreakdownDto> byBank) =>
      this(byBank: byBank);

  @override
  BankCaseAnalyticsDto byRejectionReason(
    List<BankRejectionBreakdownDto> byRejectionReason,
  ) => this(byRejectionReason: byRejectionReason);

  @override
  BankCaseAnalyticsDto byAgent(List<BankAgentActivityDto> byAgent) =>
      this(byAgent: byAgent);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseAnalyticsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseAnalyticsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseAnalyticsDto call({
    Object? totals = const $CopyWithPlaceholder(),
    Object? byStage = const $CopyWithPlaceholder(),
    Object? createdOverTime = const $CopyWithPlaceholder(),
    Object? cashingsOverTime = const $CopyWithPlaceholder(),
    Object? byBank = const $CopyWithPlaceholder(),
    Object? byRejectionReason = const $CopyWithPlaceholder(),
    Object? byAgent = const $CopyWithPlaceholder(),
  }) {
    return BankCaseAnalyticsDto(
      totals: totals == const $CopyWithPlaceholder()
          ? _value.totals
          // ignore: cast_nullable_to_non_nullable
          : totals as BankAnalyticsTotalsDto,
      byStage: byStage == const $CopyWithPlaceholder()
          ? _value.byStage
          // ignore: cast_nullable_to_non_nullable
          : byStage as List<BankStageCountDto>,
      createdOverTime: createdOverTime == const $CopyWithPlaceholder()
          ? _value.createdOverTime
          // ignore: cast_nullable_to_non_nullable
          : createdOverTime as List<BankTimeBucketDto>,
      cashingsOverTime: cashingsOverTime == const $CopyWithPlaceholder()
          ? _value.cashingsOverTime
          // ignore: cast_nullable_to_non_nullable
          : cashingsOverTime as List<BankTimeBucketDto>,
      byBank: byBank == const $CopyWithPlaceholder()
          ? _value.byBank
          // ignore: cast_nullable_to_non_nullable
          : byBank as List<BankBankBreakdownDto>,
      byRejectionReason: byRejectionReason == const $CopyWithPlaceholder()
          ? _value.byRejectionReason
          // ignore: cast_nullable_to_non_nullable
          : byRejectionReason as List<BankRejectionBreakdownDto>,
      byAgent: byAgent == const $CopyWithPlaceholder()
          ? _value.byAgent
          // ignore: cast_nullable_to_non_nullable
          : byAgent as List<BankAgentActivityDto>,
    );
  }
}

extension $BankCaseAnalyticsDtoCopyWith on BankCaseAnalyticsDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankCaseAnalyticsDto.copyWith(...)` or like so:`instanceOfBankCaseAnalyticsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankCaseAnalyticsDtoCWProxy get copyWith =>
      _$BankCaseAnalyticsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankCaseAnalyticsDto _$BankCaseAnalyticsDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('BankCaseAnalyticsDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'totals',
      'byStage',
      'createdOverTime',
      'cashingsOverTime',
      'byBank',
      'byRejectionReason',
      'byAgent',
    ],
  );
  final val = BankCaseAnalyticsDto(
    totals: $checkedConvert(
      'totals',
      (v) => BankAnalyticsTotalsDto.fromJson(v as Map<String, dynamic>),
    ),
    byStage: $checkedConvert(
      'byStage',
      (v) => (v as List<dynamic>)
          .map((e) => BankStageCountDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    createdOverTime: $checkedConvert(
      'createdOverTime',
      (v) => (v as List<dynamic>)
          .map((e) => BankTimeBucketDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    cashingsOverTime: $checkedConvert(
      'cashingsOverTime',
      (v) => (v as List<dynamic>)
          .map((e) => BankTimeBucketDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    byBank: $checkedConvert(
      'byBank',
      (v) => (v as List<dynamic>)
          .map((e) => BankBankBreakdownDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    byRejectionReason: $checkedConvert(
      'byRejectionReason',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                BankRejectionBreakdownDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    byAgent: $checkedConvert(
      'byAgent',
      (v) => (v as List<dynamic>)
          .map((e) => BankAgentActivityDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$BankCaseAnalyticsDtoToJson(
  BankCaseAnalyticsDto instance,
) => <String, dynamic>{
  'totals': instance.totals.toJson(),
  'byStage': instance.byStage.map((e) => e.toJson()).toList(),
  'createdOverTime': instance.createdOverTime.map((e) => e.toJson()).toList(),
  'cashingsOverTime': instance.cashingsOverTime.map((e) => e.toJson()).toList(),
  'byBank': instance.byBank.map((e) => e.toJson()).toList(),
  'byRejectionReason': instance.byRejectionReason
      .map((e) => e.toJson())
      .toList(),
  'byAgent': instance.byAgent.map((e) => e.toJson()).toList(),
};
