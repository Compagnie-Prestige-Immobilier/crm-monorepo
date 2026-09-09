// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mes_attributions_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MesAttributionsDtoCWProxy {
  MesAttributionsDto representantIds(List<String> representantIds);

  MesAttributionsDto prospectIds(List<String> prospectIds);

  MesAttributionsDto tout(bool tout);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MesAttributionsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MesAttributionsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MesAttributionsDto call({
    List<String> representantIds,
    List<String> prospectIds,
    bool tout,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfMesAttributionsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfMesAttributionsDto.copyWith.fieldName(...)`
class _$MesAttributionsDtoCWProxyImpl implements _$MesAttributionsDtoCWProxy {
  const _$MesAttributionsDtoCWProxyImpl(this._value);

  final MesAttributionsDto _value;

  @override
  MesAttributionsDto representantIds(List<String> representantIds) =>
      this(representantIds: representantIds);

  @override
  MesAttributionsDto prospectIds(List<String> prospectIds) =>
      this(prospectIds: prospectIds);

  @override
  MesAttributionsDto tout(bool tout) => this(tout: tout);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MesAttributionsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MesAttributionsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MesAttributionsDto call({
    Object? representantIds = const $CopyWithPlaceholder(),
    Object? prospectIds = const $CopyWithPlaceholder(),
    Object? tout = const $CopyWithPlaceholder(),
  }) {
    return MesAttributionsDto(
      representantIds: representantIds == const $CopyWithPlaceholder()
          ? _value.representantIds
          // ignore: cast_nullable_to_non_nullable
          : representantIds as List<String>,
      prospectIds: prospectIds == const $CopyWithPlaceholder()
          ? _value.prospectIds
          // ignore: cast_nullable_to_non_nullable
          : prospectIds as List<String>,
      tout: tout == const $CopyWithPlaceholder()
          ? _value.tout
          // ignore: cast_nullable_to_non_nullable
          : tout as bool,
    );
  }
}

extension $MesAttributionsDtoCopyWith on MesAttributionsDto {
  /// Returns a callable class that can be used as follows: `instanceOfMesAttributionsDto.copyWith(...)` or like so:`instanceOfMesAttributionsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MesAttributionsDtoCWProxy get copyWith =>
      _$MesAttributionsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MesAttributionsDto _$MesAttributionsDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MesAttributionsDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['representantIds', 'prospectIds', 'tout'],
      );
      final val = MesAttributionsDto(
        representantIds: $checkedConvert(
          'representantIds',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
        prospectIds: $checkedConvert(
          'prospectIds',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
        tout: $checkedConvert('tout', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$MesAttributionsDtoToJson(MesAttributionsDto instance) =>
    <String, dynamic>{
      'representantIds': instance.representantIds,
      'prospectIds': instance.prospectIds,
      'tout': instance.tout,
    };
