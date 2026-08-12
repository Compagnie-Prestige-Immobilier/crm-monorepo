// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'top_commercial_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TopCommercialDtoCWProxy {
  TopCommercialDto id(String id);

  TopCommercialDto label(String label);

  TopCommercialDto prospects(num prospects);

  TopCommercialDto representants(num representants);

  TopCommercialDto share(num share);

  TopCommercialDto derniereSaisie(DateTime? derniereSaisie);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TopCommercialDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TopCommercialDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TopCommercialDto call({
    String id,
    String label,
    num prospects,
    num representants,
    num share,
    DateTime? derniereSaisie,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfTopCommercialDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfTopCommercialDto.copyWith.fieldName(...)`
class _$TopCommercialDtoCWProxyImpl implements _$TopCommercialDtoCWProxy {
  const _$TopCommercialDtoCWProxyImpl(this._value);

  final TopCommercialDto _value;

  @override
  TopCommercialDto id(String id) => this(id: id);

  @override
  TopCommercialDto label(String label) => this(label: label);

  @override
  TopCommercialDto prospects(num prospects) => this(prospects: prospects);

  @override
  TopCommercialDto representants(num representants) =>
      this(representants: representants);

  @override
  TopCommercialDto share(num share) => this(share: share);

  @override
  TopCommercialDto derniereSaisie(DateTime? derniereSaisie) =>
      this(derniereSaisie: derniereSaisie);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TopCommercialDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TopCommercialDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TopCommercialDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? representants = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
    Object? derniereSaisie = const $CopyWithPlaceholder(),
  }) {
    return TopCommercialDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as num,
      representants: representants == const $CopyWithPlaceholder()
          ? _value.representants
          // ignore: cast_nullable_to_non_nullable
          : representants as num,
      share: share == const $CopyWithPlaceholder()
          ? _value.share
          // ignore: cast_nullable_to_non_nullable
          : share as num,
      derniereSaisie: derniereSaisie == const $CopyWithPlaceholder()
          ? _value.derniereSaisie
          // ignore: cast_nullable_to_non_nullable
          : derniereSaisie as DateTime?,
    );
  }
}

extension $TopCommercialDtoCopyWith on TopCommercialDto {
  /// Returns a callable class that can be used as follows: `instanceOfTopCommercialDto.copyWith(...)` or like so:`instanceOfTopCommercialDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TopCommercialDtoCWProxy get copyWith => _$TopCommercialDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TopCommercialDto _$TopCommercialDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TopCommercialDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'label',
          'prospects',
          'representants',
          'share',
          'derniereSaisie',
        ],
      );
      final val = TopCommercialDto(
        id: $checkedConvert('id', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        prospects: $checkedConvert('prospects', (v) => v as num),
        representants: $checkedConvert('representants', (v) => v as num),
        share: $checkedConvert('share', (v) => v as num),
        derniereSaisie: $checkedConvert(
          'derniereSaisie',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$TopCommercialDtoToJson(TopCommercialDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'label': instance.label,
      'prospects': instance.prospects,
      'representants': instance.representants,
      'share': instance.share,
      'derniereSaisie': instance.derniereSaisie?.toIso8601String(),
    };
