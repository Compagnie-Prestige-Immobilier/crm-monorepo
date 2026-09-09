// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_analytics_totals_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankAnalyticsTotalsDtoCWProxy {
  BankAnalyticsTotalsDto total(num total);

  BankAnalyticsTotalsDto aTraiter(num aTraiter);

  BankAnalyticsTotalsDto enTraitement(num enTraitement);

  BankAnalyticsTotalsDto encaisses(num encaisses);

  BankAnalyticsTotalsDto rejetes(num rejetes);

  BankAnalyticsTotalsDto totalAmountCashed(String totalAmountCashed);

  BankAnalyticsTotalsDto rejectionRate(num rejectionRate);

  BankAnalyticsTotalsDto meanDelayHours(num? meanDelayHours);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankAnalyticsTotalsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankAnalyticsTotalsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankAnalyticsTotalsDto call({
    num total,
    num aTraiter,
    num enTraitement,
    num encaisses,
    num rejetes,
    String totalAmountCashed,
    num rejectionRate,
    num? meanDelayHours,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankAnalyticsTotalsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankAnalyticsTotalsDto.copyWith.fieldName(...)`
class _$BankAnalyticsTotalsDtoCWProxyImpl
    implements _$BankAnalyticsTotalsDtoCWProxy {
  const _$BankAnalyticsTotalsDtoCWProxyImpl(this._value);

  final BankAnalyticsTotalsDto _value;

  @override
  BankAnalyticsTotalsDto total(num total) => this(total: total);

  @override
  BankAnalyticsTotalsDto aTraiter(num aTraiter) => this(aTraiter: aTraiter);

  @override
  BankAnalyticsTotalsDto enTraitement(num enTraitement) =>
      this(enTraitement: enTraitement);

  @override
  BankAnalyticsTotalsDto encaisses(num encaisses) => this(encaisses: encaisses);

  @override
  BankAnalyticsTotalsDto rejetes(num rejetes) => this(rejetes: rejetes);

  @override
  BankAnalyticsTotalsDto totalAmountCashed(String totalAmountCashed) =>
      this(totalAmountCashed: totalAmountCashed);

  @override
  BankAnalyticsTotalsDto rejectionRate(num rejectionRate) =>
      this(rejectionRate: rejectionRate);

  @override
  BankAnalyticsTotalsDto meanDelayHours(num? meanDelayHours) =>
      this(meanDelayHours: meanDelayHours);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankAnalyticsTotalsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankAnalyticsTotalsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankAnalyticsTotalsDto call({
    Object? total = const $CopyWithPlaceholder(),
    Object? aTraiter = const $CopyWithPlaceholder(),
    Object? enTraitement = const $CopyWithPlaceholder(),
    Object? encaisses = const $CopyWithPlaceholder(),
    Object? rejetes = const $CopyWithPlaceholder(),
    Object? totalAmountCashed = const $CopyWithPlaceholder(),
    Object? rejectionRate = const $CopyWithPlaceholder(),
    Object? meanDelayHours = const $CopyWithPlaceholder(),
  }) {
    return BankAnalyticsTotalsDto(
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
      aTraiter: aTraiter == const $CopyWithPlaceholder()
          ? _value.aTraiter
          // ignore: cast_nullable_to_non_nullable
          : aTraiter as num,
      enTraitement: enTraitement == const $CopyWithPlaceholder()
          ? _value.enTraitement
          // ignore: cast_nullable_to_non_nullable
          : enTraitement as num,
      encaisses: encaisses == const $CopyWithPlaceholder()
          ? _value.encaisses
          // ignore: cast_nullable_to_non_nullable
          : encaisses as num,
      rejetes: rejetes == const $CopyWithPlaceholder()
          ? _value.rejetes
          // ignore: cast_nullable_to_non_nullable
          : rejetes as num,
      totalAmountCashed: totalAmountCashed == const $CopyWithPlaceholder()
          ? _value.totalAmountCashed
          // ignore: cast_nullable_to_non_nullable
          : totalAmountCashed as String,
      rejectionRate: rejectionRate == const $CopyWithPlaceholder()
          ? _value.rejectionRate
          // ignore: cast_nullable_to_non_nullable
          : rejectionRate as num,
      meanDelayHours: meanDelayHours == const $CopyWithPlaceholder()
          ? _value.meanDelayHours
          // ignore: cast_nullable_to_non_nullable
          : meanDelayHours as num?,
    );
  }
}

extension $BankAnalyticsTotalsDtoCopyWith on BankAnalyticsTotalsDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankAnalyticsTotalsDto.copyWith(...)` or like so:`instanceOfBankAnalyticsTotalsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankAnalyticsTotalsDtoCWProxy get copyWith =>
      _$BankAnalyticsTotalsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankAnalyticsTotalsDto _$BankAnalyticsTotalsDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('BankAnalyticsTotalsDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'total',
      'aTraiter',
      'enTraitement',
      'encaisses',
      'rejetes',
      'totalAmountCashed',
      'rejectionRate',
      'meanDelayHours',
    ],
  );
  final val = BankAnalyticsTotalsDto(
    total: $checkedConvert('total', (v) => v as num),
    aTraiter: $checkedConvert('aTraiter', (v) => v as num),
    enTraitement: $checkedConvert('enTraitement', (v) => v as num),
    encaisses: $checkedConvert('encaisses', (v) => v as num),
    rejetes: $checkedConvert('rejetes', (v) => v as num),
    totalAmountCashed: $checkedConvert('totalAmountCashed', (v) => v as String),
    rejectionRate: $checkedConvert('rejectionRate', (v) => v as num),
    meanDelayHours: $checkedConvert('meanDelayHours', (v) => v as num?),
  );
  return val;
});

Map<String, dynamic> _$BankAnalyticsTotalsDtoToJson(
  BankAnalyticsTotalsDto instance,
) => <String, dynamic>{
  'total': instance.total,
  'aTraiter': instance.aTraiter,
  'enTraitement': instance.enTraitement,
  'encaisses': instance.encaisses,
  'rejetes': instance.rejetes,
  'totalAmountCashed': instance.totalAmountCashed,
  'rejectionRate': instance.rejectionRate,
  'meanDelayHours': instance.meanDelayHours,
};
