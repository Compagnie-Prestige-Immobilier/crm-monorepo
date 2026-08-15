// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reject_client_request_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RejectClientRequestDtoCWProxy {
  RejectClientRequestDto reason(String reason);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RejectClientRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RejectClientRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RejectClientRequestDto call({String reason});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRejectClientRequestDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRejectClientRequestDto.copyWith.fieldName(...)`
class _$RejectClientRequestDtoCWProxyImpl
    implements _$RejectClientRequestDtoCWProxy {
  const _$RejectClientRequestDtoCWProxyImpl(this._value);

  final RejectClientRequestDto _value;

  @override
  RejectClientRequestDto reason(String reason) => this(reason: reason);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RejectClientRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RejectClientRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RejectClientRequestDto call({Object? reason = const $CopyWithPlaceholder()}) {
    return RejectClientRequestDto(
      reason: reason == const $CopyWithPlaceholder()
          ? _value.reason
          // ignore: cast_nullable_to_non_nullable
          : reason as String,
    );
  }
}

extension $RejectClientRequestDtoCopyWith on RejectClientRequestDto {
  /// Returns a callable class that can be used as follows: `instanceOfRejectClientRequestDto.copyWith(...)` or like so:`instanceOfRejectClientRequestDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RejectClientRequestDtoCWProxy get copyWith =>
      _$RejectClientRequestDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RejectClientRequestDto _$RejectClientRequestDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RejectClientRequestDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['reason']);
  final val = RejectClientRequestDto(
    reason: $checkedConvert('reason', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$RejectClientRequestDtoToJson(
  RejectClientRequestDto instance,
) => <String, dynamic>{'reason': instance.reason};
