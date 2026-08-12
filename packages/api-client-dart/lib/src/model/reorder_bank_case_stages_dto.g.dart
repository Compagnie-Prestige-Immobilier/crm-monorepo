// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reorder_bank_case_stages_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ReorderBankCaseStagesDtoCWProxy {
  ReorderBankCaseStagesDto stageIds(List<String> stageIds);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReorderBankCaseStagesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReorderBankCaseStagesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReorderBankCaseStagesDto call({List<String> stageIds});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfReorderBankCaseStagesDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfReorderBankCaseStagesDto.copyWith.fieldName(...)`
class _$ReorderBankCaseStagesDtoCWProxyImpl
    implements _$ReorderBankCaseStagesDtoCWProxy {
  const _$ReorderBankCaseStagesDtoCWProxyImpl(this._value);

  final ReorderBankCaseStagesDto _value;

  @override
  ReorderBankCaseStagesDto stageIds(List<String> stageIds) =>
      this(stageIds: stageIds);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReorderBankCaseStagesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReorderBankCaseStagesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReorderBankCaseStagesDto call({
    Object? stageIds = const $CopyWithPlaceholder(),
  }) {
    return ReorderBankCaseStagesDto(
      stageIds: stageIds == const $CopyWithPlaceholder()
          ? _value.stageIds
          // ignore: cast_nullable_to_non_nullable
          : stageIds as List<String>,
    );
  }
}

extension $ReorderBankCaseStagesDtoCopyWith on ReorderBankCaseStagesDto {
  /// Returns a callable class that can be used as follows: `instanceOfReorderBankCaseStagesDto.copyWith(...)` or like so:`instanceOfReorderBankCaseStagesDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ReorderBankCaseStagesDtoCWProxy get copyWith =>
      _$ReorderBankCaseStagesDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReorderBankCaseStagesDto _$ReorderBankCaseStagesDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ReorderBankCaseStagesDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['stageIds']);
  final val = ReorderBankCaseStagesDto(
    stageIds: $checkedConvert(
      'stageIds',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$ReorderBankCaseStagesDtoToJson(
  ReorderBankCaseStagesDto instance,
) => <String, dynamic>{'stageIds': instance.stageIds};
