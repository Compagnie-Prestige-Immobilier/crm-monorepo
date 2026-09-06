// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_call_attempt_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantCallAttemptListDtoCWProxy {
  RepresentantCallAttemptListDto items(List<RepresentantCallAttemptDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantCallAttemptListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantCallAttemptListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantCallAttemptListDto call({List<RepresentantCallAttemptDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantCallAttemptListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantCallAttemptListDto.copyWith.fieldName(...)`
class _$RepresentantCallAttemptListDtoCWProxyImpl
    implements _$RepresentantCallAttemptListDtoCWProxy {
  const _$RepresentantCallAttemptListDtoCWProxyImpl(this._value);

  final RepresentantCallAttemptListDto _value;

  @override
  RepresentantCallAttemptListDto items(
    List<RepresentantCallAttemptDto> items,
  ) => this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantCallAttemptListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantCallAttemptListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantCallAttemptListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return RepresentantCallAttemptListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<RepresentantCallAttemptDto>,
    );
  }
}

extension $RepresentantCallAttemptListDtoCopyWith
    on RepresentantCallAttemptListDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantCallAttemptListDto.copyWith(...)` or like so:`instanceOfRepresentantCallAttemptListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantCallAttemptListDtoCWProxy get copyWith =>
      _$RepresentantCallAttemptListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantCallAttemptListDto _$RepresentantCallAttemptListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepresentantCallAttemptListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = RepresentantCallAttemptListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                RepresentantCallAttemptDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$RepresentantCallAttemptListDtoToJson(
  RepresentantCallAttemptListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
