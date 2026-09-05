// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'serie_jour_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SerieJourDtoCWProxy {
  SerieJourDto jour(DateTime jour);

  SerieJourDto inscriptions(num inscriptions);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SerieJourDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SerieJourDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SerieJourDto call({DateTime jour, num inscriptions});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSerieJourDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSerieJourDto.copyWith.fieldName(...)`
class _$SerieJourDtoCWProxyImpl implements _$SerieJourDtoCWProxy {
  const _$SerieJourDtoCWProxyImpl(this._value);

  final SerieJourDto _value;

  @override
  SerieJourDto jour(DateTime jour) => this(jour: jour);

  @override
  SerieJourDto inscriptions(num inscriptions) =>
      this(inscriptions: inscriptions);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SerieJourDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SerieJourDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SerieJourDto call({
    Object? jour = const $CopyWithPlaceholder(),
    Object? inscriptions = const $CopyWithPlaceholder(),
  }) {
    return SerieJourDto(
      jour: jour == const $CopyWithPlaceholder()
          ? _value.jour
          // ignore: cast_nullable_to_non_nullable
          : jour as DateTime,
      inscriptions: inscriptions == const $CopyWithPlaceholder()
          ? _value.inscriptions
          // ignore: cast_nullable_to_non_nullable
          : inscriptions as num,
    );
  }
}

extension $SerieJourDtoCopyWith on SerieJourDto {
  /// Returns a callable class that can be used as follows: `instanceOfSerieJourDto.copyWith(...)` or like so:`instanceOfSerieJourDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SerieJourDtoCWProxy get copyWith => _$SerieJourDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SerieJourDto _$SerieJourDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SerieJourDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['jour', 'inscriptions']);
      final val = SerieJourDto(
        jour: $checkedConvert('jour', (v) => DateTime.parse(v as String)),
        inscriptions: $checkedConvert('inscriptions', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$SerieJourDtoToJson(SerieJourDto instance) =>
    <String, dynamic>{
      'jour': instance.jour.toIso8601String(),
      'inscriptions': instance.inscriptions,
    };
