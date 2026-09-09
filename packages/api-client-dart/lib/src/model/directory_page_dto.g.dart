// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'directory_page_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DirectoryPageDtoCWProxy {
  DirectoryPageDto entries(List<DirectoryEntryDto> entries);

  DirectoryPageDto nextCursor(String nextCursor);

  DirectoryPageDto hasMore(bool hasMore);

  DirectoryPageDto serverTime(DateTime serverTime);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DirectoryPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DirectoryPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DirectoryPageDto call({
    List<DirectoryEntryDto> entries,
    String nextCursor,
    bool hasMore,
    DateTime serverTime,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDirectoryPageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDirectoryPageDto.copyWith.fieldName(...)`
class _$DirectoryPageDtoCWProxyImpl implements _$DirectoryPageDtoCWProxy {
  const _$DirectoryPageDtoCWProxyImpl(this._value);

  final DirectoryPageDto _value;

  @override
  DirectoryPageDto entries(List<DirectoryEntryDto> entries) =>
      this(entries: entries);

  @override
  DirectoryPageDto nextCursor(String nextCursor) =>
      this(nextCursor: nextCursor);

  @override
  DirectoryPageDto hasMore(bool hasMore) => this(hasMore: hasMore);

  @override
  DirectoryPageDto serverTime(DateTime serverTime) =>
      this(serverTime: serverTime);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DirectoryPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DirectoryPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DirectoryPageDto call({
    Object? entries = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
    Object? hasMore = const $CopyWithPlaceholder(),
    Object? serverTime = const $CopyWithPlaceholder(),
  }) {
    return DirectoryPageDto(
      entries: entries == const $CopyWithPlaceholder()
          ? _value.entries
          // ignore: cast_nullable_to_non_nullable
          : entries as List<DirectoryEntryDto>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String,
      hasMore: hasMore == const $CopyWithPlaceholder()
          ? _value.hasMore
          // ignore: cast_nullable_to_non_nullable
          : hasMore as bool,
      serverTime: serverTime == const $CopyWithPlaceholder()
          ? _value.serverTime
          // ignore: cast_nullable_to_non_nullable
          : serverTime as DateTime,
    );
  }
}

extension $DirectoryPageDtoCopyWith on DirectoryPageDto {
  /// Returns a callable class that can be used as follows: `instanceOfDirectoryPageDto.copyWith(...)` or like so:`instanceOfDirectoryPageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DirectoryPageDtoCWProxy get copyWith => _$DirectoryPageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DirectoryPageDto _$DirectoryPageDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DirectoryPageDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['entries', 'nextCursor', 'hasMore', 'serverTime'],
      );
      final val = DirectoryPageDto(
        entries: $checkedConvert(
          'entries',
          (v) => (v as List<dynamic>)
              .map((e) => DirectoryEntryDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        nextCursor: $checkedConvert('nextCursor', (v) => v as String),
        hasMore: $checkedConvert('hasMore', (v) => v as bool),
        serverTime: $checkedConvert(
          'serverTime',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$DirectoryPageDtoToJson(DirectoryPageDto instance) =>
    <String, dynamic>{
      'entries': instance.entries.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
      'hasMore': instance.hasMore,
      'serverTime': instance.serverTime.toIso8601String(),
    };
