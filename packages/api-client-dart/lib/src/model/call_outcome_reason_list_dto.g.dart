// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'call_outcome_reason_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CallOutcomeReasonListDtoCWProxy {
  CallOutcomeReasonListDto items(List<CallOutcomeReasonDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CallOutcomeReasonListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CallOutcomeReasonListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CallOutcomeReasonListDto call({List<CallOutcomeReasonDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCallOutcomeReasonListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCallOutcomeReasonListDto.copyWith.fieldName(...)`
class _$CallOutcomeReasonListDtoCWProxyImpl
    implements _$CallOutcomeReasonListDtoCWProxy {
  const _$CallOutcomeReasonListDtoCWProxyImpl(this._value);

  final CallOutcomeReasonListDto _value;

  @override
  CallOutcomeReasonListDto items(List<CallOutcomeReasonDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CallOutcomeReasonListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CallOutcomeReasonListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CallOutcomeReasonListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return CallOutcomeReasonListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<CallOutcomeReasonDto>,
    );
  }
}

extension $CallOutcomeReasonListDtoCopyWith on CallOutcomeReasonListDto {
  /// Returns a callable class that can be used as follows: `instanceOfCallOutcomeReasonListDto.copyWith(...)` or like so:`instanceOfCallOutcomeReasonListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CallOutcomeReasonListDtoCWProxy get copyWith =>
      _$CallOutcomeReasonListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CallOutcomeReasonListDto _$CallOutcomeReasonListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CallOutcomeReasonListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = CallOutcomeReasonListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => CallOutcomeReasonDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$CallOutcomeReasonListDtoToJson(
  CallOutcomeReasonListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
