// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_comment_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantCommentDtoCWProxy {
  RepresentantCommentDto id(String id);

  RepresentantCommentDto representantId(String representantId);

  RepresentantCommentDto authorId(String authorId);

  RepresentantCommentDto authorName(String authorName);

  RepresentantCommentDto body(String body);

  RepresentantCommentDto clientCreatedAt(DateTime clientCreatedAt);

  RepresentantCommentDto createdAt(DateTime createdAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantCommentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantCommentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantCommentDto call({
    String id,
    String representantId,
    String authorId,
    String authorName,
    String body,
    DateTime clientCreatedAt,
    DateTime createdAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantCommentDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantCommentDto.copyWith.fieldName(...)`
class _$RepresentantCommentDtoCWProxyImpl
    implements _$RepresentantCommentDtoCWProxy {
  const _$RepresentantCommentDtoCWProxyImpl(this._value);

  final RepresentantCommentDto _value;

  @override
  RepresentantCommentDto id(String id) => this(id: id);

  @override
  RepresentantCommentDto representantId(String representantId) =>
      this(representantId: representantId);

  @override
  RepresentantCommentDto authorId(String authorId) => this(authorId: authorId);

  @override
  RepresentantCommentDto authorName(String authorName) =>
      this(authorName: authorName);

  @override
  RepresentantCommentDto body(String body) => this(body: body);

  @override
  RepresentantCommentDto clientCreatedAt(DateTime clientCreatedAt) =>
      this(clientCreatedAt: clientCreatedAt);

  @override
  RepresentantCommentDto createdAt(DateTime createdAt) =>
      this(createdAt: createdAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantCommentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantCommentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantCommentDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? authorId = const $CopyWithPlaceholder(),
    Object? authorName = const $CopyWithPlaceholder(),
    Object? body = const $CopyWithPlaceholder(),
    Object? clientCreatedAt = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
  }) {
    return RepresentantCommentDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String,
      authorId: authorId == const $CopyWithPlaceholder()
          ? _value.authorId
          // ignore: cast_nullable_to_non_nullable
          : authorId as String,
      authorName: authorName == const $CopyWithPlaceholder()
          ? _value.authorName
          // ignore: cast_nullable_to_non_nullable
          : authorName as String,
      body: body == const $CopyWithPlaceholder()
          ? _value.body
          // ignore: cast_nullable_to_non_nullable
          : body as String,
      clientCreatedAt: clientCreatedAt == const $CopyWithPlaceholder()
          ? _value.clientCreatedAt
          // ignore: cast_nullable_to_non_nullable
          : clientCreatedAt as DateTime,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
    );
  }
}

extension $RepresentantCommentDtoCopyWith on RepresentantCommentDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantCommentDto.copyWith(...)` or like so:`instanceOfRepresentantCommentDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantCommentDtoCWProxy get copyWith =>
      _$RepresentantCommentDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantCommentDto _$RepresentantCommentDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepresentantCommentDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'representantId',
      'authorId',
      'authorName',
      'body',
      'clientCreatedAt',
      'createdAt',
    ],
  );
  final val = RepresentantCommentDto(
    id: $checkedConvert('id', (v) => v as String),
    representantId: $checkedConvert('representantId', (v) => v as String),
    authorId: $checkedConvert('authorId', (v) => v as String),
    authorName: $checkedConvert('authorName', (v) => v as String),
    body: $checkedConvert('body', (v) => v as String),
    clientCreatedAt: $checkedConvert(
      'clientCreatedAt',
      (v) => DateTime.parse(v as String),
    ),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$RepresentantCommentDtoToJson(
  RepresentantCommentDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'representantId': instance.representantId,
  'authorId': instance.authorId,
  'authorName': instance.authorName,
  'body': instance.body,
  'clientCreatedAt': instance.clientCreatedAt.toIso8601String(),
  'createdAt': instance.createdAt.toIso8601String(),
};
