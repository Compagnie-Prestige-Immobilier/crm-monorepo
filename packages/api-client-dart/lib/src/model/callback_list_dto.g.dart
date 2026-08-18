// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'callback_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CallbackListDtoCWProxy {
  CallbackListDto items(List<CallbackDto> items);

  CallbackListDto serverTime(DateTime serverTime);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CallbackListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CallbackListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CallbackListDto call({List<CallbackDto> items, DateTime serverTime});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCallbackListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCallbackListDto.copyWith.fieldName(...)`
class _$CallbackListDtoCWProxyImpl implements _$CallbackListDtoCWProxy {
  const _$CallbackListDtoCWProxyImpl(this._value);

  final CallbackListDto _value;

  @override
  CallbackListDto items(List<CallbackDto> items) => this(items: items);

  @override
  CallbackListDto serverTime(DateTime serverTime) =>
      this(serverTime: serverTime);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CallbackListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CallbackListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CallbackListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? serverTime = const $CopyWithPlaceholder(),
  }) {
    return CallbackListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<CallbackDto>,
      serverTime: serverTime == const $CopyWithPlaceholder()
          ? _value.serverTime
          // ignore: cast_nullable_to_non_nullable
          : serverTime as DateTime,
    );
  }
}

extension $CallbackListDtoCopyWith on CallbackListDto {
  /// Returns a callable class that can be used as follows: `instanceOfCallbackListDto.copyWith(...)` or like so:`instanceOfCallbackListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CallbackListDtoCWProxy get copyWith => _$CallbackListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CallbackListDto _$CallbackListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CallbackListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'serverTime']);
      final val = CallbackListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => CallbackDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        serverTime: $checkedConvert(
          'serverTime',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CallbackListDtoToJson(CallbackListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'serverTime': instance.serverTime.toIso8601String(),
    };
