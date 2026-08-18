// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'set_call_outcome_reason_active_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SetCallOutcomeReasonActiveDtoCWProxy {
  SetCallOutcomeReasonActiveDto isActive(bool isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetCallOutcomeReasonActiveDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetCallOutcomeReasonActiveDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetCallOutcomeReasonActiveDto call({bool isActive});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSetCallOutcomeReasonActiveDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSetCallOutcomeReasonActiveDto.copyWith.fieldName(...)`
class _$SetCallOutcomeReasonActiveDtoCWProxyImpl
    implements _$SetCallOutcomeReasonActiveDtoCWProxy {
  const _$SetCallOutcomeReasonActiveDtoCWProxyImpl(this._value);

  final SetCallOutcomeReasonActiveDto _value;

  @override
  SetCallOutcomeReasonActiveDto isActive(bool isActive) =>
      this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetCallOutcomeReasonActiveDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetCallOutcomeReasonActiveDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetCallOutcomeReasonActiveDto call({
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return SetCallOutcomeReasonActiveDto(
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
    );
  }
}

extension $SetCallOutcomeReasonActiveDtoCopyWith
    on SetCallOutcomeReasonActiveDto {
  /// Returns a callable class that can be used as follows: `instanceOfSetCallOutcomeReasonActiveDto.copyWith(...)` or like so:`instanceOfSetCallOutcomeReasonActiveDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SetCallOutcomeReasonActiveDtoCWProxy get copyWith =>
      _$SetCallOutcomeReasonActiveDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SetCallOutcomeReasonActiveDto _$SetCallOutcomeReasonActiveDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SetCallOutcomeReasonActiveDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['isActive']);
  final val = SetCallOutcomeReasonActiveDto(
    isActive: $checkedConvert('isActive', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$SetCallOutcomeReasonActiveDtoToJson(
  SetCallOutcomeReasonActiveDto instance,
) => <String, dynamic>{'isActive': instance.isActive};
