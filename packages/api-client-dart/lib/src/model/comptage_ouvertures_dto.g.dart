// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'comptage_ouvertures_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ComptageOuverturesDtoCWProxy {
  ComptageOuverturesDto items(List<ComptageOuverturesJourDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ComptageOuverturesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ComptageOuverturesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ComptageOuverturesDto call({List<ComptageOuverturesJourDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfComptageOuverturesDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfComptageOuverturesDto.copyWith.fieldName(...)`
class _$ComptageOuverturesDtoCWProxyImpl
    implements _$ComptageOuverturesDtoCWProxy {
  const _$ComptageOuverturesDtoCWProxyImpl(this._value);

  final ComptageOuverturesDto _value;

  @override
  ComptageOuverturesDto items(List<ComptageOuverturesJourDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ComptageOuverturesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ComptageOuverturesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ComptageOuverturesDto call({Object? items = const $CopyWithPlaceholder()}) {
    return ComptageOuverturesDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<ComptageOuverturesJourDto>,
    );
  }
}

extension $ComptageOuverturesDtoCopyWith on ComptageOuverturesDto {
  /// Returns a callable class that can be used as follows: `instanceOfComptageOuverturesDto.copyWith(...)` or like so:`instanceOfComptageOuverturesDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ComptageOuverturesDtoCWProxy get copyWith =>
      _$ComptageOuverturesDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ComptageOuverturesDto _$ComptageOuverturesDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ComptageOuverturesDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = ComptageOuverturesDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                ComptageOuverturesJourDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$ComptageOuverturesDtoToJson(
  ComptageOuverturesDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
