// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_stage_count_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankStageCountDtoCWProxy {
  BankStageCountDto stageId(String stageId);

  BankStageCountDto code(String code);

  BankStageCountDto label(String label);

  BankStageCountDto color(String color);

  BankStageCountDto type(BankStageType type);

  BankStageCountDto cases(num cases);

  BankStageCountDto share(num share);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankStageCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankStageCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankStageCountDto call({
    String stageId,
    String code,
    String label,
    String color,
    BankStageType type,
    num cases,
    num share,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankStageCountDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankStageCountDto.copyWith.fieldName(...)`
class _$BankStageCountDtoCWProxyImpl implements _$BankStageCountDtoCWProxy {
  const _$BankStageCountDtoCWProxyImpl(this._value);

  final BankStageCountDto _value;

  @override
  BankStageCountDto stageId(String stageId) => this(stageId: stageId);

  @override
  BankStageCountDto code(String code) => this(code: code);

  @override
  BankStageCountDto label(String label) => this(label: label);

  @override
  BankStageCountDto color(String color) => this(color: color);

  @override
  BankStageCountDto type(BankStageType type) => this(type: type);

  @override
  BankStageCountDto cases(num cases) => this(cases: cases);

  @override
  BankStageCountDto share(num share) => this(share: share);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankStageCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankStageCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankStageCountDto call({
    Object? stageId = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? color = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
    Object? cases = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
  }) {
    return BankStageCountDto(
      stageId: stageId == const $CopyWithPlaceholder()
          ? _value.stageId
          // ignore: cast_nullable_to_non_nullable
          : stageId as String,
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      color: color == const $CopyWithPlaceholder()
          ? _value.color
          // ignore: cast_nullable_to_non_nullable
          : color as String,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as BankStageType,
      cases: cases == const $CopyWithPlaceholder()
          ? _value.cases
          // ignore: cast_nullable_to_non_nullable
          : cases as num,
      share: share == const $CopyWithPlaceholder()
          ? _value.share
          // ignore: cast_nullable_to_non_nullable
          : share as num,
    );
  }
}

extension $BankStageCountDtoCopyWith on BankStageCountDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankStageCountDto.copyWith(...)` or like so:`instanceOfBankStageCountDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankStageCountDtoCWProxy get copyWith =>
      _$BankStageCountDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankStageCountDto _$BankStageCountDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('BankStageCountDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'stageId',
          'code',
          'label',
          'color',
          'type',
          'cases',
          'share',
        ],
      );
      final val = BankStageCountDto(
        stageId: $checkedConvert('stageId', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        color: $checkedConvert('color', (v) => v as String),
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(
            _$BankStageTypeEnumMap,
            v,
            unknownValue: BankStageType.unknownDefaultOpenApi,
          ),
        ),
        cases: $checkedConvert('cases', (v) => v as num),
        share: $checkedConvert('share', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$BankStageCountDtoToJson(BankStageCountDto instance) =>
    <String, dynamic>{
      'stageId': instance.stageId,
      'code': instance.code,
      'label': instance.label,
      'color': instance.color,
      'type': _$BankStageTypeEnumMap[instance.type]!,
      'cases': instance.cases,
      'share': instance.share,
    };

const _$BankStageTypeEnumMap = {
  BankStageType.OPEN: 'OPEN',
  BankStageType.CASHED: 'CASHED',
  BankStageType.REJECTED: 'REJECTED',
  BankStageType.unknownDefaultOpenApi: 'unknown_default_open_api',
};
