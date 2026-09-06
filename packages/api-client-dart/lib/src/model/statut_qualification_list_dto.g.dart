// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'statut_qualification_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$StatutQualificationListDtoCWProxy {
  StatutQualificationListDto items(List<StatutQualificationDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StatutQualificationListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StatutQualificationListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StatutQualificationListDto call({List<StatutQualificationDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfStatutQualificationListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfStatutQualificationListDto.copyWith.fieldName(...)`
class _$StatutQualificationListDtoCWProxyImpl
    implements _$StatutQualificationListDtoCWProxy {
  const _$StatutQualificationListDtoCWProxyImpl(this._value);

  final StatutQualificationListDto _value;

  @override
  StatutQualificationListDto items(List<StatutQualificationDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StatutQualificationListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StatutQualificationListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StatutQualificationListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return StatutQualificationListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<StatutQualificationDto>,
    );
  }
}

extension $StatutQualificationListDtoCopyWith on StatutQualificationListDto {
  /// Returns a callable class that can be used as follows: `instanceOfStatutQualificationListDto.copyWith(...)` or like so:`instanceOfStatutQualificationListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$StatutQualificationListDtoCWProxy get copyWith =>
      _$StatutQualificationListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StatutQualificationListDto _$StatutQualificationListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('StatutQualificationListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = StatutQualificationListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => StatutQualificationDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$StatutQualificationListDtoToJson(
  StatutQualificationListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
