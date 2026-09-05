// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'repartition_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepartitionDtoCWProxy {
  RepartitionDto id(String id);

  RepartitionDto label(String label);

  RepartitionDto inscriptions(num inscriptions);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepartitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepartitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepartitionDto call({String id, String label, num inscriptions});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepartitionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepartitionDto.copyWith.fieldName(...)`
class _$RepartitionDtoCWProxyImpl implements _$RepartitionDtoCWProxy {
  const _$RepartitionDtoCWProxyImpl(this._value);

  final RepartitionDto _value;

  @override
  RepartitionDto id(String id) => this(id: id);

  @override
  RepartitionDto label(String label) => this(label: label);

  @override
  RepartitionDto inscriptions(num inscriptions) =>
      this(inscriptions: inscriptions);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepartitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepartitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepartitionDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? inscriptions = const $CopyWithPlaceholder(),
  }) {
    return RepartitionDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      inscriptions: inscriptions == const $CopyWithPlaceholder()
          ? _value.inscriptions
          // ignore: cast_nullable_to_non_nullable
          : inscriptions as num,
    );
  }
}

extension $RepartitionDtoCopyWith on RepartitionDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepartitionDto.copyWith(...)` or like so:`instanceOfRepartitionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepartitionDtoCWProxy get copyWith => _$RepartitionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepartitionDto _$RepartitionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RepartitionDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['id', 'label', 'inscriptions']);
      final val = RepartitionDto(
        id: $checkedConvert('id', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        inscriptions: $checkedConvert('inscriptions', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$RepartitionDtoToJson(RepartitionDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'label': instance.label,
      'inscriptions': instance.inscriptions,
    };
