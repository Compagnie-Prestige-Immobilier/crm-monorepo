// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'client_request_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ClientRequestListDtoCWProxy {
  ClientRequestListDto items(List<ClientRequestDto> items);

  ClientRequestListDto meta(PageMetaDto meta);

  ClientRequestListDto pendingCount(num pendingCount);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ClientRequestListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ClientRequestListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ClientRequestListDto call({
    List<ClientRequestDto> items,
    PageMetaDto meta,
    num pendingCount,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfClientRequestListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfClientRequestListDto.copyWith.fieldName(...)`
class _$ClientRequestListDtoCWProxyImpl
    implements _$ClientRequestListDtoCWProxy {
  const _$ClientRequestListDtoCWProxyImpl(this._value);

  final ClientRequestListDto _value;

  @override
  ClientRequestListDto items(List<ClientRequestDto> items) =>
      this(items: items);

  @override
  ClientRequestListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  ClientRequestListDto pendingCount(num pendingCount) =>
      this(pendingCount: pendingCount);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ClientRequestListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ClientRequestListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ClientRequestListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
    Object? pendingCount = const $CopyWithPlaceholder(),
  }) {
    return ClientRequestListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<ClientRequestDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
      pendingCount: pendingCount == const $CopyWithPlaceholder()
          ? _value.pendingCount
          // ignore: cast_nullable_to_non_nullable
          : pendingCount as num,
    );
  }
}

extension $ClientRequestListDtoCopyWith on ClientRequestListDto {
  /// Returns a callable class that can be used as follows: `instanceOfClientRequestListDto.copyWith(...)` or like so:`instanceOfClientRequestListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ClientRequestListDtoCWProxy get copyWith =>
      _$ClientRequestListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClientRequestListDto _$ClientRequestListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ClientRequestListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'meta', 'pendingCount']);
  final val = ClientRequestListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => ClientRequestDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    meta: $checkedConvert(
      'meta',
      (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
    ),
    pendingCount: $checkedConvert('pendingCount', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$ClientRequestListDtoToJson(
  ClientRequestListDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'meta': instance.meta.toJson(),
  'pendingCount': instance.pendingCount,
};
