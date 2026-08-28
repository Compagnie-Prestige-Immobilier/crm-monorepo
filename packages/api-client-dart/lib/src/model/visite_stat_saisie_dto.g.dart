// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_stat_saisie_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteStatSaisieDtoCWProxy {
  VisiteStatSaisieDto memeJour(num memeJour);

  VisiteStatSaisieDto lendemain(num lendemain);

  VisiteStatSaisieDto plusTard(num plusTard);

  VisiteStatSaisieDto delaiMedianHeures(num? delaiMedianHeures);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatSaisieDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatSaisieDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatSaisieDto call({
    num memeJour,
    num lendemain,
    num plusTard,
    num? delaiMedianHeures,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteStatSaisieDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteStatSaisieDto.copyWith.fieldName(...)`
class _$VisiteStatSaisieDtoCWProxyImpl implements _$VisiteStatSaisieDtoCWProxy {
  const _$VisiteStatSaisieDtoCWProxyImpl(this._value);

  final VisiteStatSaisieDto _value;

  @override
  VisiteStatSaisieDto memeJour(num memeJour) => this(memeJour: memeJour);

  @override
  VisiteStatSaisieDto lendemain(num lendemain) => this(lendemain: lendemain);

  @override
  VisiteStatSaisieDto plusTard(num plusTard) => this(plusTard: plusTard);

  @override
  VisiteStatSaisieDto delaiMedianHeures(num? delaiMedianHeures) =>
      this(delaiMedianHeures: delaiMedianHeures);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatSaisieDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatSaisieDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatSaisieDto call({
    Object? memeJour = const $CopyWithPlaceholder(),
    Object? lendemain = const $CopyWithPlaceholder(),
    Object? plusTard = const $CopyWithPlaceholder(),
    Object? delaiMedianHeures = const $CopyWithPlaceholder(),
  }) {
    return VisiteStatSaisieDto(
      memeJour: memeJour == const $CopyWithPlaceholder()
          ? _value.memeJour
          // ignore: cast_nullable_to_non_nullable
          : memeJour as num,
      lendemain: lendemain == const $CopyWithPlaceholder()
          ? _value.lendemain
          // ignore: cast_nullable_to_non_nullable
          : lendemain as num,
      plusTard: plusTard == const $CopyWithPlaceholder()
          ? _value.plusTard
          // ignore: cast_nullable_to_non_nullable
          : plusTard as num,
      delaiMedianHeures: delaiMedianHeures == const $CopyWithPlaceholder()
          ? _value.delaiMedianHeures
          // ignore: cast_nullable_to_non_nullable
          : delaiMedianHeures as num?,
    );
  }
}

extension $VisiteStatSaisieDtoCopyWith on VisiteStatSaisieDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteStatSaisieDto.copyWith(...)` or like so:`instanceOfVisiteStatSaisieDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteStatSaisieDtoCWProxy get copyWith =>
      _$VisiteStatSaisieDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteStatSaisieDto _$VisiteStatSaisieDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('VisiteStatSaisieDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'memeJour',
          'lendemain',
          'plusTard',
          'delaiMedianHeures',
        ],
      );
      final val = VisiteStatSaisieDto(
        memeJour: $checkedConvert('memeJour', (v) => v as num),
        lendemain: $checkedConvert('lendemain', (v) => v as num),
        plusTard: $checkedConvert('plusTard', (v) => v as num),
        delaiMedianHeures: $checkedConvert(
          'delaiMedianHeures',
          (v) => v as num?,
        ),
      );
      return val;
    });

Map<String, dynamic> _$VisiteStatSaisieDtoToJson(
  VisiteStatSaisieDto instance,
) => <String, dynamic>{
  'memeJour': instance.memeJour,
  'lendemain': instance.lendemain,
  'plusTard': instance.plusTard,
  'delaiMedianHeures': instance.delaiMedianHeures,
};
