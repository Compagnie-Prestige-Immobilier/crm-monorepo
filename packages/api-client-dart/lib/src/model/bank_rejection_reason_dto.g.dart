// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_rejection_reason_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankRejectionReasonDtoCWProxy {
  BankRejectionReasonDto id(String id);

  BankRejectionReasonDto code(String code);

  BankRejectionReasonDto label(String label);

  BankRejectionReasonDto sortOrder(num sortOrder);

  BankRejectionReasonDto isActive(bool isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankRejectionReasonDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankRejectionReasonDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankRejectionReasonDto call({
    String id,
    String code,
    String label,
    num sortOrder,
    bool isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankRejectionReasonDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankRejectionReasonDto.copyWith.fieldName(...)`
class _$BankRejectionReasonDtoCWProxyImpl
    implements _$BankRejectionReasonDtoCWProxy {
  const _$BankRejectionReasonDtoCWProxyImpl(this._value);

  final BankRejectionReasonDto _value;

  @override
  BankRejectionReasonDto id(String id) => this(id: id);

  @override
  BankRejectionReasonDto code(String code) => this(code: code);

  @override
  BankRejectionReasonDto label(String label) => this(label: label);

  @override
  BankRejectionReasonDto sortOrder(num sortOrder) => this(sortOrder: sortOrder);

  @override
  BankRejectionReasonDto isActive(bool isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankRejectionReasonDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankRejectionReasonDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankRejectionReasonDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return BankRejectionReasonDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
    );
  }
}

extension $BankRejectionReasonDtoCopyWith on BankRejectionReasonDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankRejectionReasonDto.copyWith(...)` or like so:`instanceOfBankRejectionReasonDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankRejectionReasonDtoCWProxy get copyWith =>
      _$BankRejectionReasonDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankRejectionReasonDto _$BankRejectionReasonDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('BankRejectionReasonDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['id', 'code', 'label', 'sortOrder', 'isActive'],
  );
  final val = BankRejectionReasonDto(
    id: $checkedConvert('id', (v) => v as String),
    code: $checkedConvert('code', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    sortOrder: $checkedConvert('sortOrder', (v) => v as num),
    isActive: $checkedConvert('isActive', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$BankRejectionReasonDtoToJson(
  BankRejectionReasonDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'label': instance.label,
  'sortOrder': instance.sortOrder,
  'isActive': instance.isActive,
};
