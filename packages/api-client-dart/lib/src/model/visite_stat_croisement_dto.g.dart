// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_stat_croisement_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteStatCroisementDtoCWProxy {
  VisiteStatCroisementDto ligneId(String ligneId);

  VisiteStatCroisementDto colonneId(String colonneId);

  VisiteStatCroisementDto count(num count);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatCroisementDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatCroisementDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatCroisementDto call({String ligneId, String colonneId, num count});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteStatCroisementDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteStatCroisementDto.copyWith.fieldName(...)`
class _$VisiteStatCroisementDtoCWProxyImpl
    implements _$VisiteStatCroisementDtoCWProxy {
  const _$VisiteStatCroisementDtoCWProxyImpl(this._value);

  final VisiteStatCroisementDto _value;

  @override
  VisiteStatCroisementDto ligneId(String ligneId) => this(ligneId: ligneId);

  @override
  VisiteStatCroisementDto colonneId(String colonneId) =>
      this(colonneId: colonneId);

  @override
  VisiteStatCroisementDto count(num count) => this(count: count);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatCroisementDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatCroisementDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatCroisementDto call({
    Object? ligneId = const $CopyWithPlaceholder(),
    Object? colonneId = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
  }) {
    return VisiteStatCroisementDto(
      ligneId: ligneId == const $CopyWithPlaceholder()
          ? _value.ligneId
          // ignore: cast_nullable_to_non_nullable
          : ligneId as String,
      colonneId: colonneId == const $CopyWithPlaceholder()
          ? _value.colonneId
          // ignore: cast_nullable_to_non_nullable
          : colonneId as String,
      count: count == const $CopyWithPlaceholder()
          ? _value.count
          // ignore: cast_nullable_to_non_nullable
          : count as num,
    );
  }
}

extension $VisiteStatCroisementDtoCopyWith on VisiteStatCroisementDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteStatCroisementDto.copyWith(...)` or like so:`instanceOfVisiteStatCroisementDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteStatCroisementDtoCWProxy get copyWith =>
      _$VisiteStatCroisementDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteStatCroisementDto _$VisiteStatCroisementDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteStatCroisementDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['ligneId', 'colonneId', 'count']);
  final val = VisiteStatCroisementDto(
    ligneId: $checkedConvert('ligneId', (v) => v as String),
    colonneId: $checkedConvert('colonneId', (v) => v as String),
    count: $checkedConvert('count', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$VisiteStatCroisementDtoToJson(
  VisiteStatCroisementDto instance,
) => <String, dynamic>{
  'ligneId': instance.ligneId,
  'colonneId': instance.colonneId,
  'count': instance.count,
};
