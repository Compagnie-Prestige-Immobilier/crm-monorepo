// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_stat_agent_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteStatAgentDtoCWProxy {
  VisiteStatAgentDto id(String id);

  VisiteStatAgentDto label(String label);

  VisiteStatAgentDto count(num count);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatAgentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatAgentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatAgentDto call({String id, String label, num count});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteStatAgentDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteStatAgentDto.copyWith.fieldName(...)`
class _$VisiteStatAgentDtoCWProxyImpl implements _$VisiteStatAgentDtoCWProxy {
  const _$VisiteStatAgentDtoCWProxyImpl(this._value);

  final VisiteStatAgentDto _value;

  @override
  VisiteStatAgentDto id(String id) => this(id: id);

  @override
  VisiteStatAgentDto label(String label) => this(label: label);

  @override
  VisiteStatAgentDto count(num count) => this(count: count);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatAgentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatAgentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatAgentDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
  }) {
    return VisiteStatAgentDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      count: count == const $CopyWithPlaceholder()
          ? _value.count
          // ignore: cast_nullable_to_non_nullable
          : count as num,
    );
  }
}

extension $VisiteStatAgentDtoCopyWith on VisiteStatAgentDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteStatAgentDto.copyWith(...)` or like so:`instanceOfVisiteStatAgentDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteStatAgentDtoCWProxy get copyWith =>
      _$VisiteStatAgentDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteStatAgentDto _$VisiteStatAgentDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('VisiteStatAgentDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['id', 'label', 'count']);
      final val = VisiteStatAgentDto(
        id: $checkedConvert('id', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        count: $checkedConvert('count', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$VisiteStatAgentDtoToJson(VisiteStatAgentDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'label': instance.label,
      'count': instance.count,
    };
