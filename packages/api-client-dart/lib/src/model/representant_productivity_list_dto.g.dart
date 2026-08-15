// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_productivity_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantProductivityListDtoCWProxy {
  RepresentantProductivityListDto items(
    List<RepresentantProductivityDto> items,
  );

  RepresentantProductivityListDto total(num total);

  RepresentantProductivityListDto dormantDays(num dormantDays);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantProductivityListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantProductivityListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantProductivityListDto call({
    List<RepresentantProductivityDto> items,
    num total,
    num dormantDays,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantProductivityListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantProductivityListDto.copyWith.fieldName(...)`
class _$RepresentantProductivityListDtoCWProxyImpl
    implements _$RepresentantProductivityListDtoCWProxy {
  const _$RepresentantProductivityListDtoCWProxyImpl(this._value);

  final RepresentantProductivityListDto _value;

  @override
  RepresentantProductivityListDto items(
    List<RepresentantProductivityDto> items,
  ) => this(items: items);

  @override
  RepresentantProductivityListDto total(num total) => this(total: total);

  @override
  RepresentantProductivityListDto dormantDays(num dormantDays) =>
      this(dormantDays: dormantDays);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantProductivityListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantProductivityListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantProductivityListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
    Object? dormantDays = const $CopyWithPlaceholder(),
  }) {
    return RepresentantProductivityListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<RepresentantProductivityDto>,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
      dormantDays: dormantDays == const $CopyWithPlaceholder()
          ? _value.dormantDays
          // ignore: cast_nullable_to_non_nullable
          : dormantDays as num,
    );
  }
}

extension $RepresentantProductivityListDtoCopyWith
    on RepresentantProductivityListDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantProductivityListDto.copyWith(...)` or like so:`instanceOfRepresentantProductivityListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantProductivityListDtoCWProxy get copyWith =>
      _$RepresentantProductivityListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantProductivityListDto _$RepresentantProductivityListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepresentantProductivityListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'total', 'dormantDays']);
  final val = RepresentantProductivityListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                RepresentantProductivityDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    total: $checkedConvert('total', (v) => v as num),
    dormantDays: $checkedConvert('dormantDays', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$RepresentantProductivityListDtoToJson(
  RepresentantProductivityListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'total': instance.total,
  'dormantDays': instance.dormantDays,
};
