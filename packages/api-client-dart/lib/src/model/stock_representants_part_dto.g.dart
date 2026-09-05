// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stock_representants_part_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$StockRepresentantsPartDtoCWProxy {
  StockRepresentantsPartDto id(String id);

  StockRepresentantsPartDto label(String label);

  StockRepresentantsPartDto count(num count);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StockRepresentantsPartDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StockRepresentantsPartDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StockRepresentantsPartDto call({String id, String label, num count});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfStockRepresentantsPartDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfStockRepresentantsPartDto.copyWith.fieldName(...)`
class _$StockRepresentantsPartDtoCWProxyImpl
    implements _$StockRepresentantsPartDtoCWProxy {
  const _$StockRepresentantsPartDtoCWProxyImpl(this._value);

  final StockRepresentantsPartDto _value;

  @override
  StockRepresentantsPartDto id(String id) => this(id: id);

  @override
  StockRepresentantsPartDto label(String label) => this(label: label);

  @override
  StockRepresentantsPartDto count(num count) => this(count: count);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StockRepresentantsPartDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StockRepresentantsPartDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StockRepresentantsPartDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
  }) {
    return StockRepresentantsPartDto(
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

extension $StockRepresentantsPartDtoCopyWith on StockRepresentantsPartDto {
  /// Returns a callable class that can be used as follows: `instanceOfStockRepresentantsPartDto.copyWith(...)` or like so:`instanceOfStockRepresentantsPartDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$StockRepresentantsPartDtoCWProxy get copyWith =>
      _$StockRepresentantsPartDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StockRepresentantsPartDto _$StockRepresentantsPartDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('StockRepresentantsPartDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['id', 'label', 'count']);
  final val = StockRepresentantsPartDto(
    id: $checkedConvert('id', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    count: $checkedConvert('count', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$StockRepresentantsPartDtoToJson(
  StockRepresentantsPartDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'label': instance.label,
  'count': instance.count,
};
