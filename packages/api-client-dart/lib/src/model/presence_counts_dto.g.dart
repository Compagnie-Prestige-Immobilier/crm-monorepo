// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'presence_counts_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PresenceCountsDtoCWProxy {
  PresenceCountsDto online(num online);

  PresenceCountsDto recent(num recent);

  PresenceCountsDto away(num away);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PresenceCountsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PresenceCountsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PresenceCountsDto call({num online, num recent, num away});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPresenceCountsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPresenceCountsDto.copyWith.fieldName(...)`
class _$PresenceCountsDtoCWProxyImpl implements _$PresenceCountsDtoCWProxy {
  const _$PresenceCountsDtoCWProxyImpl(this._value);

  final PresenceCountsDto _value;

  @override
  PresenceCountsDto online(num online) => this(online: online);

  @override
  PresenceCountsDto recent(num recent) => this(recent: recent);

  @override
  PresenceCountsDto away(num away) => this(away: away);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PresenceCountsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PresenceCountsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PresenceCountsDto call({
    Object? online = const $CopyWithPlaceholder(),
    Object? recent = const $CopyWithPlaceholder(),
    Object? away = const $CopyWithPlaceholder(),
  }) {
    return PresenceCountsDto(
      online: online == const $CopyWithPlaceholder()
          ? _value.online
          // ignore: cast_nullable_to_non_nullable
          : online as num,
      recent: recent == const $CopyWithPlaceholder()
          ? _value.recent
          // ignore: cast_nullable_to_non_nullable
          : recent as num,
      away: away == const $CopyWithPlaceholder()
          ? _value.away
          // ignore: cast_nullable_to_non_nullable
          : away as num,
    );
  }
}

extension $PresenceCountsDtoCopyWith on PresenceCountsDto {
  /// Returns a callable class that can be used as follows: `instanceOfPresenceCountsDto.copyWith(...)` or like so:`instanceOfPresenceCountsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PresenceCountsDtoCWProxy get copyWith =>
      _$PresenceCountsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PresenceCountsDto _$PresenceCountsDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PresenceCountsDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['online', 'recent', 'away']);
      final val = PresenceCountsDto(
        online: $checkedConvert('online', (v) => v as num),
        recent: $checkedConvert('recent', (v) => v as num),
        away: $checkedConvert('away', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$PresenceCountsDtoToJson(PresenceCountsDto instance) =>
    <String, dynamic>{
      'online': instance.online,
      'recent': instance.recent,
      'away': instance.away,
    };
