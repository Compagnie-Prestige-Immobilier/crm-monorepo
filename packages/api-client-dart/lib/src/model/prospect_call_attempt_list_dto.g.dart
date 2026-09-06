// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prospect_call_attempt_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ProspectCallAttemptListDtoCWProxy {
  ProspectCallAttemptListDto items(List<ProspectCallAttemptDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectCallAttemptListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectCallAttemptListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectCallAttemptListDto call({List<ProspectCallAttemptDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfProspectCallAttemptListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfProspectCallAttemptListDto.copyWith.fieldName(...)`
class _$ProspectCallAttemptListDtoCWProxyImpl
    implements _$ProspectCallAttemptListDtoCWProxy {
  const _$ProspectCallAttemptListDtoCWProxyImpl(this._value);

  final ProspectCallAttemptListDto _value;

  @override
  ProspectCallAttemptListDto items(List<ProspectCallAttemptDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectCallAttemptListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectCallAttemptListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectCallAttemptListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return ProspectCallAttemptListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<ProspectCallAttemptDto>,
    );
  }
}

extension $ProspectCallAttemptListDtoCopyWith on ProspectCallAttemptListDto {
  /// Returns a callable class that can be used as follows: `instanceOfProspectCallAttemptListDto.copyWith(...)` or like so:`instanceOfProspectCallAttemptListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ProspectCallAttemptListDtoCWProxy get copyWith =>
      _$ProspectCallAttemptListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProspectCallAttemptListDto _$ProspectCallAttemptListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ProspectCallAttemptListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = ProspectCallAttemptListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => ProspectCallAttemptDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$ProspectCallAttemptListDtoToJson(
  ProspectCallAttemptListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
