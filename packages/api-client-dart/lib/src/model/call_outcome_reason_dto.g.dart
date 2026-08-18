// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'call_outcome_reason_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CallOutcomeReasonDtoCWProxy {
  CallOutcomeReasonDto id(String id);

  CallOutcomeReasonDto code(String code);

  CallOutcomeReasonDto label(String label);

  CallOutcomeReasonDto effect(CallOutcomeEffect effect);

  CallOutcomeReasonDto requiresComment(bool requiresComment);

  CallOutcomeReasonDto requiresCallback(bool requiresCallback);

  CallOutcomeReasonDto countsAsReached(bool countsAsReached);

  CallOutcomeReasonDto isActive(bool isActive);

  CallOutcomeReasonDto isSystem(bool isSystem);

  CallOutcomeReasonDto sortOrder(num sortOrder);

  CallOutcomeReasonDto color(String? color);

  CallOutcomeReasonDto minPayloadVersion(num minPayloadVersion);

  CallOutcomeReasonDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CallOutcomeReasonDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CallOutcomeReasonDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CallOutcomeReasonDto call({
    String id,
    String code,
    String label,
    CallOutcomeEffect effect,
    bool requiresComment,
    bool requiresCallback,
    bool countsAsReached,
    bool isActive,
    bool isSystem,
    num sortOrder,
    String? color,
    num minPayloadVersion,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCallOutcomeReasonDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCallOutcomeReasonDto.copyWith.fieldName(...)`
class _$CallOutcomeReasonDtoCWProxyImpl
    implements _$CallOutcomeReasonDtoCWProxy {
  const _$CallOutcomeReasonDtoCWProxyImpl(this._value);

  final CallOutcomeReasonDto _value;

  @override
  CallOutcomeReasonDto id(String id) => this(id: id);

  @override
  CallOutcomeReasonDto code(String code) => this(code: code);

  @override
  CallOutcomeReasonDto label(String label) => this(label: label);

  @override
  CallOutcomeReasonDto effect(CallOutcomeEffect effect) => this(effect: effect);

  @override
  CallOutcomeReasonDto requiresComment(bool requiresComment) =>
      this(requiresComment: requiresComment);

  @override
  CallOutcomeReasonDto requiresCallback(bool requiresCallback) =>
      this(requiresCallback: requiresCallback);

  @override
  CallOutcomeReasonDto countsAsReached(bool countsAsReached) =>
      this(countsAsReached: countsAsReached);

  @override
  CallOutcomeReasonDto isActive(bool isActive) => this(isActive: isActive);

  @override
  CallOutcomeReasonDto isSystem(bool isSystem) => this(isSystem: isSystem);

  @override
  CallOutcomeReasonDto sortOrder(num sortOrder) => this(sortOrder: sortOrder);

  @override
  CallOutcomeReasonDto color(String? color) => this(color: color);

  @override
  CallOutcomeReasonDto minPayloadVersion(num minPayloadVersion) =>
      this(minPayloadVersion: minPayloadVersion);

  @override
  CallOutcomeReasonDto updatedAt(DateTime updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CallOutcomeReasonDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CallOutcomeReasonDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CallOutcomeReasonDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? effect = const $CopyWithPlaceholder(),
    Object? requiresComment = const $CopyWithPlaceholder(),
    Object? requiresCallback = const $CopyWithPlaceholder(),
    Object? countsAsReached = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? isSystem = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
    Object? color = const $CopyWithPlaceholder(),
    Object? minPayloadVersion = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return CallOutcomeReasonDto(
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
      effect: effect == const $CopyWithPlaceholder()
          ? _value.effect
          // ignore: cast_nullable_to_non_nullable
          : effect as CallOutcomeEffect,
      requiresComment: requiresComment == const $CopyWithPlaceholder()
          ? _value.requiresComment
          // ignore: cast_nullable_to_non_nullable
          : requiresComment as bool,
      requiresCallback: requiresCallback == const $CopyWithPlaceholder()
          ? _value.requiresCallback
          // ignore: cast_nullable_to_non_nullable
          : requiresCallback as bool,
      countsAsReached: countsAsReached == const $CopyWithPlaceholder()
          ? _value.countsAsReached
          // ignore: cast_nullable_to_non_nullable
          : countsAsReached as bool,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      isSystem: isSystem == const $CopyWithPlaceholder()
          ? _value.isSystem
          // ignore: cast_nullable_to_non_nullable
          : isSystem as bool,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num,
      color: color == const $CopyWithPlaceholder()
          ? _value.color
          // ignore: cast_nullable_to_non_nullable
          : color as String?,
      minPayloadVersion: minPayloadVersion == const $CopyWithPlaceholder()
          ? _value.minPayloadVersion
          // ignore: cast_nullable_to_non_nullable
          : minPayloadVersion as num,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $CallOutcomeReasonDtoCopyWith on CallOutcomeReasonDto {
  /// Returns a callable class that can be used as follows: `instanceOfCallOutcomeReasonDto.copyWith(...)` or like so:`instanceOfCallOutcomeReasonDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CallOutcomeReasonDtoCWProxy get copyWith =>
      _$CallOutcomeReasonDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CallOutcomeReasonDto _$CallOutcomeReasonDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CallOutcomeReasonDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'code',
      'label',
      'effect',
      'requiresComment',
      'requiresCallback',
      'countsAsReached',
      'isActive',
      'isSystem',
      'sortOrder',
      'color',
      'minPayloadVersion',
      'updatedAt',
    ],
  );
  final val = CallOutcomeReasonDto(
    id: $checkedConvert('id', (v) => v as String),
    code: $checkedConvert('code', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    effect: $checkedConvert(
      'effect',
      (v) => $enumDecode(
        _$CallOutcomeEffectEnumMap,
        v,
        unknownValue: CallOutcomeEffect.unknownDefaultOpenApi,
      ),
    ),
    requiresComment: $checkedConvert('requiresComment', (v) => v as bool),
    requiresCallback: $checkedConvert('requiresCallback', (v) => v as bool),
    countsAsReached: $checkedConvert('countsAsReached', (v) => v as bool),
    isActive: $checkedConvert('isActive', (v) => v as bool),
    isSystem: $checkedConvert('isSystem', (v) => v as bool),
    sortOrder: $checkedConvert('sortOrder', (v) => v as num),
    color: $checkedConvert('color', (v) => v as String?),
    minPayloadVersion: $checkedConvert('minPayloadVersion', (v) => v as num),
    updatedAt: $checkedConvert('updatedAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$CallOutcomeReasonDtoToJson(
  CallOutcomeReasonDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'label': instance.label,
  'effect': _$CallOutcomeEffectEnumMap[instance.effect]!,
  'requiresComment': instance.requiresComment,
  'requiresCallback': instance.requiresCallback,
  'countsAsReached': instance.countsAsReached,
  'isActive': instance.isActive,
  'isSystem': instance.isSystem,
  'sortOrder': instance.sortOrder,
  'color': instance.color,
  'minPayloadVersion': instance.minPayloadVersion,
  'updatedAt': instance.updatedAt.toIso8601String(),
};

const _$CallOutcomeEffectEnumMap = {
  CallOutcomeEffect.CLOSE_METHOD: 'CLOSE_METHOD',
  CallOutcomeEffect.CLOSE_REFUSED: 'CLOSE_REFUSED',
  CallOutcomeEffect.CLOSE_WRONG_NUMBER: 'CLOSE_WRONG_NUMBER',
  CallOutcomeEffect.KEEP_OPEN: 'KEEP_OPEN',
  CallOutcomeEffect.SCHEDULE_CALLBACK: 'SCHEDULE_CALLBACK',
  CallOutcomeEffect.unknownDefaultOpenApi: 'unknown_default_open_api',
};
