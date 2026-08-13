// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervision_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisionDtoCWProxy {
  SupervisionDto observedAt(DateTime observedAt);

  SupervisionDto onlineWindowMinutes(num onlineWindowMinutes);

  SupervisionDto teleconseillers(List<SupervisedUserDto> teleconseillers);

  SupervisionDto finances(List<SupervisedUserDto> finances);

  SupervisionDto counts(PresenceCountsDto counts);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionDto call({
    DateTime observedAt,
    num onlineWindowMinutes,
    List<SupervisedUserDto> teleconseillers,
    List<SupervisedUserDto> finances,
    PresenceCountsDto counts,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisionDto.copyWith.fieldName(...)`
class _$SupervisionDtoCWProxyImpl implements _$SupervisionDtoCWProxy {
  const _$SupervisionDtoCWProxyImpl(this._value);

  final SupervisionDto _value;

  @override
  SupervisionDto observedAt(DateTime observedAt) =>
      this(observedAt: observedAt);

  @override
  SupervisionDto onlineWindowMinutes(num onlineWindowMinutes) =>
      this(onlineWindowMinutes: onlineWindowMinutes);

  @override
  SupervisionDto teleconseillers(List<SupervisedUserDto> teleconseillers) =>
      this(teleconseillers: teleconseillers);

  @override
  SupervisionDto finances(List<SupervisedUserDto> finances) =>
      this(finances: finances);

  @override
  SupervisionDto counts(PresenceCountsDto counts) => this(counts: counts);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionDto call({
    Object? observedAt = const $CopyWithPlaceholder(),
    Object? onlineWindowMinutes = const $CopyWithPlaceholder(),
    Object? teleconseillers = const $CopyWithPlaceholder(),
    Object? finances = const $CopyWithPlaceholder(),
    Object? counts = const $CopyWithPlaceholder(),
  }) {
    return SupervisionDto(
      observedAt: observedAt == const $CopyWithPlaceholder()
          ? _value.observedAt
          // ignore: cast_nullable_to_non_nullable
          : observedAt as DateTime,
      onlineWindowMinutes: onlineWindowMinutes == const $CopyWithPlaceholder()
          ? _value.onlineWindowMinutes
          // ignore: cast_nullable_to_non_nullable
          : onlineWindowMinutes as num,
      teleconseillers: teleconseillers == const $CopyWithPlaceholder()
          ? _value.teleconseillers
          // ignore: cast_nullable_to_non_nullable
          : teleconseillers as List<SupervisedUserDto>,
      finances: finances == const $CopyWithPlaceholder()
          ? _value.finances
          // ignore: cast_nullable_to_non_nullable
          : finances as List<SupervisedUserDto>,
      counts: counts == const $CopyWithPlaceholder()
          ? _value.counts
          // ignore: cast_nullable_to_non_nullable
          : counts as PresenceCountsDto,
    );
  }
}

extension $SupervisionDtoCopyWith on SupervisionDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisionDto.copyWith(...)` or like so:`instanceOfSupervisionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisionDtoCWProxy get copyWith => _$SupervisionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisionDto _$SupervisionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SupervisionDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'observedAt',
          'onlineWindowMinutes',
          'teleconseillers',
          'finances',
          'counts',
        ],
      );
      final val = SupervisionDto(
        observedAt: $checkedConvert(
          'observedAt',
          (v) => DateTime.parse(v as String),
        ),
        onlineWindowMinutes: $checkedConvert(
          'onlineWindowMinutes',
          (v) => v as num? ?? 20,
        ),
        teleconseillers: $checkedConvert(
          'teleconseillers',
          (v) => (v as List<dynamic>)
              .map((e) => SupervisedUserDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        finances: $checkedConvert(
          'finances',
          (v) => (v as List<dynamic>)
              .map((e) => SupervisedUserDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        counts: $checkedConvert(
          'counts',
          (v) => PresenceCountsDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SupervisionDtoToJson(
  SupervisionDto instance,
) => <String, dynamic>{
  'observedAt': instance.observedAt.toIso8601String(),
  'onlineWindowMinutes': instance.onlineWindowMinutes,
  'teleconseillers': instance.teleconseillers.map((e) => e.toJson()).toList(),
  'finances': instance.finances.map((e) => e.toJson()).toList(),
  'counts': instance.counts.toJson(),
};
