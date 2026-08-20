// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'call_recording_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CallRecordingDtoCWProxy {
  CallRecordingDto attemptId(String attemptId);

  CallRecordingDto bytes(num bytes);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CallRecordingDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CallRecordingDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CallRecordingDto call({String attemptId, num bytes});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCallRecordingDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCallRecordingDto.copyWith.fieldName(...)`
class _$CallRecordingDtoCWProxyImpl implements _$CallRecordingDtoCWProxy {
  const _$CallRecordingDtoCWProxyImpl(this._value);

  final CallRecordingDto _value;

  @override
  CallRecordingDto attemptId(String attemptId) => this(attemptId: attemptId);

  @override
  CallRecordingDto bytes(num bytes) => this(bytes: bytes);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CallRecordingDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CallRecordingDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CallRecordingDto call({
    Object? attemptId = const $CopyWithPlaceholder(),
    Object? bytes = const $CopyWithPlaceholder(),
  }) {
    return CallRecordingDto(
      attemptId: attemptId == const $CopyWithPlaceholder()
          ? _value.attemptId
          // ignore: cast_nullable_to_non_nullable
          : attemptId as String,
      bytes: bytes == const $CopyWithPlaceholder()
          ? _value.bytes
          // ignore: cast_nullable_to_non_nullable
          : bytes as num,
    );
  }
}

extension $CallRecordingDtoCopyWith on CallRecordingDto {
  /// Returns a callable class that can be used as follows: `instanceOfCallRecordingDto.copyWith(...)` or like so:`instanceOfCallRecordingDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CallRecordingDtoCWProxy get copyWith => _$CallRecordingDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CallRecordingDto _$CallRecordingDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CallRecordingDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['attemptId', 'bytes']);
      final val = CallRecordingDto(
        attemptId: $checkedConvert('attemptId', (v) => v as String),
        bytes: $checkedConvert('bytes', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$CallRecordingDtoToJson(CallRecordingDto instance) =>
    <String, dynamic>{'attemptId': instance.attemptId, 'bytes': instance.bytes};
