// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_rejection_reason_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankRejectionReasonListDtoCWProxy {
  BankRejectionReasonListDto items(List<BankRejectionReasonDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankRejectionReasonListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankRejectionReasonListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankRejectionReasonListDto call({List<BankRejectionReasonDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankRejectionReasonListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankRejectionReasonListDto.copyWith.fieldName(...)`
class _$BankRejectionReasonListDtoCWProxyImpl
    implements _$BankRejectionReasonListDtoCWProxy {
  const _$BankRejectionReasonListDtoCWProxyImpl(this._value);

  final BankRejectionReasonListDto _value;

  @override
  BankRejectionReasonListDto items(List<BankRejectionReasonDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankRejectionReasonListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankRejectionReasonListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankRejectionReasonListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return BankRejectionReasonListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<BankRejectionReasonDto>,
    );
  }
}

extension $BankRejectionReasonListDtoCopyWith on BankRejectionReasonListDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankRejectionReasonListDto.copyWith(...)` or like so:`instanceOfBankRejectionReasonListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankRejectionReasonListDtoCWProxy get copyWith =>
      _$BankRejectionReasonListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankRejectionReasonListDto _$BankRejectionReasonListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('BankRejectionReasonListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = BankRejectionReasonListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => BankRejectionReasonDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$BankRejectionReasonListDtoToJson(
  BankRejectionReasonListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
