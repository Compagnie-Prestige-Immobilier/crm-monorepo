// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_case_stage_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankCaseStageListDtoCWProxy {
  BankCaseStageListDto items(List<BankCaseStageDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseStageListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseStageListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseStageListDto call({List<BankCaseStageDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankCaseStageListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankCaseStageListDto.copyWith.fieldName(...)`
class _$BankCaseStageListDtoCWProxyImpl
    implements _$BankCaseStageListDtoCWProxy {
  const _$BankCaseStageListDtoCWProxyImpl(this._value);

  final BankCaseStageListDto _value;

  @override
  BankCaseStageListDto items(List<BankCaseStageDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseStageListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseStageListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseStageListDto call({Object? items = const $CopyWithPlaceholder()}) {
    return BankCaseStageListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<BankCaseStageDto>,
    );
  }
}

extension $BankCaseStageListDtoCopyWith on BankCaseStageListDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankCaseStageListDto.copyWith(...)` or like so:`instanceOfBankCaseStageListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankCaseStageListDtoCWProxy get copyWith =>
      _$BankCaseStageListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankCaseStageListDto _$BankCaseStageListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('BankCaseStageListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = BankCaseStageListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => BankCaseStageDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$BankCaseStageListDtoToJson(
  BankCaseStageListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
