// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_statut_qualification_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateStatutQualificationDtoCWProxy {
  UpdateStatutQualificationDto label(String? label);

  UpdateStatutQualificationDto requiresCallback(bool? requiresCallback);

  UpdateStatutQualificationDto sortOrder(num? sortOrder);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateStatutQualificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateStatutQualificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateStatutQualificationDto call({
    String? label,
    bool? requiresCallback,
    num? sortOrder,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateStatutQualificationDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateStatutQualificationDto.copyWith.fieldName(...)`
class _$UpdateStatutQualificationDtoCWProxyImpl
    implements _$UpdateStatutQualificationDtoCWProxy {
  const _$UpdateStatutQualificationDtoCWProxyImpl(this._value);

  final UpdateStatutQualificationDto _value;

  @override
  UpdateStatutQualificationDto label(String? label) => this(label: label);

  @override
  UpdateStatutQualificationDto requiresCallback(bool? requiresCallback) =>
      this(requiresCallback: requiresCallback);

  @override
  UpdateStatutQualificationDto sortOrder(num? sortOrder) =>
      this(sortOrder: sortOrder);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateStatutQualificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateStatutQualificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateStatutQualificationDto call({
    Object? label = const $CopyWithPlaceholder(),
    Object? requiresCallback = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
  }) {
    return UpdateStatutQualificationDto(
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String?,
      requiresCallback: requiresCallback == const $CopyWithPlaceholder()
          ? _value.requiresCallback
          // ignore: cast_nullable_to_non_nullable
          : requiresCallback as bool?,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num?,
    );
  }
}

extension $UpdateStatutQualificationDtoCopyWith
    on UpdateStatutQualificationDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateStatutQualificationDto.copyWith(...)` or like so:`instanceOfUpdateStatutQualificationDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateStatutQualificationDtoCWProxy get copyWith =>
      _$UpdateStatutQualificationDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateStatutQualificationDto _$UpdateStatutQualificationDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateStatutQualificationDto', json, ($checkedConvert) {
  final val = UpdateStatutQualificationDto(
    label: $checkedConvert('label', (v) => v as String?),
    requiresCallback: $checkedConvert('requiresCallback', (v) => v as bool?),
    sortOrder: $checkedConvert('sortOrder', (v) => v as num?),
  );
  return val;
});

Map<String, dynamic> _$UpdateStatutQualificationDtoToJson(
  UpdateStatutQualificationDto instance,
) => <String, dynamic>{
  if (instance.label case final value?) 'label': value,
  if (instance.requiresCallback case final value?) 'requiresCallback': value,
  if (instance.sortOrder case final value?) 'sortOrder': value,
};
