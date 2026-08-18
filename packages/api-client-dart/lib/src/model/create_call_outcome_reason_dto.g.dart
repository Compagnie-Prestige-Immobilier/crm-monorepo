// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_call_outcome_reason_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateCallOutcomeReasonDtoCWProxy {
  CreateCallOutcomeReasonDto code(String code);

  CreateCallOutcomeReasonDto label(String label);

  CreateCallOutcomeReasonDto effect(CallOutcomeEffect effect);

  CreateCallOutcomeReasonDto requiresComment(bool? requiresComment);

  CreateCallOutcomeReasonDto requiresCallback(bool? requiresCallback);

  CreateCallOutcomeReasonDto countsAsReached(bool? countsAsReached);

  CreateCallOutcomeReasonDto color(String? color);

  CreateCallOutcomeReasonDto sortOrder(num? sortOrder);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateCallOutcomeReasonDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateCallOutcomeReasonDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateCallOutcomeReasonDto call({
    String code,
    String label,
    CallOutcomeEffect effect,
    bool? requiresComment,
    bool? requiresCallback,
    bool? countsAsReached,
    String? color,
    num? sortOrder,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateCallOutcomeReasonDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateCallOutcomeReasonDto.copyWith.fieldName(...)`
class _$CreateCallOutcomeReasonDtoCWProxyImpl
    implements _$CreateCallOutcomeReasonDtoCWProxy {
  const _$CreateCallOutcomeReasonDtoCWProxyImpl(this._value);

  final CreateCallOutcomeReasonDto _value;

  @override
  CreateCallOutcomeReasonDto code(String code) => this(code: code);

  @override
  CreateCallOutcomeReasonDto label(String label) => this(label: label);

  @override
  CreateCallOutcomeReasonDto effect(CallOutcomeEffect effect) =>
      this(effect: effect);

  @override
  CreateCallOutcomeReasonDto requiresComment(bool? requiresComment) =>
      this(requiresComment: requiresComment);

  @override
  CreateCallOutcomeReasonDto requiresCallback(bool? requiresCallback) =>
      this(requiresCallback: requiresCallback);

  @override
  CreateCallOutcomeReasonDto countsAsReached(bool? countsAsReached) =>
      this(countsAsReached: countsAsReached);

  @override
  CreateCallOutcomeReasonDto color(String? color) => this(color: color);

  @override
  CreateCallOutcomeReasonDto sortOrder(num? sortOrder) =>
      this(sortOrder: sortOrder);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateCallOutcomeReasonDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateCallOutcomeReasonDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateCallOutcomeReasonDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? effect = const $CopyWithPlaceholder(),
    Object? requiresComment = const $CopyWithPlaceholder(),
    Object? requiresCallback = const $CopyWithPlaceholder(),
    Object? countsAsReached = const $CopyWithPlaceholder(),
    Object? color = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
  }) {
    return CreateCallOutcomeReasonDto(
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
          : requiresComment as bool?,
      requiresCallback: requiresCallback == const $CopyWithPlaceholder()
          ? _value.requiresCallback
          // ignore: cast_nullable_to_non_nullable
          : requiresCallback as bool?,
      countsAsReached: countsAsReached == const $CopyWithPlaceholder()
          ? _value.countsAsReached
          // ignore: cast_nullable_to_non_nullable
          : countsAsReached as bool?,
      color: color == const $CopyWithPlaceholder()
          ? _value.color
          // ignore: cast_nullable_to_non_nullable
          : color as String?,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num?,
    );
  }
}

extension $CreateCallOutcomeReasonDtoCopyWith on CreateCallOutcomeReasonDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateCallOutcomeReasonDto.copyWith(...)` or like so:`instanceOfCreateCallOutcomeReasonDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateCallOutcomeReasonDtoCWProxy get copyWith =>
      _$CreateCallOutcomeReasonDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateCallOutcomeReasonDto _$CreateCallOutcomeReasonDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateCallOutcomeReasonDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['code', 'label', 'effect']);
  final val = CreateCallOutcomeReasonDto(
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
    requiresComment: $checkedConvert(
      'requiresComment',
      (v) => v as bool? ?? false,
    ),
    requiresCallback: $checkedConvert(
      'requiresCallback',
      (v) => v as bool? ?? false,
    ),
    countsAsReached: $checkedConvert(
      'countsAsReached',
      (v) => v as bool? ?? true,
    ),
    color: $checkedConvert('color', (v) => v as String?),
    sortOrder: $checkedConvert('sortOrder', (v) => v as num? ?? 100),
  );
  return val;
});

Map<String, dynamic> _$CreateCallOutcomeReasonDtoToJson(
  CreateCallOutcomeReasonDto instance,
) => <String, dynamic>{
  'code': instance.code,
  'label': instance.label,
  'effect': _$CallOutcomeEffectEnumMap[instance.effect]!,
  if (instance.requiresComment case final value?) 'requiresComment': value,
  if (instance.requiresCallback case final value?) 'requiresCallback': value,
  if (instance.countsAsReached case final value?) 'countsAsReached': value,
  if (instance.color case final value?) 'color': value,
  if (instance.sortOrder case final value?) 'sortOrder': value,
};

const _$CallOutcomeEffectEnumMap = {
  CallOutcomeEffect.CLOSE_METHOD: 'CLOSE_METHOD',
  CallOutcomeEffect.CLOSE_REFUSED: 'CLOSE_REFUSED',
  CallOutcomeEffect.CLOSE_WRONG_NUMBER: 'CLOSE_WRONG_NUMBER',
  CallOutcomeEffect.KEEP_OPEN: 'KEEP_OPEN',
  CallOutcomeEffect.SCHEDULE_CALLBACK: 'SCHEDULE_CALLBACK',
  CallOutcomeEffect.unknownDefaultOpenApi: 'unknown_default_open_api',
};
