// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_case_stage_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankCaseStageDtoCWProxy {
  BankCaseStageDto id(String id);

  BankCaseStageDto code(String code);

  BankCaseStageDto label(String label);

  BankCaseStageDto position(num position);

  BankCaseStageDto color(String color);

  BankCaseStageDto type(BankStageType type);

  BankCaseStageDto isActive(bool isActive);

  BankCaseStageDto isInitial(bool isInitial);

  BankCaseStageDto isSystem(bool isSystem);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseStageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseStageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseStageDto call({
    String id,
    String code,
    String label,
    num position,
    String color,
    BankStageType type,
    bool isActive,
    bool isInitial,
    bool isSystem,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankCaseStageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankCaseStageDto.copyWith.fieldName(...)`
class _$BankCaseStageDtoCWProxyImpl implements _$BankCaseStageDtoCWProxy {
  const _$BankCaseStageDtoCWProxyImpl(this._value);

  final BankCaseStageDto _value;

  @override
  BankCaseStageDto id(String id) => this(id: id);

  @override
  BankCaseStageDto code(String code) => this(code: code);

  @override
  BankCaseStageDto label(String label) => this(label: label);

  @override
  BankCaseStageDto position(num position) => this(position: position);

  @override
  BankCaseStageDto color(String color) => this(color: color);

  @override
  BankCaseStageDto type(BankStageType type) => this(type: type);

  @override
  BankCaseStageDto isActive(bool isActive) => this(isActive: isActive);

  @override
  BankCaseStageDto isInitial(bool isInitial) => this(isInitial: isInitial);

  @override
  BankCaseStageDto isSystem(bool isSystem) => this(isSystem: isSystem);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankCaseStageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankCaseStageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankCaseStageDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? color = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? isInitial = const $CopyWithPlaceholder(),
    Object? isSystem = const $CopyWithPlaceholder(),
  }) {
    return BankCaseStageDto(
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
      position: position == const $CopyWithPlaceholder()
          ? _value.position
          // ignore: cast_nullable_to_non_nullable
          : position as num,
      color: color == const $CopyWithPlaceholder()
          ? _value.color
          // ignore: cast_nullable_to_non_nullable
          : color as String,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as BankStageType,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      isInitial: isInitial == const $CopyWithPlaceholder()
          ? _value.isInitial
          // ignore: cast_nullable_to_non_nullable
          : isInitial as bool,
      isSystem: isSystem == const $CopyWithPlaceholder()
          ? _value.isSystem
          // ignore: cast_nullable_to_non_nullable
          : isSystem as bool,
    );
  }
}

extension $BankCaseStageDtoCopyWith on BankCaseStageDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankCaseStageDto.copyWith(...)` or like so:`instanceOfBankCaseStageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankCaseStageDtoCWProxy get copyWith => _$BankCaseStageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankCaseStageDto _$BankCaseStageDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('BankCaseStageDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'code',
          'label',
          'position',
          'color',
          'type',
          'isActive',
          'isInitial',
          'isSystem',
        ],
      );
      final val = BankCaseStageDto(
        id: $checkedConvert('id', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        position: $checkedConvert('position', (v) => v as num),
        color: $checkedConvert('color', (v) => v as String),
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(
            _$BankStageTypeEnumMap,
            v,
            unknownValue: BankStageType.unknownDefaultOpenApi,
          ),
        ),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        isInitial: $checkedConvert('isInitial', (v) => v as bool),
        isSystem: $checkedConvert('isSystem', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$BankCaseStageDtoToJson(BankCaseStageDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'code': instance.code,
      'label': instance.label,
      'position': instance.position,
      'color': instance.color,
      'type': _$BankStageTypeEnumMap[instance.type]!,
      'isActive': instance.isActive,
      'isInitial': instance.isInitial,
      'isSystem': instance.isSystem,
    };

const _$BankStageTypeEnumMap = {
  BankStageType.OPEN: 'OPEN',
  BankStageType.CASHED: 'CASHED',
  BankStageType.REJECTED: 'REJECTED',
  BankStageType.unknownDefaultOpenApi: 'unknown_default_open_api',
};
