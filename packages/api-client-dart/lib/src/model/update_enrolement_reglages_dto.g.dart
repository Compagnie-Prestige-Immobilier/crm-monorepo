// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_enrolement_reglages_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateEnrolementReglagesDtoCWProxy {
  UpdateEnrolementReglagesDto frequenceMinutes(num? frequenceMinutes);

  UpdateEnrolementReglagesDto repriseDepuis(DateTime? repriseDepuis);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateEnrolementReglagesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateEnrolementReglagesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateEnrolementReglagesDto call({
    num? frequenceMinutes,
    DateTime? repriseDepuis,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateEnrolementReglagesDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateEnrolementReglagesDto.copyWith.fieldName(...)`
class _$UpdateEnrolementReglagesDtoCWProxyImpl
    implements _$UpdateEnrolementReglagesDtoCWProxy {
  const _$UpdateEnrolementReglagesDtoCWProxyImpl(this._value);

  final UpdateEnrolementReglagesDto _value;

  @override
  UpdateEnrolementReglagesDto frequenceMinutes(num? frequenceMinutes) =>
      this(frequenceMinutes: frequenceMinutes);

  @override
  UpdateEnrolementReglagesDto repriseDepuis(DateTime? repriseDepuis) =>
      this(repriseDepuis: repriseDepuis);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateEnrolementReglagesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateEnrolementReglagesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateEnrolementReglagesDto call({
    Object? frequenceMinutes = const $CopyWithPlaceholder(),
    Object? repriseDepuis = const $CopyWithPlaceholder(),
  }) {
    return UpdateEnrolementReglagesDto(
      frequenceMinutes: frequenceMinutes == const $CopyWithPlaceholder()
          ? _value.frequenceMinutes
          // ignore: cast_nullable_to_non_nullable
          : frequenceMinutes as num?,
      repriseDepuis: repriseDepuis == const $CopyWithPlaceholder()
          ? _value.repriseDepuis
          // ignore: cast_nullable_to_non_nullable
          : repriseDepuis as DateTime?,
    );
  }
}

extension $UpdateEnrolementReglagesDtoCopyWith on UpdateEnrolementReglagesDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateEnrolementReglagesDto.copyWith(...)` or like so:`instanceOfUpdateEnrolementReglagesDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateEnrolementReglagesDtoCWProxy get copyWith =>
      _$UpdateEnrolementReglagesDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateEnrolementReglagesDto _$UpdateEnrolementReglagesDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateEnrolementReglagesDto', json, ($checkedConvert) {
  final val = UpdateEnrolementReglagesDto(
    frequenceMinutes: $checkedConvert('frequenceMinutes', (v) => v as num?),
    repriseDepuis: $checkedConvert(
      'repriseDepuis',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$UpdateEnrolementReglagesDtoToJson(
  UpdateEnrolementReglagesDto instance,
) => <String, dynamic>{
  if (instance.frequenceMinutes case final value?) 'frequenceMinutes': value,
  if (instance.repriseDepuis?.toIso8601String() case final value?)
    'repriseDepuis': value,
};
