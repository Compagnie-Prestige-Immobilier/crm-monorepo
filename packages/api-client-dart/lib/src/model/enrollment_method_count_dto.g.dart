// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'enrollment_method_count_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$EnrollmentMethodCountDtoCWProxy {
  EnrollmentMethodCountDto method(EnrollmentMethod method);

  EnrollmentMethodCountDto label(String label);

  EnrollmentMethodCountDto prospects(num prospects);

  EnrollmentMethodCountDto share(num share);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EnrollmentMethodCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EnrollmentMethodCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EnrollmentMethodCountDto call({
    EnrollmentMethod method,
    String label,
    num prospects,
    num share,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfEnrollmentMethodCountDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfEnrollmentMethodCountDto.copyWith.fieldName(...)`
class _$EnrollmentMethodCountDtoCWProxyImpl
    implements _$EnrollmentMethodCountDtoCWProxy {
  const _$EnrollmentMethodCountDtoCWProxyImpl(this._value);

  final EnrollmentMethodCountDto _value;

  @override
  EnrollmentMethodCountDto method(EnrollmentMethod method) =>
      this(method: method);

  @override
  EnrollmentMethodCountDto label(String label) => this(label: label);

  @override
  EnrollmentMethodCountDto prospects(num prospects) =>
      this(prospects: prospects);

  @override
  EnrollmentMethodCountDto share(num share) => this(share: share);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EnrollmentMethodCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EnrollmentMethodCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EnrollmentMethodCountDto call({
    Object? method = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
  }) {
    return EnrollmentMethodCountDto(
      method: method == const $CopyWithPlaceholder()
          ? _value.method
          // ignore: cast_nullable_to_non_nullable
          : method as EnrollmentMethod,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as num,
      share: share == const $CopyWithPlaceholder()
          ? _value.share
          // ignore: cast_nullable_to_non_nullable
          : share as num,
    );
  }
}

extension $EnrollmentMethodCountDtoCopyWith on EnrollmentMethodCountDto {
  /// Returns a callable class that can be used as follows: `instanceOfEnrollmentMethodCountDto.copyWith(...)` or like so:`instanceOfEnrollmentMethodCountDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$EnrollmentMethodCountDtoCWProxy get copyWith =>
      _$EnrollmentMethodCountDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EnrollmentMethodCountDto _$EnrollmentMethodCountDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('EnrollmentMethodCountDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['method', 'label', 'prospects', 'share'],
  );
  final val = EnrollmentMethodCountDto(
    method: $checkedConvert(
      'method',
      (v) => $enumDecode(
        _$EnrollmentMethodEnumMap,
        v,
        unknownValue: EnrollmentMethod.unknownDefaultOpenApi,
      ),
    ),
    label: $checkedConvert('label', (v) => v as String),
    prospects: $checkedConvert('prospects', (v) => v as num),
    share: $checkedConvert('share', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$EnrollmentMethodCountDtoToJson(
  EnrollmentMethodCountDto instance,
) => <String, dynamic>{
  'method': _$EnrollmentMethodEnumMap[instance.method]!,
  'label': instance.label,
  'prospects': instance.prospects,
  'share': instance.share,
};

const _$EnrollmentMethodEnumMap = {
  EnrollmentMethod.PLATFORM: 'PLATFORM',
  EnrollmentMethod.PHYSICAL: 'PHYSICAL',
  EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING:
      'VOICE_OR_ELECTRONIC_MESSAGING',
  EnrollmentMethod.unknownDefaultOpenApi: 'unknown_default_open_api',
};
