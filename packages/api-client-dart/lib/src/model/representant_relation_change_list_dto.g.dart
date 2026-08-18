// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_relation_change_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantRelationChangeListDtoCWProxy {
  RepresentantRelationChangeListDto items(
    List<RepresentantRelationChangeDto> items,
  );

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantRelationChangeListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantRelationChangeListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantRelationChangeListDto call({
    List<RepresentantRelationChangeDto> items,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantRelationChangeListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantRelationChangeListDto.copyWith.fieldName(...)`
class _$RepresentantRelationChangeListDtoCWProxyImpl
    implements _$RepresentantRelationChangeListDtoCWProxy {
  const _$RepresentantRelationChangeListDtoCWProxyImpl(this._value);

  final RepresentantRelationChangeListDto _value;

  @override
  RepresentantRelationChangeListDto items(
    List<RepresentantRelationChangeDto> items,
  ) => this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantRelationChangeListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantRelationChangeListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantRelationChangeListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return RepresentantRelationChangeListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<RepresentantRelationChangeDto>,
    );
  }
}

extension $RepresentantRelationChangeListDtoCopyWith
    on RepresentantRelationChangeListDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantRelationChangeListDto.copyWith(...)` or like so:`instanceOfRepresentantRelationChangeListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantRelationChangeListDtoCWProxy get copyWith =>
      _$RepresentantRelationChangeListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantRelationChangeListDto _$RepresentantRelationChangeListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepresentantRelationChangeListDto', json, (
  $checkedConvert,
) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = RepresentantRelationChangeListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => RepresentantRelationChangeDto.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$RepresentantRelationChangeListDtoToJson(
  RepresentantRelationChangeListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
