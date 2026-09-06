// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'journal_parametres_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$JournalParametresDtoCWProxy {
  JournalParametresDto items(List<ParametreChangementDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `JournalParametresDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// JournalParametresDto(...).copyWith(id: 12, name: "My name")
  /// ````
  JournalParametresDto call({List<ParametreChangementDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfJournalParametresDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfJournalParametresDto.copyWith.fieldName(...)`
class _$JournalParametresDtoCWProxyImpl
    implements _$JournalParametresDtoCWProxy {
  const _$JournalParametresDtoCWProxyImpl(this._value);

  final JournalParametresDto _value;

  @override
  JournalParametresDto items(List<ParametreChangementDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `JournalParametresDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// JournalParametresDto(...).copyWith(id: 12, name: "My name")
  /// ````
  JournalParametresDto call({Object? items = const $CopyWithPlaceholder()}) {
    return JournalParametresDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<ParametreChangementDto>,
    );
  }
}

extension $JournalParametresDtoCopyWith on JournalParametresDto {
  /// Returns a callable class that can be used as follows: `instanceOfJournalParametresDto.copyWith(...)` or like so:`instanceOfJournalParametresDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$JournalParametresDtoCWProxy get copyWith =>
      _$JournalParametresDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

JournalParametresDto _$JournalParametresDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('JournalParametresDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = JournalParametresDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => ParametreChangementDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$JournalParametresDtoToJson(
  JournalParametresDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
