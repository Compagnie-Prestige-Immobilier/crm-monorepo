// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_call_outcome_reason_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateCallOutcomeReasonDtoCWProxy {
  UpdateCallOutcomeReasonDto label(String? label);

  UpdateCallOutcomeReasonDto color(String? color);

  UpdateCallOutcomeReasonDto sortOrder(num? sortOrder);

  UpdateCallOutcomeReasonDto requiresComment(bool? requiresComment);

  UpdateCallOutcomeReasonDto requiresCallback(bool? requiresCallback);

  UpdateCallOutcomeReasonDto countsAsReached(bool? countsAsReached);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateCallOutcomeReasonDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateCallOutcomeReasonDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateCallOutcomeReasonDto call({
    String? label,
    String? color,
    num? sortOrder,
    bool? requiresComment,
    bool? requiresCallback,
    bool? countsAsReached,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateCallOutcomeReasonDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateCallOutcomeReasonDto.copyWith.fieldName(...)`
class _$UpdateCallOutcomeReasonDtoCWProxyImpl
    implements _$UpdateCallOutcomeReasonDtoCWProxy {
  const _$UpdateCallOutcomeReasonDtoCWProxyImpl(this._value);

  final UpdateCallOutcomeReasonDto _value;

  @override
  UpdateCallOutcomeReasonDto label(String? label) => this(label: label);

  @override
  UpdateCallOutcomeReasonDto color(String? color) => this(color: color);

  @override
  UpdateCallOutcomeReasonDto sortOrder(num? sortOrder) =>
      this(sortOrder: sortOrder);

  @override
  UpdateCallOutcomeReasonDto requiresComment(bool? requiresComment) =>
      this(requiresComment: requiresComment);

  @override
  UpdateCallOutcomeReasonDto requiresCallback(bool? requiresCallback) =>
      this(requiresCallback: requiresCallback);

  @override
  UpdateCallOutcomeReasonDto countsAsReached(bool? countsAsReached) =>
      this(countsAsReached: countsAsReached);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateCallOutcomeReasonDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateCallOutcomeReasonDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateCallOutcomeReasonDto call({
    Object? label = const $CopyWithPlaceholder(),
    Object? color = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
    Object? requiresComment = const $CopyWithPlaceholder(),
    Object? requiresCallback = const $CopyWithPlaceholder(),
    Object? countsAsReached = const $CopyWithPlaceholder(),
  }) {
    return UpdateCallOutcomeReasonDto(
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String?,
      color: color == const $CopyWithPlaceholder()
          ? _value.color
          // ignore: cast_nullable_to_non_nullable
          : color as String?,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num?,
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
    );
  }
}

extension $UpdateCallOutcomeReasonDtoCopyWith on UpdateCallOutcomeReasonDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateCallOutcomeReasonDto.copyWith(...)` or like so:`instanceOfUpdateCallOutcomeReasonDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateCallOutcomeReasonDtoCWProxy get copyWith =>
      _$UpdateCallOutcomeReasonDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateCallOutcomeReasonDto _$UpdateCallOutcomeReasonDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateCallOutcomeReasonDto', json, ($checkedConvert) {
  final val = UpdateCallOutcomeReasonDto(
    label: $checkedConvert('label', (v) => v as String?),
    color: $checkedConvert('color', (v) => v as String?),
    sortOrder: $checkedConvert('sortOrder', (v) => v as num?),
    requiresComment: $checkedConvert('requiresComment', (v) => v as bool?),
    requiresCallback: $checkedConvert('requiresCallback', (v) => v as bool?),
    countsAsReached: $checkedConvert('countsAsReached', (v) => v as bool?),
  );
  return val;
});

Map<String, dynamic> _$UpdateCallOutcomeReasonDtoToJson(
  UpdateCallOutcomeReasonDto instance,
) => <String, dynamic>{
  if (instance.label case final value?) 'label': value,
  if (instance.color case final value?) 'color': value,
  if (instance.sortOrder case final value?) 'sortOrder': value,
  if (instance.requiresComment case final value?) 'requiresComment': value,
  if (instance.requiresCallback case final value?) 'requiresCallback': value,
  if (instance.countsAsReached case final value?) 'countsAsReached': value,
};
