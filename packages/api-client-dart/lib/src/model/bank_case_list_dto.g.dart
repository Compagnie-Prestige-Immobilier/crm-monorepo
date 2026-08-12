// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_case_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankCaseListDtoCWProxy {
  BankCaseListDto items(List<BankCaseDto> items);

  BankCaseListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseListDto call({List<BankCaseDto> items, PageMetaDto meta});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankCaseListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankCaseListDto.copyWith.fieldName(...)`
class _$BankCaseListDtoCWProxyImpl implements _$BankCaseListDtoCWProxy {
  const _$BankCaseListDtoCWProxyImpl(this._value);

  final BankCaseListDto _value;

  @override
  BankCaseListDto items(List<BankCaseDto> items) => this(items: items);

  @override
  BankCaseListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return BankCaseListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<BankCaseDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $BankCaseListDtoCopyWith on BankCaseListDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankCaseListDto.copyWith(...)` or like so:`instanceOfBankCaseListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankCaseListDtoCWProxy get copyWith => _$BankCaseListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankCaseListDto _$BankCaseListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('BankCaseListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = BankCaseListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => BankCaseDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$BankCaseListDtoToJson(BankCaseListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'meta': instance.meta.toJson(),
    };
