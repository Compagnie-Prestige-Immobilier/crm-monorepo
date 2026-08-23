// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'set_active_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SetActiveDtoCWProxy {
  SetActiveDto isActive(bool isActive);

  SetActiveDto handoverToId(String? handoverToId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetActiveDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetActiveDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetActiveDto call({bool isActive, String? handoverToId});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSetActiveDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSetActiveDto.copyWith.fieldName(...)`
class _$SetActiveDtoCWProxyImpl implements _$SetActiveDtoCWProxy {
  const _$SetActiveDtoCWProxyImpl(this._value);

  final SetActiveDto _value;

  @override
  SetActiveDto isActive(bool isActive) => this(isActive: isActive);

  @override
  SetActiveDto handoverToId(String? handoverToId) =>
      this(handoverToId: handoverToId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetActiveDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetActiveDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetActiveDto call({
    Object? isActive = const $CopyWithPlaceholder(),
    Object? handoverToId = const $CopyWithPlaceholder(),
  }) {
    return SetActiveDto(
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      handoverToId: handoverToId == const $CopyWithPlaceholder()
          ? _value.handoverToId
          // ignore: cast_nullable_to_non_nullable
          : handoverToId as String?,
    );
  }
}

extension $SetActiveDtoCopyWith on SetActiveDto {
  /// Returns a callable class that can be used as follows: `instanceOfSetActiveDto.copyWith(...)` or like so:`instanceOfSetActiveDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SetActiveDtoCWProxy get copyWith => _$SetActiveDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SetActiveDto _$SetActiveDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SetActiveDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['isActive']);
      final val = SetActiveDto(
        isActive: $checkedConvert('isActive', (v) => v as bool),
        handoverToId: $checkedConvert('handoverToId', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$SetActiveDtoToJson(SetActiveDto instance) =>
    <String, dynamic>{
      'isActive': instance.isActive,
      if (instance.handoverToId case final value?) 'handoverToId': value,
    };
