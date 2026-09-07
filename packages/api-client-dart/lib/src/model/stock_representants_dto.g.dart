// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stock_representants_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$StockRepresentantsDtoCWProxy {
  StockRepresentantsDto total(num total);

  StockRepresentantsDto jamaisAppeles(num jamaisAppeles);

  StockRepresentantsDto injoignables(num injoignables);

  StockRepresentantsDto parDepartement(
    List<StockRepresentantsPartDto> parDepartement,
  );

  StockRepresentantsDto parIef(List<StockRepresentantsPartDto> parIef);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StockRepresentantsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StockRepresentantsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StockRepresentantsDto call({
    num total,
    num jamaisAppeles,
    num injoignables,
    List<StockRepresentantsPartDto> parDepartement,
    List<StockRepresentantsPartDto> parIef,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfStockRepresentantsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfStockRepresentantsDto.copyWith.fieldName(...)`
class _$StockRepresentantsDtoCWProxyImpl
    implements _$StockRepresentantsDtoCWProxy {
  const _$StockRepresentantsDtoCWProxyImpl(this._value);

  final StockRepresentantsDto _value;

  @override
  StockRepresentantsDto total(num total) => this(total: total);

  @override
  StockRepresentantsDto jamaisAppeles(num jamaisAppeles) =>
      this(jamaisAppeles: jamaisAppeles);

  @override
  StockRepresentantsDto injoignables(num injoignables) =>
      this(injoignables: injoignables);

  @override
  StockRepresentantsDto parDepartement(
    List<StockRepresentantsPartDto> parDepartement,
  ) => this(parDepartement: parDepartement);

  @override
  StockRepresentantsDto parIef(List<StockRepresentantsPartDto> parIef) =>
      this(parIef: parIef);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StockRepresentantsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StockRepresentantsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StockRepresentantsDto call({
    Object? total = const $CopyWithPlaceholder(),
    Object? jamaisAppeles = const $CopyWithPlaceholder(),
    Object? injoignables = const $CopyWithPlaceholder(),
    Object? parDepartement = const $CopyWithPlaceholder(),
    Object? parIef = const $CopyWithPlaceholder(),
  }) {
    return StockRepresentantsDto(
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
      jamaisAppeles: jamaisAppeles == const $CopyWithPlaceholder()
          ? _value.jamaisAppeles
          // ignore: cast_nullable_to_non_nullable
          : jamaisAppeles as num,
      injoignables: injoignables == const $CopyWithPlaceholder()
          ? _value.injoignables
          // ignore: cast_nullable_to_non_nullable
          : injoignables as num,
      parDepartement: parDepartement == const $CopyWithPlaceholder()
          ? _value.parDepartement
          // ignore: cast_nullable_to_non_nullable
          : parDepartement as List<StockRepresentantsPartDto>,
      parIef: parIef == const $CopyWithPlaceholder()
          ? _value.parIef
          // ignore: cast_nullable_to_non_nullable
          : parIef as List<StockRepresentantsPartDto>,
    );
  }
}

extension $StockRepresentantsDtoCopyWith on StockRepresentantsDto {
  /// Returns a callable class that can be used as follows: `instanceOfStockRepresentantsDto.copyWith(...)` or like so:`instanceOfStockRepresentantsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$StockRepresentantsDtoCWProxy get copyWith =>
      _$StockRepresentantsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StockRepresentantsDto _$StockRepresentantsDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('StockRepresentantsDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'total',
      'jamaisAppeles',
      'injoignables',
      'parDepartement',
      'parIef',
    ],
  );
  final val = StockRepresentantsDto(
    total: $checkedConvert('total', (v) => v as num),
    jamaisAppeles: $checkedConvert('jamaisAppeles', (v) => v as num),
    injoignables: $checkedConvert('injoignables', (v) => v as num),
    parDepartement: $checkedConvert(
      'parDepartement',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                StockRepresentantsPartDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    parIef: $checkedConvert(
      'parIef',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                StockRepresentantsPartDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$StockRepresentantsDtoToJson(
  StockRepresentantsDto instance,
) => <String, dynamic>{
  'total': instance.total,
  'jamaisAppeles': instance.jamaisAppeles,
  'injoignables': instance.injoignables,
  'parDepartement': instance.parDepartement.map((e) => e.toJson()).toList(),
  'parIef': instance.parIef.map((e) => e.toJson()).toList(),
};
