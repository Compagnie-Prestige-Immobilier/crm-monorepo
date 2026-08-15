// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_productivity_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantProductivityDtoCWProxy {
  RepresentantProductivityDto id(String id);

  RepresentantProductivityDto label(String label);

  RepresentantProductivityDto departementName(String departementName);

  RepresentantProductivityDto prospects(num prospects);

  RepresentantProductivityDto methodObtained(num methodObtained);

  RepresentantProductivityDto conversionRate(num? conversionRate);

  RepresentantProductivityDto lastProspectAt(DateTime? lastProspectAt);

  RepresentantProductivityDto dormant(bool dormant);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantProductivityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantProductivityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantProductivityDto call({
    String id,
    String label,
    String departementName,
    num prospects,
    num methodObtained,
    num? conversionRate,
    DateTime? lastProspectAt,
    bool dormant,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantProductivityDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantProductivityDto.copyWith.fieldName(...)`
class _$RepresentantProductivityDtoCWProxyImpl
    implements _$RepresentantProductivityDtoCWProxy {
  const _$RepresentantProductivityDtoCWProxyImpl(this._value);

  final RepresentantProductivityDto _value;

  @override
  RepresentantProductivityDto id(String id) => this(id: id);

  @override
  RepresentantProductivityDto label(String label) => this(label: label);

  @override
  RepresentantProductivityDto departementName(String departementName) =>
      this(departementName: departementName);

  @override
  RepresentantProductivityDto prospects(num prospects) =>
      this(prospects: prospects);

  @override
  RepresentantProductivityDto methodObtained(num methodObtained) =>
      this(methodObtained: methodObtained);

  @override
  RepresentantProductivityDto conversionRate(num? conversionRate) =>
      this(conversionRate: conversionRate);

  @override
  RepresentantProductivityDto lastProspectAt(DateTime? lastProspectAt) =>
      this(lastProspectAt: lastProspectAt);

  @override
  RepresentantProductivityDto dormant(bool dormant) => this(dormant: dormant);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantProductivityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantProductivityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantProductivityDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? departementName = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? methodObtained = const $CopyWithPlaceholder(),
    Object? conversionRate = const $CopyWithPlaceholder(),
    Object? lastProspectAt = const $CopyWithPlaceholder(),
    Object? dormant = const $CopyWithPlaceholder(),
  }) {
    return RepresentantProductivityDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      departementName: departementName == const $CopyWithPlaceholder()
          ? _value.departementName
          // ignore: cast_nullable_to_non_nullable
          : departementName as String,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as num,
      methodObtained: methodObtained == const $CopyWithPlaceholder()
          ? _value.methodObtained
          // ignore: cast_nullable_to_non_nullable
          : methodObtained as num,
      conversionRate: conversionRate == const $CopyWithPlaceholder()
          ? _value.conversionRate
          // ignore: cast_nullable_to_non_nullable
          : conversionRate as num?,
      lastProspectAt: lastProspectAt == const $CopyWithPlaceholder()
          ? _value.lastProspectAt
          // ignore: cast_nullable_to_non_nullable
          : lastProspectAt as DateTime?,
      dormant: dormant == const $CopyWithPlaceholder()
          ? _value.dormant
          // ignore: cast_nullable_to_non_nullable
          : dormant as bool,
    );
  }
}

extension $RepresentantProductivityDtoCopyWith on RepresentantProductivityDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantProductivityDto.copyWith(...)` or like so:`instanceOfRepresentantProductivityDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantProductivityDtoCWProxy get copyWith =>
      _$RepresentantProductivityDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantProductivityDto _$RepresentantProductivityDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepresentantProductivityDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'label',
      'departementName',
      'prospects',
      'methodObtained',
      'conversionRate',
      'lastProspectAt',
      'dormant',
    ],
  );
  final val = RepresentantProductivityDto(
    id: $checkedConvert('id', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    departementName: $checkedConvert('departementName', (v) => v as String),
    prospects: $checkedConvert('prospects', (v) => v as num),
    methodObtained: $checkedConvert('methodObtained', (v) => v as num),
    conversionRate: $checkedConvert('conversionRate', (v) => v as num?),
    lastProspectAt: $checkedConvert(
      'lastProspectAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    dormant: $checkedConvert('dormant', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$RepresentantProductivityDtoToJson(
  RepresentantProductivityDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'label': instance.label,
  'departementName': instance.departementName,
  'prospects': instance.prospects,
  'methodObtained': instance.methodObtained,
  'conversionRate': instance.conversionRate,
  'lastProspectAt': instance.lastProspectAt?.toIso8601String(),
  'dormant': instance.dormant,
};
