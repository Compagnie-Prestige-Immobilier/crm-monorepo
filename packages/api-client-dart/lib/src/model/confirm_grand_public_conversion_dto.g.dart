// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'confirm_grand_public_conversion_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ConfirmGrandPublicConversionDtoCWProxy {
  ConfirmGrandPublicConversionDto offerId(String offerId);

  ConfirmGrandPublicConversionDto paymentMode(PaymentMode? paymentMode);

  ConfirmGrandPublicConversionDto amountXof(num? amountXof);

  ConfirmGrandPublicConversionDto durationMonths(num? durationMonths);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ConfirmGrandPublicConversionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ConfirmGrandPublicConversionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ConfirmGrandPublicConversionDto call({
    String offerId,
    PaymentMode? paymentMode,
    num? amountXof,
    num? durationMonths,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfConfirmGrandPublicConversionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfConfirmGrandPublicConversionDto.copyWith.fieldName(...)`
class _$ConfirmGrandPublicConversionDtoCWProxyImpl
    implements _$ConfirmGrandPublicConversionDtoCWProxy {
  const _$ConfirmGrandPublicConversionDtoCWProxyImpl(this._value);

  final ConfirmGrandPublicConversionDto _value;

  @override
  ConfirmGrandPublicConversionDto offerId(String offerId) =>
      this(offerId: offerId);

  @override
  ConfirmGrandPublicConversionDto paymentMode(PaymentMode? paymentMode) =>
      this(paymentMode: paymentMode);

  @override
  ConfirmGrandPublicConversionDto amountXof(num? amountXof) =>
      this(amountXof: amountXof);

  @override
  ConfirmGrandPublicConversionDto durationMonths(num? durationMonths) =>
      this(durationMonths: durationMonths);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ConfirmGrandPublicConversionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ConfirmGrandPublicConversionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ConfirmGrandPublicConversionDto call({
    Object? offerId = const $CopyWithPlaceholder(),
    Object? paymentMode = const $CopyWithPlaceholder(),
    Object? amountXof = const $CopyWithPlaceholder(),
    Object? durationMonths = const $CopyWithPlaceholder(),
  }) {
    return ConfirmGrandPublicConversionDto(
      offerId: offerId == const $CopyWithPlaceholder()
          ? _value.offerId
          // ignore: cast_nullable_to_non_nullable
          : offerId as String,
      paymentMode: paymentMode == const $CopyWithPlaceholder()
          ? _value.paymentMode
          // ignore: cast_nullable_to_non_nullable
          : paymentMode as PaymentMode?,
      amountXof: amountXof == const $CopyWithPlaceholder()
          ? _value.amountXof
          // ignore: cast_nullable_to_non_nullable
          : amountXof as num?,
      durationMonths: durationMonths == const $CopyWithPlaceholder()
          ? _value.durationMonths
          // ignore: cast_nullable_to_non_nullable
          : durationMonths as num?,
    );
  }
}

extension $ConfirmGrandPublicConversionDtoCopyWith
    on ConfirmGrandPublicConversionDto {
  /// Returns a callable class that can be used as follows: `instanceOfConfirmGrandPublicConversionDto.copyWith(...)` or like so:`instanceOfConfirmGrandPublicConversionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ConfirmGrandPublicConversionDtoCWProxy get copyWith =>
      _$ConfirmGrandPublicConversionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ConfirmGrandPublicConversionDto _$ConfirmGrandPublicConversionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ConfirmGrandPublicConversionDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['offerId']);
  final val = ConfirmGrandPublicConversionDto(
    offerId: $checkedConvert('offerId', (v) => v as String),
    paymentMode: $checkedConvert(
      'paymentMode',
      (v) => $enumDecodeNullable(
        _$PaymentModeEnumMap,
        v,
        unknownValue: PaymentMode.unknownDefaultOpenApi,
      ),
    ),
    amountXof: $checkedConvert('amountXof', (v) => v as num?),
    durationMonths: $checkedConvert('durationMonths', (v) => v as num?),
  );
  return val;
});

Map<String, dynamic> _$ConfirmGrandPublicConversionDtoToJson(
  ConfirmGrandPublicConversionDto instance,
) => <String, dynamic>{
  'offerId': instance.offerId,
  if (_$PaymentModeEnumMap[instance.paymentMode] case final value?)
    'paymentMode': value,
  if (instance.amountXof case final value?) 'amountXof': value,
  if (instance.durationMonths case final value?) 'durationMonths': value,
};

const _$PaymentModeEnumMap = {
  PaymentMode.COMPTANT: 'COMPTANT',
  PaymentMode.ECHELONNE: 'ECHELONNE',
  PaymentMode.unknownDefaultOpenApi: 'unknown_default_open_api',
};
