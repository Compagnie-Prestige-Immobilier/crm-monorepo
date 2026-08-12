// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_case_detail_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankCaseDetailDtoCWProxy {
  BankCaseDetailDto bankCase(BankCaseDto bankCase);

  BankCaseDetailDto history(List<BankCaseTransitionDto> history);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseDetailDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseDetailDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseDetailDto call({
    BankCaseDto bankCase,
    List<BankCaseTransitionDto> history,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankCaseDetailDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankCaseDetailDto.copyWith.fieldName(...)`
class _$BankCaseDetailDtoCWProxyImpl implements _$BankCaseDetailDtoCWProxy {
  const _$BankCaseDetailDtoCWProxyImpl(this._value);

  final BankCaseDetailDto _value;

  @override
  BankCaseDetailDto bankCase(BankCaseDto bankCase) => this(bankCase: bankCase);

  @override
  BankCaseDetailDto history(List<BankCaseTransitionDto> history) =>
      this(history: history);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseDetailDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseDetailDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseDetailDto call({
    Object? bankCase = const $CopyWithPlaceholder(),
    Object? history = const $CopyWithPlaceholder(),
  }) {
    return BankCaseDetailDto(
      bankCase: bankCase == const $CopyWithPlaceholder()
          ? _value.bankCase
          // ignore: cast_nullable_to_non_nullable
          : bankCase as BankCaseDto,
      history: history == const $CopyWithPlaceholder()
          ? _value.history
          // ignore: cast_nullable_to_non_nullable
          : history as List<BankCaseTransitionDto>,
    );
  }
}

extension $BankCaseDetailDtoCopyWith on BankCaseDetailDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankCaseDetailDto.copyWith(...)` or like so:`instanceOfBankCaseDetailDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankCaseDetailDtoCWProxy get copyWith =>
      _$BankCaseDetailDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankCaseDetailDto _$BankCaseDetailDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('BankCaseDetailDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['bankCase', 'history']);
      final val = BankCaseDetailDto(
        bankCase: $checkedConvert(
          'bankCase',
          (v) => BankCaseDto.fromJson(v as Map<String, dynamic>),
        ),
        history: $checkedConvert(
          'history',
          (v) => (v as List<dynamic>)
              .map(
                (e) =>
                    BankCaseTransitionDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$BankCaseDetailDtoToJson(BankCaseDetailDto instance) =>
    <String, dynamic>{
      'bankCase': instance.bankCase.toJson(),
      'history': instance.history.map((e) => e.toJson()).toList(),
    };
